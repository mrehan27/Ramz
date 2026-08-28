import { useEffect, useMemo, useRef, useState } from "react";
import { kind } from "../../shared/kinds.ts";
import { resolveCommand, type Entry, type TagColor } from "../../shared/schema.ts";
import { useSearch } from "../lib/search.ts";
import { Input, cx } from "./ui.tsx";
import { TagBadge } from "./TagBadge.tsx";
import { useToast } from "./Toast.tsx";

const LIMIT = 8;

/**
 * ⌘K lookup: type, Enter, the command is on the clipboard. Commands that take
 * arguments open a second step rather than copying a template with holes in it.
 */
export function Palette({
  entries, tagColors, onClose, onUsed, embedded = false,
}: {
  entries: Entry[];
  tagColors: Record<string, TagColor>;
  onClose: () => void;
  onUsed?: (id: string) => void;
  /** Fills its container instead of floating over one, as the menubar panel does. */
  embedded?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [target, setTarget] = useState<Entry | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const toast = useToast();
  const firstArg = useRef<HTMLInputElement>(null);

  // Kinds decide whether they belong here: a runbook is steps, not one line, so
  // there is nothing to copy in one go. Archived entries stay out of the way
  // until the query proves you want them.
  const searching = query.trim().length > 0;
  const copyable = useMemo(
    () => entries.filter((e) => kind(e.kind).inPalette && (searching || !e.archived)),
    [entries, searching],
  );
  const found = useSearch(copyable, query, null);
  const results = useMemo(() => {
    if (searching) return found.slice(0, LIMIT);
    // Nothing typed yet: pinned first, then whatever you actually reach for.
    return [...found]
      .sort((a, b) =>
        a.pinned !== b.pinned ? (a.pinned ? -1 : 1)
        : b.useCount !== a.useCount ? b.useCount - a.useCount
        : a.title.localeCompare(b.title))
      .slice(0, LIMIT);
  }, [found, searching]);

  useEffect(() => setCursor(0), [query]);
  useEffect(() => { if (target) firstArg.current?.focus(); }, [target]);

  const copy = (text: string, entry: Entry) => {
    void navigator.clipboard.writeText(text);
    onUsed?.(entry.id);
    toast({ title: `Copied ${entry.name || entry.title}`, body: text.split("\n")[0].slice(0, 90) });
    onClose();
  };

  const choose = (entry: Entry) => {
    const needsInput = entry.params.some((p) => !p.default);
    if (!needsInput) {
      copy(resolveCommand(entry.command, entry.params, {}), entry);
      return;
    }
    setValues({});
    setTarget(entry);
  };

  const missing = target?.params.filter((p) => !values[p.name]?.trim() && !p.default) ?? [];
  const resolved = target ? resolveCommand(target.command, target.params, values) : "";

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      target ? setTarget(null) : onClose();
      return;
    }
    if (target) {
      if (e.key === "Enter" && missing.length === 0) copy(resolved, target);
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    if (e.key === "Enter" && results[cursor]) { e.preventDefault(); choose(results[cursor]); }
  };

  return (
    <div
      className={embedded
        ? "flex h-full flex-col"
        : "fixed inset-0 z-[70] flex items-start justify-center bg-black/40 p-6 pt-[12vh]"}
      onClick={embedded ? undefined : onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKey}
        className={embedded
          ? "flex h-full min-h-0 flex-col overflow-hidden bg-white dark:bg-neutral-900"
          : "w-full max-w-xl overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"}
      >
        {!target ? (
          <>
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a command…"
              className="rounded-none border-0 border-b border-neutral-200 py-3 text-base focus:border-neutral-200 dark:border-neutral-800 dark:focus:border-neutral-800"
            />
            <ul className={embedded ? "flex-1 overflow-y-auto p-1.5" : "max-h-80 overflow-y-auto p-1.5"}>
              {results.map((e, i) => (
                <li key={e.id}>
                  <button
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => choose(e)}
                    className={cx(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left",
                      i === cursor ? "bg-neutral-100 dark:bg-neutral-800" : "",
                    )}
                  >
                    {e.name && (
                      <span className="font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-400">{e.name}</span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm">{e.title}</span>
                    {e.params.length > 0 && (
                      <span className="shrink-0 text-[11px] text-amber-600 dark:text-amber-400">
                        {e.params.length} arg{e.params.length > 1 ? "s" : ""}
                      </span>
                    )}
                    {e.archived && <span className="shrink-0 text-[11px] text-neutral-400">archived</span>}
                    {e.tags[0] && <TagBadge tag={e.tags[0]} color={tagColors[e.tags[0]]} className="shrink-0" />}
                  </button>
                </li>
              ))}
              {results.length === 0 && (
                <li className="px-2.5 py-6 text-center text-sm text-neutral-500">No matches.</li>
              )}
            </ul>
            <footer className="flex items-center gap-3 border-t border-neutral-200 px-3 py-1.5 text-[11px] text-neutral-400 dark:border-neutral-800">
              <span>↑↓ move</span>
              <span>↵ copy</span>
              <span>esc close</span>
              {found.length > LIMIT && <span className="ml-auto">{found.length - LIMIT} more, keep typing</span>}
            </footer>
          </>
        ) : (
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-400">{target.name}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{target.title}</span>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {target.params.map((p, i) => (
                <label key={p.name} className="space-y-1">
                  <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
                    {p.name}
                    {!p.default && <span className="text-red-500"> *</span>}
                    {p.description && <span className="ml-1 font-sans">· {p.description}</span>}
                  </span>
                  <Input
                    ref={i === 0 ? firstArg : undefined}
                    value={values[p.name] ?? ""}
                    placeholder={p.default ? `${p.default} (default)` : p.name}
                    onChange={(e) => setValues((v) => ({ ...v, [p.name]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
            <pre className="overflow-x-auto rounded-md bg-neutral-100 p-2.5 font-mono text-xs dark:bg-neutral-950">{resolved}</pre>
            <div className="flex items-center gap-3 text-[11px] text-neutral-400">
              <span>↵ copy</span>
              <span>esc back</span>
              {missing.length > 0 && (
                <span className="text-amber-600 dark:text-amber-400">needs {missing.map((p) => p.name).join(", ")}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
