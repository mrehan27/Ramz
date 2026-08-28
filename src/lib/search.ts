import Fuse from "fuse.js";
import { useMemo } from "react";
import { kind } from "../../shared/kinds.ts";
import type { Entry } from "../../shared/schema.ts";

/**
 * One index over every kind. What goes into it is the kind's business: each
 * returns the strings it wants matched, in three weights.
 */
function document(entry: Entry) {
  const doc = kind(entry.kind).search(entry);
  return {
    entry,
    primary: doc.primary.filter(Boolean),
    strong: doc.strong.filter(Boolean),
    weak: doc.weak.filter(Boolean),
  };
}

export function useSearch(entries: Entry[], query: string, tag: string | null) {
  const scoped = useMemo(
    () => (tag ? entries.filter((e) => e.tags.includes(tag)) : entries),
    [entries, tag],
  );

  const fuse = useMemo(
    () =>
      new Fuse(scoped.map(document), {
        threshold: 0.35,
        ignoreLocation: true,
        keys: [
          { name: "primary", weight: 3 },
          { name: "strong", weight: 2 },
          { name: "weak", weight: 1 },
        ],
      }),
    [scoped],
  );

  return useMemo(() => {
    const q = query.trim();
    if (!q) return scoped;
    return fuse.search(q).map((r) => r.item.entry);
  }, [fuse, query, scoped]);
}

export function allTags(entries: Entry[]) {
  return [...new Set(entries.flatMap((e) => e.tags))].sort();
}
