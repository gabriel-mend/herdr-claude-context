import test from "node:test";
import assert from "node:assert/strict";
import { fake, reset, mount, find, text } from "./harness.mjs";

const agent = (over = {}) => ({ address: "t1", pane: "p1", title: "✳ Fix login", status: "idle", space_name: "home", focused: false, ...over });
const session = (over = {}) => ({ title: "Fix login", cwd: "/repo", used: 50_000, window: 200_000, ...over });

async function setup(a = agent()) {
  reset({ agents: [a], terminals: [{ address: a.address, cwd: "/repo" }] });
  const m = await mount();
  m.view.sessions = [session()];
  return m;
}

test("shows the percentage and token count of the matching session", async () => {
  const { view, cx } = await setup();
  const out = text(view.render(cx));
  assert.match(out, /25%/);
  assert.match(out, /50\.0k \/ 200\.0k/);
});

test("compact types /compact and enter into the agent", async () => {
  const { view, cx } = await setup();
  find(view.render(cx), "c-t1").click({}, cx);
  assert.deepEqual(fake.calls, [["hc", ["keys", "t1", "/", "c", "o", "m", "p", "a", "c", "t", "enter"]]]);
  assert.match(text(view.render(cx)), /compacting/);
});

test("compact does nothing while the agent is working", async () => {
  const { view, cx } = await setup(agent({ status: "working" }));
  find(view.render(cx), "c-t1").click({}, cx);
  assert.deepEqual(fake.calls, []);
});

test("a failed compact stops the spinner and shows the error", async () => {
  const { view, cx } = await setup();
  fake.hc = { code: 1, stderr: "no such terminal" };
  find(view.render(cx), "c-t1").click({}, cx);
  await new Promise((r) => setImmediate(r));
  const out = text(view.render(cx));
  assert.match(out, /no such terminal/);
  assert.doesNotMatch(out, /compacting/);
});

test("the spinner stops once the token count changes", async () => {
  const { view, cx } = await setup();
  find(view.render(cx), "c-t1").click({}, cx);
  view.sessions = [session({ used: 9_000 })];
  assert.doesNotMatch(text(view.render(cx)), /compacting/);
});

test("clicking a row focuses its pane", async () => {
  const { view, cx } = await setup();
  find(view.render(cx), "row-t1").click({}, cx);
  assert.deepEqual(fake.calls, [["run", "pane.focus", { pane: "p1" }]]);
});

const block = (size) => ({ children: [{ id: "my-block", size, content: { mod: "claude-context" } }] });

test("minimize shrinks the block and expand restores its size", async () => {
  reset({ layout: block({ px: 200 }) });
  const { view, cx } = await mount();
  find(view.render(cx), "minimize").click({}, cx);
  assert.deepEqual(fake.calls, [["run", "layout.resize", { id: "my-block", px: 42 }]]);
  fake.calls.length = 0;
  fake.layout = block({ px: 42 });
  find(view.render(cx), "minimize").click({}, cx);
  assert.deepEqual(fake.calls, [["run", "layout.resize", { id: "my-block", px: 200 }]]);
});

test("expand falls back to the default size when none was saved", async () => {
  reset({ layout: block({ px: 42 }) });
  const { view, cx } = await mount();
  find(view.render(cx), "minimize").click({}, cx);
  assert.deepEqual(fake.calls, [["run", "layout.resize", { id: "my-block", ...{ weight: 1 } }]]);
});

test("there is no minimize button outside a layout block", async () => {
  reset();
  const { view, cx } = await mount();
  assert.equal(find(view.render(cx), "minimize"), null);
});
