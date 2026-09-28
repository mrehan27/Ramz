import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

// Paths are read once at import, so point them at a temp dir before loading the core.
const dir = mkdtempSync(join(tmpdir(), "ramz-sync-"));
process.env.RAMZ_STORE = join(dir, "store.json");
process.env.RAMZ_DIR = join(dir, "shell");
const core = await import("../server/core.ts");

test("the shell is only up to date when the files exist and match what Sync would write", async () => {
  // A connected rc with nothing on disk once showed green, and `clr` was not found.
  let preview = await core.exportPreview();
  assert.equal(preview.installed, false);
  assert.equal(preview.upToDate, false, "no files is never up to date");

  await core.runExport();
  preview = await core.exportPreview();
  assert.equal(preview.upToDate, true, "the timestamp in the header is not a difference");
  assert.match(preview.syncedAt, /^\d{4}-\d{2}-\d{2}T/);

  await core.createEntry({ kind: "alias", name: "clr", title: "Clear", command: "echo clear", exported: true });
  preview = await core.exportPreview();
  assert.equal(preview.upToDate, false, "a new alias the shell has not seen is out of date");
  assert.equal(preview.installed, true);
});
