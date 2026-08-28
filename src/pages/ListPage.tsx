import { useState } from "react";
import { kind, type KindId } from "../../shared/kinds.ts";
import type { Entry, EntryInput } from "../../shared/schema.ts";
import { allTags, useSearch } from "../lib/search.ts";
import { EntryCard } from "../components/EntryCard.tsx";
import { EntryDialog } from "../components/EntryDialog.tsx";
import { SearchBar } from "../components/SearchBar.tsx";
import { Button, Tip, cx } from "../components/ui.tsx";
import type { TagColor } from "../../shared/schema.ts";

const UNTAGGED = "untagged";

/** Pinned first, then alphabetical. Search order wins when there is a query. */
function byPin(a: Entry, b: Entry) {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  return a.title.localeCompare(b.title);
}

export function ListPage({
  kind: id, entries, onSave, onDelete, onToggleExport, onTogglePin, onToggleArchive, onUsed, actions,
  tagColors, onTagColor,
}: {
  kind: KindId;
  entries: Entry[];
  onSave: (input: EntryInput, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleExport?: (entry: Entry) => Promise<void>;
  onTogglePin?: (entry: Entry) => Promise<void>;
  onToggleArchive?: (entry: Entry) => Promise<void>;
  onUsed?: (id: string) => void;
  actions?: React.ReactNode;
  tagColors: Record<string, TagColor>;
  onTagColor?: (tag: string, color: TagColor | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [grouped, setGrouped] = useState(() => localStorage.getItem("ramz.grouped") !== "off");
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(JSON.parse(localStorage.getItem(`ramz.collapsed.${id}`) ?? "[]") as string[]),
  );
  const [editing, setEditing] = useState<Entry | null>(null);
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const ofKind = entries.filter((e) => e.kind === id);
  const archivedCount = ofKind.filter((e) => e.archived).length;
  const scoped = showArchived ? ofKind : ofKind.filter((e) => !e.archived);
  const results = useSearch(scoped, query, tag);
  const searching = query.trim().length > 0;

  const toggleCollapse = (name: string) =>
    setCollapsed((s) => {
      const next = new Set(s);
      next.has(name) ? next.delete(name) : next.add(name);
      localStorage.setItem(`ramz.collapsed.${id}`, JSON.stringify([...next]));
      return next;
    });

  const card = (e: Entry) => (
    <EntryCard
      key={e.id}
      entry={e}
      tagColors={tagColors}
      onEdit={() => setEditing(e)}
      onDelete={() => confirm(`Delete "${e.title}"?`) && onDelete(e.id)}
      onToggleExport={onToggleExport ? () => onToggleExport(e) : undefined}
      onTogglePin={onTogglePin ? () => onTogglePin(e) : undefined}
      onToggleArchive={onToggleArchive ? () => onToggleArchive(e) : undefined}
      onUsed={onUsed ? () => onUsed(e.id) : undefined}
    />
  );

  // Grouping is off while searching: relevance order is more useful than tidiness.
  const groups: [string, Entry[]][] = [];
  if (grouped && !searching) {
    const pinned = results.filter((e) => e.pinned).sort(byPin);
    if (pinned.length) groups.push(["pinned", pinned]);
    const rest = results.filter((e) => !e.pinned);
    const names = [...new Set(rest.map((e) => e.tags[0] ?? UNTAGGED))].sort((a, b) =>
      a === UNTAGGED ? 1 : b === UNTAGGED ? -1 : a.localeCompare(b),
    );
    for (const name of names) {
      groups.push([name, rest.filter((e) => (e.tags[0] ?? UNTAGGED) === name).sort(byPin)]);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">{kind(id).plural}</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{kind(id).blurb}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {actions}
          <Button variant="primary" onClick={() => setCreating(true)}>+ New</Button>
        </div>
      </header>

      <div className="space-y-2">
        <SearchBar
          query={query} onQuery={setQuery}
          tags={allTags(scoped)} tag={tag} onTag={setTag}
          count={results.length}
          tagColors={tagColors} onTagColor={onTagColor}
        />
        <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
          <Tip text="Group cards under their first tag. Pinned commands get their own group at the top.">
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={grouped}
                onChange={(e) => {
                  setGrouped(e.target.checked);
                  localStorage.setItem("ramz.grouped", e.target.checked ? "on" : "off");
                }}
              />
              Group by tag
            </label>
          </Tip>
          {archivedCount > 0 && (
            <Tip text="Archived commands stay searchable in ⌘K, they just do not clutter this list.">
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
                Show archived ({archivedCount})
              </label>
            </Tip>
          )}
          {searching && grouped && <span className="text-neutral-400">grouping paused while searching</span>}
          {grouped && !searching && groups.length > 1 && (
            <button
              onClick={() => {
                const all = collapsed.size < groups.length ? groups.map(([n]) => n) : [];
                setCollapsed(new Set(all));
                localStorage.setItem(`ramz.collapsed.${id}`, JSON.stringify(all));
              }}
              className="ml-auto underline decoration-dotted underline-offset-2 hover:text-neutral-700 dark:hover:text-neutral-200"
            >
              {collapsed.size < groups.length ? "collapse all" : "expand all"}
            </button>
          )}
        </div>
      </div>

      {groups.length > 0 ? (
        <div className="space-y-6">
          {groups.map(([name, items]) => {
            const shut = collapsed.has(name);
            return (
              <section key={name} className="space-y-2.5">
                <button
                  onClick={() => toggleCollapse(name)}
                  className={cx(
                    "flex w-full items-center gap-2 border-b border-neutral-200 pb-1 text-xs font-semibold uppercase tracking-wide transition dark:border-neutral-800",
                    name === "pinned" ? "text-amber-600 dark:text-amber-400" : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300",
                  )}
                >
                  <span className={cx("transition", shut ? "" : "rotate-90")}>›</span>
                  {name === "pinned" && <span>★</span>}
                  {name}
                  <span className="font-normal normal-case text-neutral-400">{items.length}</span>
                </button>
                {!shut && items.map(card)}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2.5">
          {(searching ? results : [...results].sort(byPin)).map(card)}
          {results.length === 0 && (
            <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
              {scoped.length === 0 ? "Nothing here yet." : "No matches."}
            </p>
          )}
        </div>
      )}

      {(creating || editing) && (
        <EntryDialog
          kind={id}
          entry={editing ?? undefined}
          knownTags={allTags(entries)}
          tagColors={tagColors}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSave={(input) => onSave(input, editing?.id)}
        />
      )}
    </div>
  );
}
