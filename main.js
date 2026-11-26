import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, terminals, exec, hc, theme, appHome, checking, run } from "herdr";

const clean = (s) => (s || "").replace(/^[^A-Za-z0-9À-ÿ]+/, "").trim();
const SPIN = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const fmt = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n));

export default class ClaudeContext extends View {
  init(_props, cx) {
    this.sessions = [];
    this.error = null;
    this.compacting = {};
    this.tick = 0;
    if (checking()) return;
    this.refresh(cx);
    cx.timer.every(4000, (cx) => this.refresh(cx));
    cx.timer.every(250, (cx) => {
      if (Object.keys(this.compacting).length) { this.tick++; cx.notify(); }
    });
  }

  refresh(cx) {
    cx.spawn(async (cx) => {
      try {
        const r = await exec("python3", [appHome() + "/mods/claude-context/ctx.py"], { timeout: 15000 });
        this.sessions = JSON.parse(r.stdout).sessions;
        this.error = r.code === 0 ? null : r.stderr.slice(0, 200);
      } catch (e) {
        this.error = String(e).slice(0, 200);
      }
      cx.notify();
    });
  }

  // Match an agent to its Claude session: by the title Claude generated, else by folder.
  match(a, cwdOf) {
    const title = clean(a.title);
    const byTitle = this.sessions.filter((s) => s.title && clean(s.title) === title);
    if (byTitle.length === 1) return byTitle[0];
    const cwd = cwdOf[a.address];
    const byCwd = this.sessions.filter((s) => s.cwd === cwd);
    if (byCwd.length === 1) return byCwd[0];
    return byTitle[0] || null;
  }

  acct(args, cx, then) {
    cx.spawn(async (cx) => {
      try {
        const r = await exec("python3", [appHome() + "/mods/agent-context/acct.py", ...args], { timeout: 15000 });
        if (r.code !== 0) throw new Error(r.stderr || r.stdout);
        if (then) then(JSON.parse(r.stdout));
      } catch (e) {
        this.error = "account: " + String(e).slice(0, 160);
      }
      this.refresh(cx);
    });
  }

  render(cx) {
    const t = theme();
    const cwdOf = {};
    for (const x of terminals()) cwdOf[x.address] = x.cwd;
    const rows = agents().map((a) => {
      const s = this.match(a, cwdOf);
      const pct = s && s.used != null ? Math.min(100, (s.used / s.window) * 100) : null;
      const color = pct == null ? t.dim : pct < 60 ? t.done : pct < 85 ? t.blocked : t.working;
      const c = this.compacting[a.address];
      if (c && (!s || s.used !== c.used || Date.now() - c.at > 180000)) delete this.compacting[a.address];
      const busy = !!this.compacting[a.address];
      const spin = SPIN[this.tick % SPIN.length];
      const canCompact = !busy && s && (a.status === "idle" || a.status === "done");
      return v_flex().gap(4).px(12).py(6)
        .hover((st) => st.bg(t.raised))
        .child(h_flex().gap(6).items_center()
          .child(div().id(`r-${a.address}`).cursor_pointer().flex_1().text_color(t.foreground).truncate()
            .on_click(() => run("pane.focus", { pane: a.pane }))
            .child(clean(a.title) || a.program?.name || "agent"))
          .child(div().text_size(11).text_color(color).child(pct == null ? "no data" : `${pct.toFixed(0)}%`))
          .child(div().id(`c-${a.address}`).text_size(11).px(6).py(1).rounded(4).border(1)
            .border_color(canCompact ? t.border : t.raised)
            .text_color(canCompact ? t.muted : t.dim)
            .when(canCompact, (el) => el.cursor_pointer().hover((st) => st.bg(t.hover)).on_click((_e, cx) => {
              this.compacting[a.address] = { at: Date.now(), used: s.used };
              cx.notify();
              hc(["keys", a.address, ..."/compact".split(""), "enter"]).then((r) => {
                if (r.code !== 0) {
                  delete this.compacting[a.address];
                  this.error = `compact ${a.address}: ` + (r.stderr || r.stdout || `exit ${r.code}`).slice(0, 160);
                  cx.notify();
                }
              }).catch((e) => {
                delete this.compacting[a.address];
                this.error = `compact ${a.address}: ` + String(e).slice(0, 160);
                cx.notify();
              });
            }))
            .child(busy ? `${spin} compacting` : "compact")))
        .child(div().w_full().h(5).rounded(3).bg(t.border)
          .child(div().h(5).rounded(3).bg(busy ? t.blocked : color).w(pct == null ? 0 : `${pct}%`)))
        .child(div().text_size(11).text_color(t.dim).truncate()
          .child(`${a.space_name}` + (s && s.used != null ? `  ·  ${fmt(s.used)} / ${fmt(s.window)}` : "")));
    });
    return v_flex().size_full().py(8).gap(2).text_size(13)
      .child(div().text_size(11).text_color(t.dim).px(12).pb(4).child("Context"))
      .children(rows)
      .when(this.error, (el) => el.child(div().text_size(11).text_color(t.working).child(this.error)));
  }
}
