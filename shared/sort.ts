/**
 * How a list is ordered, and the order of the kinds themselves.
 *
 * The old order was pinned first then alphabetical, with nothing on screen
 * saying so, which reads as arbitrary. Now it is a choice per kind, stored in
 * prefs, and the control says which one is on.
 *
 * Pinned entries stay on top in every sort, manual included: pinning is how you
 * say "this one first", and a drag moves an entry within its own group.
 */
import { KIND_IDS, type KindId } from "./kinds.ts";
import type { Entry } from "./schema.ts";

export const SORT_KEYS = ["manual", "title", "recent", "used", "added"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const DEFAULT_SORT: SortKey = "title";

export const SORTS: { key: SortKey; label: string; hint: string }[] = [
  { key: "manual", label: "My order", hint: "Drag entries into the order you want" },
  { key: "title", label: "A to Z", hint: "By title" },
  { key: "recent", label: "Recently used", hint: "Last copied first, never copied last" },
  { key: "used", label: "Most used", hint: "By how often you have copied it" },
  { key: "added", label: "Newest", hint: "Most recently added first" },
];

const byTitle = (a: Entry, b: Entry) => a.title.localeCompare(b.title);

/** Empty strings sort last: never used is not the same as used long ago. */
const newestFirst = (a: string, b: string) => (a && b ? b.localeCompare(a) : a ? -1 : b ? 1 : 0);

const COMPARE: Record<SortKey, (a: Entry, b: Entry) => number> = {
  manual: (a, b) => a.order - b.order || byTitle(a, b),
  title: byTitle,
  recent: (a, b) => newestFirst(a.lastUsedAt, b.lastUsedAt) || byTitle(a, b),
  used: (a, b) => b.useCount - a.useCount || byTitle(a, b),
  added: (a, b) => newestFirst(a.createdAt, b.createdAt) || byTitle(a, b),
};

export const sortKey = (value: unknown): SortKey =>
  SORT_KEYS.includes(value as SortKey) ? (value as SortKey) : DEFAULT_SORT;

/** Pinned first, then the chosen order within each group. */
export function sortEntries(entries: Entry[], key: SortKey = DEFAULT_SORT) {
  const compare = COMPARE[sortKey(key)];
  return [...entries].sort((a, b) => (a.pinned === b.pinned ? compare(a, b) : a.pinned ? -1 : 1));
}

/**
 * The kinds in the order the sidebar should show them. A stored order that has
 * gone stale, because a kind was added or removed, is repaired rather than
 * rejected: what it names comes first, anything new follows in registry order.
 */
export function orderedKinds(stored: readonly string[] = []): KindId[] {
  const known = stored.filter((id, i): id is KindId =>
    KIND_IDS.includes(id as KindId) && stored.indexOf(id) === i,
  );
  return [...known, ...KIND_IDS.filter((id) => !known.includes(id))];
}

/** A list reordered by dragging `from` onto `to`. */
export function moved<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}
