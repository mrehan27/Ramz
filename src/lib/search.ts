import Fuse from "fuse.js";
import { useMemo } from "react";
import { kind } from "../../shared/kinds.ts";
import { hasFilters, matchesFilters, parseQuery } from "../../shared/query.ts";
import type { Entry } from "../../shared/schema.ts";

/**
 * One index over every kind. What goes into it is the kind's business: each
 * returns the strings it wants matched, in three fuzzy weights plus `text`.
 *
 * `text` is the long stuff, a prompt body or a note, and is matched as a plain
 * substring. Fuzzy matching over a page of prose finds a match for almost any
 * query, so indexing a prompt body that way made every prompt match everything.
 */
function document(entry: Entry) {
  const doc = kind(entry.kind).search(entry);
  return {
    entry,
    primary: doc.primary.filter(Boolean),
    strong: doc.strong.filter(Boolean),
    weak: doc.weak.filter(Boolean),
    text: (doc.text ?? []).join("\n").toLowerCase(),
  };
}

export function useSearch(entries: Entry[], query: string, tag: string | null) {
  // `prompt:` and `#tag` narrow the pool; what is left of the query searches it.
  const filters = useMemo(() => parseQuery(query), [query]);

  const scoped = useMemo(() => {
    const chosen = tag ? entries.filter((e) => e.tags.includes(tag)) : entries;
    return hasFilters(filters) ? chosen.filter((e) => matchesFilters(e, filters)) : chosen;
  }, [entries, tag, filters]);

  const docs = useMemo(() => scoped.map(document), [scoped]);

  const fuse = useMemo(
    () =>
      new Fuse(docs, {
        threshold: 0.35,
        ignoreLocation: true,
        keys: [
          { name: "primary", weight: 3 },
          { name: "strong", weight: 2 },
          { name: "weak", weight: 1 },
        ],
      }),
    [docs],
  );

  return useMemo(() => {
    const q = filters.text;
    if (!q) return scoped;
    const ranked = fuse.search(q).map((r) => r.item.entry);
    // Then anything whose body actually contains what you typed, below the
    // ranked hits rather than mixed into them.
    const found = new Set(ranked.map((e) => e.id));
    const needle = q.toLowerCase();
    const inText = docs
      .filter((d) => !found.has(d.entry.id) && d.text.includes(needle))
      .map((d) => d.entry);
    return [...ranked, ...inText];
  }, [docs, fuse, filters.text, scoped]);
}

/** Pinned first, then alphabetical. Search order wins when there is a query. */
export function byPin(a: Entry, b: Entry) {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  return a.title.localeCompare(b.title);
}

/** Whether anything was typed beyond the filters, so relevance order matters. */
export const isTextSearch = (query: string) => parseQuery(query).text.length > 0;

export function allTags(entries: Entry[]) {
  return [...new Set(entries.flatMap((e) => e.tags))].sort();
}
