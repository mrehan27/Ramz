import assert from "node:assert/strict";
import test from "node:test";
import { applyImport, buildTransfer, parseTransfer, planImport } from "../shared/transfer.ts";
import { entry } from "./helpers.ts";

/** Snippets are the kind with the fewest requirements: a title and a command. */
const snippet = (over: Parameters<typeof entry>[0] = {}) => entry({ kind: "snippet", command: "echo hi", ...over });

const NOW = "2026-06-01T00:00:00.000Z";
let minted = 0;
const mint = () => `new-${++minted}`;

test("importing a file back into the store it came from changes nothing", () => {
  const store = [snippet({ id: "a", title: "One" }), snippet({ id: "b", title: "Two" })];
  const file = buildTransfer(store, {}, NOW);
  const read = parseTransfer(JSON.parse(JSON.stringify(file)), NOW, mint);

  const plan = planImport(read.entries, store);
  assert.deepEqual(plan.fresh, [], "nothing should look new");
  assert.deepEqual(plan.conflicts.map((c) => c.match), ["id", "id"]);

  // Skip is the default, and the default has to be a no-op.
  const out = applyImport(store, plan, () => "skip", NOW, mint);
  assert.deepEqual(out.entries, store);
  assert.deepEqual([out.added, out.overwritten, out.copied], [0, 0, 0]);
});

test("the same idea written on two machines collides on its title, not its id", () => {
  const mine = [entry({ id: "mine", kind: "prompt", title: "PR Checklist", body: "old" })];
  const theirs = [entry({ id: "theirs", kind: "prompt", title: "  pr checklist  ", body: "new" })];

  const plan = planImport(theirs, mine);
  assert.equal(plan.fresh.length, 0);
  assert.equal(plan.conflicts[0].match, "title");

  // A different kind with the same title is a different thing.
  assert.equal(planImport([entry({ id: "x", kind: "note", title: "PR Checklist", body: "n" })], mine).fresh.length, 1);
});

test("overwrite takes their content but keeps what is local", () => {
  const mine = [snippet({ id: "mine", title: "Deploy", command: "old", useCount: 7, lastUsedAt: NOW, createdAt: "2020-01-01T00:00:00.000Z" })];
  const theirs = [snippet({ id: "theirs", title: "Deploy", command: "new", useCount: 0 })];

  const out = applyImport(mine, planImport(theirs, mine), () => "overwrite", "2026-12-25T00:00:00.000Z", mint);
  assert.equal(out.entries.length, 1);
  const [merged] = out.entries;
  assert.equal(merged.command, "new", "their content wins");
  assert.equal(merged.id, "mine", "our id stays, so pins and history still point at it");
  assert.equal(merged.createdAt, "2020-01-01T00:00:00.000Z");
  assert.equal(merged.useCount, 7, "how often we copied it is ours, not theirs");
  assert.equal(merged.updatedAt, "2026-12-25T00:00:00.000Z");
  assert.equal(out.overwritten, 1);
});

test("keep both never reuses an id or a title", () => {
  const mine = [snippet({ id: "mine", title: "Deploy" })];
  const first = applyImport(mine, planImport([snippet({ id: "t1", title: "Deploy" })], mine), () => "keepBoth", NOW, mint);
  assert.deepEqual(first.entries.map((e) => e.title), ["Deploy", "Deploy (imported)"]);

  const second = applyImport(first.entries, planImport([snippet({ id: "t2", title: "Deploy" })], first.entries), () => "keepBoth", NOW, mint);
  assert.deepEqual(second.entries.map((e) => e.title), ["Deploy", "Deploy (imported)", "Deploy (imported 2)"]);
  assert.equal(new Set(second.entries.map((e) => e.id)).size, 3);
});

test("a file that is not ours, or newer than us, is refused whole", () => {
  assert.throws(() => parseTransfer({ entries: [] }, NOW, mint), /not a Ramz file/);
  assert.throws(() => parseTransfer({ ramz: 99, entries: [] }, NOW, mint), /understands 1/);
  // One bad entry rejects the file: a partial import you cannot see is worse.
  assert.throws(
    () => parseTransfer({ ramz: 1, entries: [{ kind: "snippet", title: "ok", command: "x" }, { kind: "snippet", command: "x" }] }, NOW, mint),
    /entry 2/,
  );
});

test("a hand-written entry needs only the interesting fields", () => {
  const read = parseTransfer(
    { ramz: 1, entries: [{ kind: "snippet", title: "Typed by hand", command: "echo hi" }] },
    NOW,
    mint,
  );
  const [only] = read.entries;
  assert.match(only.id, /^new-/, "an id is minted for it");
  assert.equal(only.createdAt, NOW);
  assert.equal(only.useCount, 0);
  assert.equal(planImport(read.entries, []).fresh.length, 1);
});

test("export carries the colours of tags it actually exports, and ours win on import", () => {
  const entries = [snippet({ id: "a", tags: ["git"] })];
  const file = buildTransfer(entries, { git: "blue", unused: "red" }, NOW);
  assert.deepEqual(file.tagColors, { git: "blue" });

  const plan = planImport(entries, [], file.tagColors, { git: "green" });
  assert.deepEqual(plan.newTags, [], "we already have a colour for git");
  const out = applyImport([], plan, () => "skip", NOW, mint, { git: "green" }, file.tagColors);
  assert.equal(out.tagColors.git, "green");
});
