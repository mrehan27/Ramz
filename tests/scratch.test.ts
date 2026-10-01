import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { expiryLabel, isExpired } from "../shared/scratch.ts";
import { parseQuery } from "../shared/query.ts";
import { entry } from "./helpers.ts";

const dir = mkdtempSync(join(tmpdir(), "ramz-scratch-"));
process.env.RAMZ_STORE = join(dir, "store.json");
process.env.RAMZ_DIR = join(dir, "shell");
const core = await import("../server/core.ts");

const DAY = 24 * 60 * 60 * 1000;
const at = (days: number) => new Date(Date.parse("2026-01-01T00:00:00.000Z") + days * DAY).toISOString();
const scratch = (over = {}) => entry({ kind: "scratch", body: "x", createdAt: at(0), updatedAt: at(0), ...over });

test("a scratch expires a set time after it was last edited or copied", () => {
  const now = Date.parse(at(31));
  assert.equal(isExpired(scratch(), 30, now), true);
  assert.equal(isExpired(scratch({ updatedAt: at(10) }), 30, now), false, "an edit resets the clock");
  assert.equal(isExpired(scratch({ lastUsedAt: at(20) }), 30, now), false, "so does a copy");
  assert.equal(isExpired(scratch({ keep: true }), 30, now), false, "kept never expires");
  assert.equal(isExpired(entry({ kind: "prompt", createdAt: at(0), updatedAt: at(0) }), 30, now), false, "only scratch expires");
  assert.equal(isExpired(scratch(), 60, now), false, "the limit is read now, not stored");
  assert.equal(expiryLabel(scratch(), 30, Date.parse(at(18))), "expires in 12 days");
  assert.equal(expiryLabel(scratch(), 30, Date.parse(at(29))), "expires tomorrow");
  assert.equal(expiryLabel(scratch({ keep: true }), 30, Date.parse(at(29))), null);
});

test("the sweep deletes only what has expired, and a shorter limit applies straight away", async () => {
  writeFileSync(process.env.RAMZ_STORE!, JSON.stringify({
    version: 1,
    entries: [
      scratch({ id: "old" }),
      scratch({ id: "kept", keep: true }),
      scratch({ id: "fresh", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
      scratch({ id: "week", createdAt: new Date(Date.now() - 8 * DAY).toISOString(), updatedAt: new Date(Date.now() - 8 * DAY).toISOString() }),
      entry({ id: "prompt", kind: "prompt", body: "x", createdAt: at(0), updatedAt: at(0) }),
    ],
  }));
  assert.deepEqual(await core.sweepScratch(), { removed: 1 });
  assert.deepEqual((await core.listEntries()).map((e) => e.id), ["kept", "fresh", "week", "prompt"]);
  await core.updatePrefs({ scratchDays: 7 });
  assert.deepEqual((await core.listEntries()).map((e) => e.id), ["kept", "fresh", "prompt"]);
});

test("a first letter stays with the kind that had it first", () => {
  assert.deepEqual(parseQuery("s:").kinds, ["snippet"]);
  assert.deepEqual(parseQuery("scratch:").kinds, ["scratch"]);
  assert.deepEqual(parseQuery("pad:").kinds, ["scratch"]);
});
