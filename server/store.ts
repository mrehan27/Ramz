import { readFile, writeFile, rename, copyFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { LEGACY_KINDS, StoreSchema, entryPlaceholders, type Entry, type EntryInput, type Store } from "../shared/schema.ts";
import { DATA_DIR, PROJECT_ROOT } from "./paths.ts";

/**
 * The store lives outside the repo: entries are personal, the project is not.
 * A missing store is seeded from the example that ships with the repo.
 */
export const STORE_PATH = process.env.RAMZ_STORE ?? path.join(DATA_DIR, "commands.json");
export const SEED_PATH = path.join(PROJECT_ROOT, "data", "commands.example.json");

const EMPTY: Store = { version: 1, entries: [], tagColors: {}, prefs: { showInDock: true, hideOnBlur: true } };

/** tmp + rename so a crash mid-write can't truncate the target. */
export async function writeAtomic(file: string, contents: string) {
  const tmp = `${file}.tmp-${process.pid}`;
  await writeFile(tmp, contents, "utf8");
  await rename(tmp, file);
}

export async function readStore(): Promise<Store> {
  const file = existsSync(STORE_PATH) ? STORE_PATH : existsSync(SEED_PATH) ? SEED_PATH : null;
  if (!file) return EMPTY;
  const raw = await readFile(file, "utf8");
  if (!raw.trim()) return EMPTY;
  const parsed = JSON.parse(raw);
  let migrated = false;
  for (const e of parsed.entries ?? []) {
    const to = LEGACY_KINDS[e.kind];
    if (to) { e.kind = to; migrated = true; }
  }
  const store = StoreSchema.parse(parsed);
  if (migrated && file === STORE_PATH) await writeStore(store);
  return store;
}

export async function writeStore(store: Store) {
  StoreSchema.parse(store);
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
  if (existsSync(STORE_PATH)) await copyFile(STORE_PATH, `${STORE_PATH}.bak`);
  await writeAtomic(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`);
}

/**
 * Adds an argument for any placeholder that lacks one. Never drops arguments:
 * an editor mid-edit should not lose a description it typed a moment ago.
 */
function withDerivedParams<T extends EntryInput>(entry: T): T {
  const known = new Set(entry.params.map((p) => p.name));
  const missing = entryPlaceholders(entry).filter((n) => !known.has(n));
  if (missing.length === 0) return entry;
  return {
    ...entry,
    params: [...entry.params, ...missing.map((name) => ({ name, description: "", default: "", required: true }))],
  };
}

export function newEntry(input: EntryInput): Entry {
  const now = new Date().toISOString();
  return {
    ...withDerivedParams(input),
    id: randomUUID(),
    useCount: 0,
    lastUsedAt: "",
    createdAt: now,
    updatedAt: now,
  };
}

export function mergeEntry(existing: Entry, input: EntryInput): Entry {
  return { ...existing, ...withDerivedParams(input), updatedAt: new Date().toISOString() };
}
