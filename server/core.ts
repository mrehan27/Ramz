/**
 * Every operation RAMZ can perform, as plain functions. The HTTP server and the
 * Electron IPC layer are both thin adapters over this: one implementation, two
 * ways in.
 *
 * Failures are thrown as RamzError so an adapter can map them to a status or a
 * dialog without knowing anything about the operation.
 */
import { readFile, readdir, stat, mkdir, rm, rmdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  EntryInputSchema, EntrySchema, PrefsSchema, TagColorSchema,
  type Entry, type EntryInput, type Prefs, type TagColor,
} from "../shared/schema.ts";
import { isExportable } from "../shared/kinds.ts";
import { readStore, writeStore, writeAtomic, newEntry, mergeEntry, STORE_PATH } from "./store.ts";
import { RAMZ_DIR, GENERATED, RC_FILES, aliasesPath, loaderPath, sourceLine } from "./paths.ts";
import {
  HEADER, renderAliases, renderLoader, validateForExport, shadowCheck, parseShellFile,
  findSourceLines, withSourceLine, withoutSourceLine,
} from "./shell.ts";

export class RamzError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

/** Files worth offering as import sources. */
const IMPORT_CANDIDATES = [path.join(path.dirname(RC_FILES[0]), ".aliases"), ...RC_FILES];

async function rcStatus() {
  return Promise.all(RC_FILES.map(async (file) => {
    const exists = existsSync(file);
    const text = exists ? await readFile(file, "utf8") : "";
    return { file, name: path.basename(file), exists, hasLine: findSourceLines(text).length > 0 };
  }));
}

export async function getConfig() {
  return {
    prefs: (await readStore()).prefs,
    configDir: RAMZ_DIR,
    aliasesFile: aliasesPath(),
    loaderFile: loaderPath(),
    storePath: STORE_PATH,
    installed: existsSync(loaderPath()),
    sourceLine: sourceLine(),
    rc: await rcStatus(),
    importCandidates: IMPORT_CANDIDATES.filter((f) => existsSync(f)),
  };
}

export async function listEntries(): Promise<Entry[]> {
  return (await readStore()).entries;
}

export async function createEntry(input: unknown): Promise<Entry> {
  const parsed = EntryInputSchema.safeParse(input);
  if (!parsed.success) throw new RamzError(parsed.error.issues[0].message);
  const entry = newEntry(parsed.data);
  const check = EntrySchema.safeParse(entry);
  if (!check.success) throw new RamzError(check.error.issues[0].message);
  const store = await readStore();
  store.entries.push(entry);
  await writeStore(store);
  return entry;
}

export async function updateEntry(id: string, input: unknown): Promise<Entry> {
  const parsed = EntryInputSchema.safeParse(input);
  if (!parsed.success) throw new RamzError(parsed.error.issues[0].message);
  const store = await readStore();
  const idx = store.entries.findIndex((e) => e.id === id);
  if (idx === -1) throw new RamzError("not found", 404);
  const merged = mergeEntry(store.entries[idx], parsed.data);
  const check = EntrySchema.safeParse(merged);
  if (!check.success) throw new RamzError(check.error.issues[0].message);
  store.entries[idx] = merged;
  await writeStore(store);
  return merged;
}

export async function deleteEntry(id: string) {
  const store = await readStore();
  const next = store.entries.filter((e) => e.id !== id);
  if (next.length === store.entries.length) throw new RamzError("not found", 404);
  await writeStore({ ...store, entries: next });
  return { ok: true as const };
}

/** Copying is the only signal of use this tool gets, so it is worth recording. */
export async function markUsed(id: string) {
  const store = await readStore();
  const entry = store.entries.find((e) => e.id === id);
  if (!entry) throw new RamzError("not found", 404);
  entry.useCount += 1;
  entry.lastUsedAt = new Date().toISOString();
  await writeStore(store);
  return { id: entry.id, useCount: entry.useCount, lastUsedAt: entry.lastUsedAt };
}

export async function resetUsage() {
  const store = await readStore();
  let cleared = 0;
  for (const e of store.entries) {
    if (e.useCount === 0 && !e.lastUsedAt) continue;
    e.useCount = 0;
    e.lastUsedAt = "";
    cleared++;
  }
  await writeStore(store);
  return { cleared };
}

export async function getPrefs(): Promise<Prefs> {
  return (await readStore()).prefs;
}

/** Partial update: the caller sends only what changed. */
export async function updatePrefs(input: unknown): Promise<Prefs> {
  const parsed = PrefsSchema.partial().safeParse(input);
  if (!parsed.success) throw new RamzError(parsed.error.issues[0].message);
  const store = await readStore();
  store.prefs = { ...store.prefs, ...parsed.data };
  await writeStore(store);
  return store.prefs;
}

export async function getTags(): Promise<Record<string, TagColor>> {
  return (await readStore()).tagColors;
}

export async function setTagColor(name: string, color: unknown) {
  const parsed = TagColorSchema.nullable().safeParse(color ?? null);
  if (!parsed.success) throw new RamzError("unknown colour");
  const store = await readStore();
  if (parsed.data) store.tagColors[name] = parsed.data;
  else delete store.tagColors[name];
  await writeStore(store);
  return store.tagColors;
}

const TagName = z.string().trim().min(1).max(40).refine((v) => !v.includes(","), "no commas in tag names");

/** Renaming or deleting a tag has to rewrite every entry carrying it. */
async function editTag(name: string, to: string | null) {
  const store = await readStore();
  let touched = 0;
  for (const e of store.entries) {
    if (!e.tags.includes(name)) continue;
    const kept = e.tags.filter((t) => t !== name);
    e.tags = to && !kept.includes(to) ? [...kept, to] : kept;
    e.updatedAt = new Date().toISOString();
    touched++;
  }
  const color = store.tagColors[name];
  delete store.tagColors[name];
  if (to && color && !store.tagColors[to]) store.tagColors[to] = color;
  await writeStore(store);
  return { touched, tagColors: store.tagColors };
}

export async function renameTag(name: string, to: unknown) {
  const parsed = TagName.safeParse(to);
  if (!parsed.success) throw new RamzError(parsed.error.issues[0].message);
  return editTag(name, parsed.data);
}

export async function deleteTag(name: string) {
  return editTag(name, null);
}

export async function exportPreview() {
  const { entries } = await readStore();
  const exportable = entries.filter(isExportable);
  const problems = validateForExport(exportable);
  const shadows = await shadowCheck(exportable.map((e) => e.name));
  for (const [name, resolved] of Object.entries(shadows)) {
    problems.push({ name, level: "warn", message: `shadows an existing command (${resolved})` });
  }
  return {
    aliases: renderAliases(entries),
    loader: renderLoader(),
    count: exportable.length,
    problems,
    configDir: RAMZ_DIR,
    aliasesFile: aliasesPath(),
    loaderFile: loaderPath(),
    installed: existsSync(loaderPath()),
  };
}

/** Writes only inside RAMZ_DIR: the loader, plus one file per generated group. */
export async function runExport() {
  const preview = await exportPreview();
  if (preview.problems.some((p) => p.level === "error")) throw new RamzError("fix the errors before exporting");
  await mkdir(RAMZ_DIR, { recursive: true });
  await writeAtomic(loaderPath(), preview.loader);
  await writeAtomic(aliasesPath(), preview.aliases);
  return { ok: true as const, count: preview.count, configDir: RAMZ_DIR, loaderFile: loaderPath() };
}

/** Deletes what RAMZ generated and nothing else. The directory goes too if it is empty. */
export async function removeGenerated() {
  const removed: string[] = [];
  const kept: string[] = [];
  for (const file of [loaderPath(), ...GENERATED.map((f) => path.join(RAMZ_DIR, f))]) {
    if (!existsSync(file)) continue;
    if (!(await readFile(file, "utf8")).startsWith(HEADER)) { kept.push(file); continue; }
    await rm(file);
    removed.push(file);
  }
  let dirRemoved = false;
  if (existsSync(RAMZ_DIR)) dirRemoved = await rmdir(RAMZ_DIR).then(() => true, () => false);
  return { removed, kept, dirRemoved };
}

/** The one line in a shell rc. Only ever touches a known rc file, one line at a time. */
export async function rcAction(file: string, action: "install" | "remove") {
  if (!RC_FILES.includes(file)) throw new RamzError("not a shell rc file");
  const before = existsSync(file) ? await readFile(file, "utf8") : "";
  if (action === "remove" && !existsSync(file)) throw new RamzError("file does not exist", 404);
  const after = action === "install" ? withSourceLine(before, sourceLine()) : withoutSourceLine(before);
  if (after !== before) await writeAtomic(file, after);
  return { ok: true as const, changed: after !== before, rc: await rcStatus() };
}

/** Files worth scanning inside a directory: text, not hidden, not ours. */
async function scanTargets(target: string): Promise<string[]> {
  if (!(await stat(target)).isDirectory()) return [target];
  const names = await readdir(target);
  const files: string[] = [];
  for (const name of names.sort()) {
    if (name.startsWith(".")) continue;
    const full = path.join(target, name);
    if (!(await stat(full)).isFile()) continue;
    files.push(full);
  }
  return files;
}

export async function importScan(target?: string) {
  const chosen = target ?? IMPORT_CANDIDATES.find((f) => existsSync(f)) ?? "";
  const candidates = IMPORT_CANDIDATES.filter((f) => existsSync(f));
  if (!chosen || !existsSync(chosen)) return { target: chosen, candidates, sources: [] };

  const known = new Set((await readStore()).entries.filter((e) => e.kind === "alias").map((e) => e.name));
  const sources = [];
  for (const file of await scanTargets(chosen)) {
    const text = await readFile(file, "utf8");
    if (text.includes("\u0000")) continue;
    const { found, skipped } = parseShellFile(text);
    if (found.length === 0 && skipped.length === 0) continue;
    sources.push({
      file,
      name: path.basename(file),
      skipped,
      found: found.map((f) => ({ ...f, status: known.has(f.name) ? "duplicate" : "new" })),
    });
  }
  return { target: chosen, candidates, sources };
}

const ImportBody = z.object({
  entries: z.array(z.object({
    name: z.string(),
    command: z.string(),
    asFunction: z.boolean().default(false),
    title: z.string().default(""),
    description: z.string().default(""),
    tags: z.array(z.string()).default([]),
    params: z.array(z.object({
      name: z.string(),
      default: z.string().default(""),
      required: z.boolean().default(false),
    })).default([]),
  })),
});

export async function runImport(payload: unknown) {
  const parsed = ImportBody.safeParse(payload);
  if (!parsed.success) throw new RamzError(parsed.error.issues[0].message);
  const store = await readStore();
  const added: Entry[] = [];
  const rejected: { name: string; reason: string }[] = [];
  for (const item of parsed.data.entries) {
    const input: EntryInput = {
      kind: "alias",
      name: item.name,
      title: item.title || item.name,
      description: item.description,
      tags: item.tags.length ? item.tags : ["imported"],
      command: item.command,
      params: item.params.map((p) => ({ ...p, description: "" })),
      steps: [],
      body: "",
      asFunction: item.asFunction,
      pinned: false,
      archived: false,
      exported: true,
    };
    const entry = newEntry(input);
    const check = EntrySchema.safeParse(entry);
    if (check.success) added.push(entry);
    else rejected.push({ name: item.name, reason: check.error.issues[0].message });
  }
  store.entries.push(...added);
  await writeStore(store);
  return { added: added.length, entries: added, rejected };
}
