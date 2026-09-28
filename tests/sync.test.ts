import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

// Paths are read once at import, so point them at a temp dir before loading the core.
const dir = mkdtempSync(join(tmpdir(), "ramz-sync-"));
process.env.RAMZ_STORE = join(dir, "store.json");
process.env.RAMZ_DIR = join(dir, "shell");
const core = await import("../server/core.ts");

const alias = (name: string) => ({ kind: "alias", name, title: name, command: `echo ${name}`, exported: true });
const onDisk = () => readFileSync(join(dir, "shell", "aliases.sh"), "utf8");

// These run in order and share one store: each starts where the last one left off.

test("auto sync never sets a shell up on its own", async () => {
  await core.createEntry(alias("first"));
  assert.equal(await core.autoSync(), "not set up");
  assert.equal(existsSync(join(dir, "shell")), false, "nothing written before a sync by hand");
});

test("the shell is only up to date when the files exist and match what Sync would write", async () => {
  await core.updatePrefs({ autoSync: false });
  await core.runExport();
  let preview = await core.exportPreview();
  assert.equal(preview.upToDate, true, "the timestamp in the header is not a difference");
  assert.match(preview.syncedAt, /^\d{4}-\d{2}-\d{2}T/);

  // A connected rc with a stale file once showed green, and `clr` was not found.
  await core.createEntry(alias("clr"));
  preview = await core.exportPreview();
  assert.equal(preview.upToDate, false, "an alias the shell has not seen is out of date");
});

test("auto sync keeps it current, and skips rather than write a broken file", async () => {
  await core.updatePrefs({ autoSync: true });
  assert.equal((await core.exportPreview()).upToDate, true, "turning it on catches up straight away");

  const dupe = await core.createEntry(alias("clr"));
  const preview = await core.exportPreview();
  assert.ok(preview.problems.some((p) => p.level === "error"), "two aliases named clr is an export error");
  assert.equal(preview.upToDate, false, "so it was skipped, and says so");
  assert.equal(onDisk().match(/^alias clr=/gm)?.length, 1, "the file on disk is still the good one");

  await core.deleteEntry(dupe.id);
  assert.equal((await core.exportPreview()).upToDate, true, "fixing the error lets it through");
});
