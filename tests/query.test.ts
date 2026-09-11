import assert from "node:assert/strict";
import test from "node:test";
import { kind } from "../shared/kinds.ts";
import { matchesFilters, parseQuery } from "../shared/query.ts";
import { entry } from "./helpers.ts";

test("a kind is named by its id, plural, singular or first letter", () => {
  for (const word of ["prompt", "prompts", "p"]) {
    assert.deepEqual(parseQuery(`${word}:`).kinds, ["prompt"], word);
  }
  // One word can name two kinds: both are things you run.
  assert.deepEqual(parseQuery("cmd:").kinds.sort(), ["alias", "snippet"]);
});

test("filters and text can be typed in any order, together or apart", () => {
  assert.deepEqual(parseQuery("prompt: release"), { kinds: ["prompt"], tags: [], text: "release" });
  assert.deepEqual(parseQuery("prompt:release"), { kinds: ["prompt"], tags: [], text: "release" });
  assert.deepEqual(parseQuery("#git deploy"), { kinds: [], tags: ["git"], text: "deploy" });
  assert.deepEqual(parseQuery("cmd: #ios build").tags, ["ios"]);
});

test("a colon that is not a filter stays part of the search", () => {
  assert.deepEqual(parseQuery("http://localhost:3000"), { kinds: [], tags: [], text: "http://localhost:3000" });
});

test("tags match on a prefix, kinds exactly", () => {
  const e = entry({ kind: "snippet", tags: ["android", "ci"] });
  assert.equal(matchesFilters(e, parseQuery("#and")), true);
  assert.equal(matchesFilters(e, parseQuery("#andx")), false);
  assert.equal(matchesFilters(e, parseQuery("cmd:")), true);
  assert.equal(matchesFilters(e, parseQuery("prompt:")), false);
  // Several tags all have to match.
  assert.equal(matchesFilters(e, parseQuery("#android #ci")), true);
  assert.equal(matchesFilters(e, parseQuery("#android #nope")), false);
});

test("long bodies are indexed for literal matching, never fuzzy", () => {
  // Fuzzy matching a page of prose matches almost any query, which made every
  // prompt match every search. Bodies belong in `text`, which is a substring match.
  for (const id of ["prompt", "note"] as const) {
    const e = entry({ kind: id, body: "a long body", title: "t" });
    const doc = kind(id).search(e);
    assert.deepEqual(doc.text, doc.text?.filter(Boolean), "text is populated");
    assert.ok(doc.text?.includes("a long body"), `${id} indexes its body as text`);
    assert.ok(!doc.weak.includes("a long body"), `${id} keeps its body out of the fuzzy keys`);
  }
});
