/**
 * What you typed into a search box, split into filters and the text to match.
 *
 * `prompt: parity` narrows to prompts and searches for "parity"; `#git` narrows
 * to a tag. Filters are additive and can be typed in any order, and anything that
 * is not a filter stays as search text, so a query containing a colon (a URL, a
 * ratio) still searches for itself.
 */
import { KINDS, type KindId } from "./kinds.ts";

export type Filters = { kinds: KindId[]; tags: string[]; text: string };

/** Every word that names a kind. One word may name more than one: `cmd` is both. */
const KEYWORDS = (() => {
  const map = new Map<string, KindId[]>();
  for (const k of KINDS) {
    const words = new Set([
      k.id, `${k.id}s`, k.singular.toLowerCase(), k.plural.toLowerCase(), k.id[0],
      ...(k.keywords ?? []),
    ]);
    for (const word of words) map.set(word, [...(map.get(word) ?? []), k.id]);
  }
  return map;
})();

export const KIND_FILTERS = [...KEYWORDS.keys()].sort();

export function parseQuery(raw: string): Filters {
  const kinds = new Set<KindId>();
  const tags: string[] = [];
  const rest: string[] = [];

  for (const token of raw.split(/\s+/)) {
    if (!token) continue;
    if (token.startsWith("#") && token.length > 1) {
      tags.push(token.slice(1).toLowerCase());
      continue;
    }
    const colon = token.indexOf(":");
    const named = colon > 0 ? KEYWORDS.get(token.slice(0, colon).toLowerCase()) : undefined;
    if (named) {
      for (const id of named) kinds.add(id);
      // `prompt:parity` filters and searches in one word.
      const after = token.slice(colon + 1);
      if (after) rest.push(after);
      continue;
    }
    rest.push(token);
  }

  return { kinds: [...kinds], tags, text: rest.join(" ").trim() };
}

export const hasFilters = (f: Filters) => f.kinds.length > 0 || f.tags.length > 0;

/** Tags match on a prefix, so `#and` finds `android` without the whole word. */
export function matchesFilters(entry: { kind: string; tags: string[] }, f: Filters) {
  if (f.kinds.length > 0 && !f.kinds.includes(entry.kind as KindId)) return false;
  return f.tags.every((t) => entry.tags.some((x) => x.toLowerCase().startsWith(t)));
}
