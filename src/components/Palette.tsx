import { useEffect, useMemo, useRef, useState } from "react";
import { KINDS, kind } from "../../shared/kinds.ts";
import { hasFilters, parseQuery } from "../../shared/query.ts";
import { defaultVariant, needsFill, resolveCommand, type Entry, type TagColor, type Variant } from "../../shared/schema.ts";
import { useSearch } from "../lib/search.ts";
import { Input, cx } from "./ui.tsx";
import { TagBadge } from "./TagBadge.tsx";
import { VariantChips, valuesFor } from "./VariantPicker.tsx";
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
  const [variant, setVariant] = useState<string | null>(null);
  const toast = useToast();
  const firstArg = useRef<HTMLInputElement>(null);
  const chips = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);

  // Kinds decide whether they belong here: a runbook is steps, not one line, so
  // there is nothing to copy in one go. Archived entries stay out of the way
  // until the query proves you want them.
  const filters = useMemo(() => parseQuery(query), [query]);
  const searching = filters.text.length > 0;
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
  // Focus lands on whatever is actually left to do: the first blank, the variant
  // if that choice is still open, or the step itself when it is ready to copy.
  useEffect(() => {
    if (!target) return;
    const blank = target.params.find((p) => !values[p.name]?.trim() && !p.default);
    if (variant) {
      if (blank) box.current?.querySelector<HTMLInputElement>(`input[data-arg="${blank.name}"]`)?.focus();
      else box.current?.focus();
    } else if (target.variants.length > 0) {
      chips.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
    } else {
      firstArg.current?.focus();
    }
  }, [target]);

  /** After picking, land on the first thing still to type, or where Enter copies. */
  const focusNextBlank = () =>
    requestAnimationFrame(() => {
      const fields = [...(box.current?.querySelectorAll<HTMLInputElement>("input[data-arg]") ?? [])];
      (fields.find((f) => !f.value.trim()) ?? box.current)?.focus();
    });

  /** Back to an empty search. The panel is hidden, not unmounted, so it would
   *  otherwise reopen on the last prompt you filled in. */
  const reset = () => {
    setQuery("");
    setCursor(0);
    setTarget(null);
    setValues({});
    setVariant(null);
  };

  // Covers every way the panel goes away: Esc, click away, the menubar icon, a copy.
  useEffect(() => {
    if (!embedded) return;
    const onVisibility = () => { if (document.hidden) reset(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [embedded]);

  const copy = (text: string, entry: Entry) => {
    void navigator.clipboard.writeText(text);
    onUsed?.(entry.id);
    toast({ title: `Copied ${entry.name || entry.title}`, body: text.split("\n")[0].slice(0, 90) });
    reset();
    onClose();
  };

  // What a kind puts on the clipboard is the kind's business: a command for an
  // alias, the whole body for a prompt.
  const template = (entry: Entry) => kind(entry.kind).copyText(entry);

  const choose = (entry: Entry) => {
    if (!needsFill(entry)) {
      copy(resolveCommand(template(entry), entry.params, {}), entry);
      return;
    }
    // Open on the variant the author marked as usual, so the common case is one key.
    const preset = defaultVariant(entry.variants);
    setValues(preset ? { ...preset.values } : {});
    setVariant(preset?.name ?? null);
    setTarget(entry);
  };

  const pick = (v: Variant | null) => {
    if (!target) return;
    setVariant(v?.name ?? null);
    setValues((prev) => valuesFor(target.variants, v, prev));
    focusNextBlank();
  };

  const chosen = target?.variants.find((v) => v.name === variant) ?? null;
  // A variant that answers a placeholder does not need to ask about it again.
  const asks = target?.params.filter((p) => !chosen?.values[p.name]?.trim()) ?? [];
  const missing = target?.params.filter((p) => !values[p.name]?.trim() && !p.default) ?? [];
  const resolved = target ? resolveCommand(template(target), target.params, values) : "";

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      target ? setTarget(null) : onClose();
      return;
    }
    if (target) {
      const on = e.target as HTMLElement;
      const typing = on instanceof HTMLInputElement || on instanceof HTMLTextAreaElement;
      // 1-9 picks a variant from anywhere in the step, except mid-word in a field.
      if (target.variants.length > 0 && !typing && /^[1-9]$/.test(e.key) && !e.metaKey && !e.ctrlKey) {
        const options: (Variant | null)[] = [null, ...target.variants];
        const chosen = options[Number(e.key) - 1];
        if (chosen !== undefined) {
          e.preventDefault();
          pick(chosen);
          return;
        }
      }
      // A control that answers Enter itself (a variant button) must not also copy:
      // that keystroke would use the values it is in the middle of setting.
      if (on instanceof HTMLButtonElement || on instanceof HTMLSelectElement) {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          const all = [...(chips.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
          const next = all.indexOf(on as HTMLButtonElement) + (e.key === "ArrowRight" ? 1 : -1);
          all[Math.max(0, Math.min(all.length - 1, next))]?.focus();
        }
        return;
      }
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
              placeholder="Find a command… try prompt: or #tag"
              className="rounded-none border-0 border-b border-neutral-200 py-3 text-base focus:border-neutral-200 dark:border-neutral-800 dark:focus:border-neutral-800"
            />
            {hasFilters(filters) && (
              <div className="flex flex-wrap items-center gap-1 border-b border-neutral-200 px-3 py-1.5 text-[11px] dark:border-neutral-800">
                <span className="text-neutral-400">only</span>
                {filters.kinds.map((id) => (
                  <span key={id} className="rounded bg-neutral-200 px-1.5 py-0.5 font-medium dark:bg-neutral-800">
                    {kind(id).icon} {kind(id).plural}
                  </span>
                ))}
                {filters.tags.map((t) => (
                  <span key={t} className="rounded bg-neutral-200 px-1.5 py-0.5 font-medium dark:bg-neutral-800">
                    #{t}
                  </span>
                ))}
              </div>
            )}
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
                    <span
                      aria-hidden
                      title={kind(e.kind).singular}
                      className="w-4 shrink-0 text-center text-xs opacity-40"
                    >
                      {kind(e.kind).icon}
                    </span>
                    {e.name && (
                      <span className="font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-400">{e.name}</span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm">{e.title}</span>
                    {e.variants.length > 0 && (
                      <span className="shrink-0 text-[11px] text-violet-600 dark:text-violet-400">
                        {e.variants.length} variants
                      </span>
                    )}
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
                <li className="px-2.5 py-6 text-center text-sm text-neutral-500">
                  {filters.kinds.some((id) => !kind(id).inPalette)
                    ? `${filters.kinds.filter((id) => !kind(id).inPalette).map((id) => kind(id).plural).join(" and ")} are not in ⌘K: they have no single thing to copy.`
                    : "No matches."}
                </li>
              )}
            </ul>
            <footer className="flex items-center gap-3 border-t border-neutral-200 px-3 py-1.5 text-[11px] text-neutral-400 dark:border-neutral-800">
              <span>↑↓ move</span>
              <span>↵ copy</span>
              <span>esc close</span>
              {!query && (
                <span className="text-neutral-300 dark:text-neutral-600">
                  {KINDS.filter((k) => k.inPalette).map((k) => `${k.id}:`).join(" ")} #tag narrow it
                </span>
              )}
              {found.length > LIMIT && <span className="ml-auto">{found.length - LIMIT} more, keep typing</span>}
            </footer>
          </>
        ) : (
          <div ref={box} tabIndex={-1} className="space-y-3 p-4 outline-none">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-400">{target.name}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{target.title}</span>
            </div>
            {target.variants.length > 0 && (
              <VariantChips ref={chips} variants={target.variants} active={variant} onPick={pick} />
            )}
            <div className="grid gap-2.5 sm:grid-cols-2">
              {asks.map((p, i) => (
                <label key={p.name} className="space-y-1">
                  <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
                    {p.name}
                    {!p.default && <span className="text-red-500"> *</span>}
                    {p.description && <span className="ml-1 font-sans">· {p.description}</span>}
                  </span>
                  <Input
                    ref={i === 0 ? firstArg : undefined}
                    data-arg={p.name}
                    value={values[p.name] ?? ""}
                    placeholder={p.default ? `${p.default} (default)` : p.name}
                    onChange={(e) => setValues((v) => ({ ...v, [p.name]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
            {chosen && asks.length === 0 && (
              <p className="text-[11px] text-neutral-400">{chosen.name} fills in everything. Press enter to copy.</p>
            )}
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-neutral-100 p-2.5 font-mono text-xs dark:bg-neutral-950">{resolved}</pre>
            <div className="flex items-center gap-3 text-[11px] text-neutral-400">
              <span>↵ copy</span>
              <span>esc back</span>
              {target.variants.length > 0 && <span>1-9 variant</span>}
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
