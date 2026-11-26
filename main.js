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

  compact(a, used, cx) {
    this.compacting[a.address] = { at: Date.now(), used };
    cx.notify();
    const fail = (msg) => {
      delete this.compacting[a.address];
      this.error = `compact ${a.address}: ` + String(msg).slice(0, 160);
      cx.notify();
    };
    hc(["keys", a.address, ..."/compact".split(""), "enter"])
      .then((r) => { if (r.code !== 0) fail(r.stderr || r.stdout || `exit ${r.code}`); })
      .catch(fail);
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
      return v_flex().id(`row-${a.address}`).flex_none().gap(5).px(8).py(6).rounded(8).cursor_pointer()
        .when(a.focused, (el) => el.bg(t.selected))
        .hover((st) => st.bg(t.hover))
        .on_click(() => run("pane.focus", { pane: a.pane }))
        .child(h_flex().h(18).gap(9).items_center()
          .child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child(clean(a.title) || a.program?.name || "agent"))
          .child(div().flex_none().text_size(11).text_color(pct == null || pct < 60 ? t.dim : color).child(pct == null ? "no data" : `${pct.toFixed(0)}%`))
          .child(h_flex().id(`c-${a.address}`).flex_none().h(18).px(6).rounded(5).items_center().text_size(10.5).font_semibold()
            .bg(busy ? t.blocked + "26" : t.raised)
            .text_color(busy ? t.blocked : canCompact ? t.muted : t.dim)
            .when(canCompact, (el) => el.cursor_pointer().hover((st) => st.bg(t.hover).text_color(t.foreground)))
            .on_click((_e, cx) => {
              cx.stop_propagation();
              if (canCompact) this.compact(a, s.used, cx);
            })
            .child(busy ? `${spin} compacting` : "compact")))
        .child(div().w_full().h(3).rounded(2).bg(t.border)
          .child(div().h(3).rounded(2).bg(busy ? t.blocked : color).w(pct == null ? 0 : `${pct}%`)))
        .child(div().text_size(11).text_color(t.dim).truncate()
          .child(`${a.space_name}` + (s && s.used != null ? `  ·  ${fmt(s.used)} / ${fmt(s.window)}` : "")));
    });
    return v_flex().size_full().min_h(0).bg(t.chrome).border_t(1).border_color(t.border).text_size(13)
      .child(h_flex().px(16).h(41).pt(14).pb(5).flex_none().items_center().justify_between()
        .child(div().text_size(11.5).font_medium().text_color(t.dim).child("Context")))
      .child(v_flex().id("ctx-list").flex_1().min_h(0).px(8).gap(2).overflow_y_scrollbar().children(rows))
      .when(this.error, (el) => el.child(div().px(16).py(4).text_size(11).text_color(t.working).child(this.error)));
  }
}
