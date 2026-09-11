import assert from "node:assert/strict";
import test from "node:test";
import { moved, orderedKinds, sortEntries } from "../shared/sort.ts";
import { entry } from "./helpers.ts";

const snippet = (over: Parameters<typeof entry>[0] = {}) => entry({ kind: "snippet", command: "echo hi", ...over });
const titles = (list: { title: string }[]) => list.map((e) => e.title);

test("pinned entries stay on top of every sort, manual included", () => {
  const list = [
    snippet({ id: "a", title: "Apple", order: 3, useCount: 9 }),
    snippet({ id: "b", title: "Banana", order: 1, useCount: 0, pinned: true }),
    snippet({ id: "c", title: "Cherry", order: 2, useCount: 5 }),
  ];
  for (const key of ["manual", "title", "used", "recent", "added"] as const) {
    assert.equal(sortEntries(list, key)[0].title, "Banana", key);
  }
});

test("each sort orders by what it says, and ties fall back to the title", () => {
  const list = [
    snippet({ id: "a", title: "Zebra", order: 2, useCount: 5, lastUsedAt: "2026-01-01T00:00:00.000Z", createdAt: "2020-01-01T00:00:00.000Z" }),
    snippet({ id: "b", title: "Apple", order: 1, useCount: 5, lastUsedAt: "", createdAt: "2026-01-01T00:00:00.000Z" }),
  ];
  assert.deepEqual(titles(sortEntries(list, "manual")), ["Apple", "Zebra"]);
  assert.deepEqual(titles(sortEntries(list, "title")), ["Apple", "Zebra"]);
  // Equal counts, so the title breaks the tie.
  assert.deepEqual(titles(sortEntries(list, "used")), ["Apple", "Zebra"]);
  // Never used sorts last, not first.
  assert.deepEqual(titles(sortEntries(list, "recent")), ["Zebra", "Apple"]);
  assert.deepEqual(titles(sortEntries(list, "added")), ["Apple", "Zebra"]);
});

test("sorting never mutates the list it was given, and a bad key is the default", () => {
  const list = [snippet({ id: "b", title: "B" }), snippet({ id: "a", title: "A" })];
  const out = sortEntries(list, "nonsense" as never);
  assert.deepEqual(titles(out), ["A", "B"], "falls back to A to Z");
  assert.deepEqual(titles(list), ["B", "A"], "the original is untouched");
});

test("a stale sidebar order is repaired rather than obeyed", () => {
  assert.deepEqual(orderedKinds(["note", "alias"]).slice(0, 2), ["note", "alias"]);
  // A kind that no longer exists is dropped, a duplicate counts once, and
  // anything missing follows in registry order, so no kind can be hidden.
  const out = orderedKinds(["note", "gone", "note"]);
  assert.equal(out[0], "note");
  assert.equal(new Set(out).size, out.length);
  assert.deepEqual([...out].sort(), [...orderedKinds([])].sort());
  assert.deepEqual(orderedKinds(), orderedKinds([]));
});

test("a drag moves one item and leaves the rest in order", () => {
  const ids = ["a", "b", "c", "d"];
  assert.deepEqual(moved(ids, 0, 2), ["b", "c", "a", "d"]);
  assert.deepEqual(moved(ids, 3, 0), ["d", "a", "b", "c"]);
  // A no-op returns the same array, which is how the caller skips the write.
  assert.equal(moved(ids, 1, 1), ids);
  assert.equal(moved(ids, -1, 2), ids);
  assert.equal(moved(ids, 0, 9), ids);
});
