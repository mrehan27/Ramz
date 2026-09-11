import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { EntrySchema, defaultVariant, needsFill, resolveCommand } from "../shared/schema.ts";
import { valuesFor } from "../src/components/VariantPicker.tsx";
import { entry, param } from "./helpers.ts";

test("each kind states its own requirements, and the schema enforces them", () => {
  const bad = [
    ["an alias needs a shell name", entry({ kind: "alias", name: "", command: "x" })],
    ["an alias name has to be one the shell accepts", entry({ kind: "alias", name: "no spaces", command: "x" })],
    ["a prompt needs a body", entry({ kind: "prompt", body: "" })],
    ["a runbook needs a step", entry({ kind: "runbook", steps: [] })],
  ] as const;
  for (const [why, e] of bad) assert.equal(EntrySchema.safeParse(e).success, false, why);
  assert.equal(EntrySchema.safeParse(entry({ kind: "alias", name: "gcm", command: "x" })).success, true);
});

test("only one variant can be the default", () => {
  const two = entry({
    kind: "prompt",
    body: "b {{x}}",
    params: [param("x")],
    variants: [
      { name: "A", description: "", values: {}, isDefault: true },
      { name: "B", description: "", values: {}, isDefault: true },
    ],
  });
  const result = EntrySchema.safeParse(two);
  assert.equal(result.success, false);
  assert.match(result.error!.issues.map((i) => i.message).join(" "), /only one variant can be the default/);
});

test("switching variant keeps what was typed by hand", () => {
  // Losing the version on a platform switch silently disabled Copy.
  const variants = [
    { name: "Android", description: "", values: { sdk: "android" }, isDefault: false },
    { name: "iOS", description: "", values: { sdk: "ios" }, isDefault: false },
  ];
  const typed = { sdk: "android", version: "1.2.3" };
  assert.deepEqual(valuesFor(variants, variants[1], typed), { version: "1.2.3", sdk: "ios" });
  // Custom clears what the variants own and keeps the rest.
  assert.deepEqual(valuesFor(variants, null, typed), { version: "1.2.3" });
});

test("a default variant is what opens, and variants always ask first", () => {
  const variants = [
    { name: "A", description: "", values: {}, isDefault: false },
    { name: "B", description: "", values: {}, isDefault: true },
  ];
  assert.equal(defaultVariant(variants)?.name, "B");
  assert.equal(defaultVariant([]), null);
  // Every placeholder has a default, so only the variant choice stops a straight copy.
  assert.equal(needsFill({ params: [param("x", "1")], variants: [] }), false);
  assert.equal(needsFill({ params: [param("x", "1")], variants }), true);
  assert.equal(needsFill({ params: [param("x")], variants: [] }), true);
});

test("an unfilled placeholder is left visible rather than dropped", () => {
  const params = [param("a"), param("b", "fallback")];
  assert.equal(resolveCommand("run {{a}} {{b}}", params, {}), "run {{a}} fallback");
  assert.equal(resolveCommand("run {{a}} {{b}}", params, { a: "x", b: "y" }), "run x y");
});

test("entries written before runbooks were called runbooks still load", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ramz-store-"));
  const file = join(dir, "commands.json");
  writeFileSync(file, JSON.stringify({
    version: 1,
    entries: [{ ...entry({ id: "1", kind: "runbook", steps: [{ title: "s", body: "", command: "" }] }), kind: "process" }],
  }));
  process.env.RAMZ_STORE = file;
  const { readStore } = await import("../server/store.ts");
  const store = await readStore();
  assert.equal(store.entries[0].kind, "runbook");
  assert.equal(store.entries[0].variants.length, 0, "a field added later defaults rather than failing");
});
