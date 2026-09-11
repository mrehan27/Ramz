/**
 * The portable Ramz file: what export writes, what import reads, and the rules
 * for merging one into a store that already has entries.
 *
 * Plain JSON on purpose. A full store is around 100 KB and gzips to 16, so
 * compressing it buys nothing worth the cost of a file you cannot read, diff or
 * fix by hand. Import still accepts a gzipped file, because someone will.
 *
 * Everything here is pure: no fs, no crypto, no clock. Ids and timestamps
 * arrive as arguments so the same code runs in the browser, in the server and
 * in a test.
 */
import { z } from "zod";
import { EntrySchema, TagColorSchema, type Entry, type TagColor } from "./schema.ts";

export const TRANSFER_VERSION = 1;

/**
 * A file written by us has every field. A file written by hand may have only
 * the interesting ones, so identity and timestamps are filled in later.
 */
const LooseEntry = z
  .object({
    id: z.string().default(""),
    createdAt: z.string().default(""),
    updatedAt: z.string().default(""),
  })
  .passthrough();

const TransferSchema = z.object({
  ramz: z.number().int().positive(),
  exportedAt: z.string().default(""),
  entries: z.array(LooseEntry).default([]),
  tagColors: z.record(z.string(), TagColorSchema).default({}),
});

export type Transfer = { ramz: number; exportedAt: string; entries: Entry[]; tagColors: Record<string, TagColor> };

/** What to do with one incoming entry that already exists here. */
export type Resolution = "skip" | "overwrite" | "keepBoth";

export type Conflict = {
  /** Stable handle for the UI and for the resolution map. */
  key: string;
  incoming: Entry;
  existing: Entry;
  /** Same entry travelling between machines, or two entries that merely agree on a title. */
  match: "id" | "title";
};

export type Plan = {
  fresh: Entry[];
  conflicts: Conflict[];
  /** Tag colours the file knows about and this store does not. */
  newTags: string[];
};

export type Applied = {
  entries: Entry[];
  tagColors: Record<string, TagColor>;
  added: number;
  overwritten: number;
  skipped: number;
  copied: number;
};

export function buildTransfer(entries: Entry[], tagColors: Record<string, TagColor>, now: string) {
  const used = new Set(entries.flatMap((e) => e.tags));
  return {
    ramz: TRANSFER_VERSION,
    exportedAt: now,
    entries,
    // Colours for tags nobody exported are noise in the file.
    tagColors: Object.fromEntries(Object.entries(tagColors).filter(([tag]) => used.has(tag))),
  };
}

/**
 * Reads a file's contents into entries this store could hold. Rejects the whole
 * file rather than silently dropping an entry: a partial import is worse than a
 * clear refusal, because you cannot tell what you lost.
 */
export function parseTransfer(raw: unknown, now: string, mintId: () => string): Transfer {
  const file = TransferSchema.safeParse(raw);
  if (!file.success) {
    throw new Error(`this is not a Ramz file: ${file.error.issues[0].message}`);
  }
  if (file.data.ramz > TRANSFER_VERSION) {
    throw new Error(`the file says version ${file.data.ramz}, and this Ramz understands ${TRANSFER_VERSION}`);
  }
  const entries: Entry[] = [];
  file.data.entries.forEach((loose, i) => {
    const filled = {
      ...loose,
      id: loose.id || mintId(),
      createdAt: loose.createdAt || now,
      updatedAt: loose.updatedAt || now,
    };
    const parsed = EntrySchema.safeParse(filled);
    if (!parsed.success) {
      const where = typeof loose.title === "string" && loose.title ? `"${loose.title}"` : `entry ${i + 1}`;
      throw new Error(`${where}: ${parsed.error.issues[0].message}`);
    }
    entries.push(parsed.data);
  });
  return { ...file.data, entries };
}

const titleKey = (e: { kind: string; title: string }) => `${e.kind}:${e.title.trim().toLowerCase()}`;

/**
 * Sorts incoming entries into ones that are simply new here and ones that
 * collide. Two entries collide when they share an id, which is the same entry
 * arriving from another machine, or when they share a kind and a title, which
 * is the same idea written twice.
 */
export function planImport(incoming: Entry[], existing: Entry[], tagColors: Record<string, TagColor> = {}, mine: Record<string, TagColor> = {}): Plan {
  const byId = new Map(existing.map((e) => [e.id, e]));
  const byTitle = new Map(existing.map((e) => [titleKey(e), e]));
  const fresh: Entry[] = [];
  const conflicts: Conflict[] = [];

  for (const entry of incoming) {
    const sameId = byId.get(entry.id);
    const sameTitle = byTitle.get(titleKey(entry));
    if (sameId) conflicts.push({ key: entry.id, incoming: entry, existing: sameId, match: "id" });
    else if (sameTitle) conflicts.push({ key: entry.id, incoming: entry, existing: sameTitle, match: "title" });
    else fresh.push(entry);
  }

  return { fresh, conflicts, newTags: Object.keys(tagColors).filter((t) => !(t in mine)) };
}

function uniqueTitle(title: string, taken: Set<string>) {
  if (!taken.has(title.toLowerCase())) return title;
  for (let n = 2; ; n++) {
    const next = n === 2 ? `${title} (imported)` : `${title} (imported ${n - 1})`;
    if (!taken.has(next.toLowerCase())) return next;
  }
}

/**
 * Applies a plan. `choose` is asked per conflict so the caller can offer one
 * answer for everything or a different answer for each.
 *
 * Overwrite takes the incoming content but keeps what is local about the entry
 * it replaces: its id, when it was created here, and its usage counters. A file
 * from another machine knows nothing about how often you copied this one.
 */
export function applyImport(
  existing: Entry[],
  plan: Plan,
  choose: (conflict: Conflict) => Resolution,
  now: string,
  mintId: () => string,
  tagColors: Record<string, TagColor> = {},
  incomingColors: Record<string, TagColor> = {},
): Applied {
  const entries = [...existing];
  const at = new Map(entries.map((e, i) => [e.id, i]));
  const titles = new Set(entries.map((e) => e.title.toLowerCase()));
  let added = 0;
  let overwritten = 0;
  let skipped = 0;
  let copied = 0;

  for (const entry of plan.fresh) {
    entries.push(entry);
    at.set(entry.id, entries.length - 1);
    titles.add(entry.title.toLowerCase());
    added++;
  }

  for (const conflict of plan.conflicts) {
    const { incoming, existing: mine } = conflict;
    switch (choose(conflict)) {
      case "skip":
        skipped++;
        break;
      case "overwrite": {
        const i = at.get(mine.id);
        if (i === undefined) break;
        entries[i] = {
          ...incoming,
          id: mine.id,
          createdAt: mine.createdAt,
          useCount: mine.useCount,
          lastUsedAt: mine.lastUsedAt,
          updatedAt: now,
        };
        overwritten++;
        break;
      }
      case "keepBoth": {
        const title = uniqueTitle(incoming.title, titles);
        const entry = { ...incoming, id: mintId(), title, createdAt: now, updatedAt: now, useCount: 0, lastUsedAt: "" };
        entries.push(entry);
        at.set(entry.id, entries.length - 1);
        titles.add(title.toLowerCase());
        copied++;
        break;
      }
    }
  }

  // A colour this store already chose for a tag wins: it is a local preference.
  const colors = { ...incomingColors, ...tagColors };
  return { entries, tagColors: colors, added, overwritten, skipped, copied };
}
