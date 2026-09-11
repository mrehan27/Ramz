import { useState } from "react";
import { resolveCommand, type Entry, type EntryInput, type TagColor } from "../../shared/schema.ts";
import { kind } from "../../shared/kinds.ts";
import { allTags, useSearch } from "../lib/search.ts";
import { useOrdering } from "../lib/useOrdering.ts";
import type { SortKey } from "../../shared/sort.ts";
import type { KindId } from "../../shared/kinds.ts";
import { SortPicker } from "../components/SortPicker.tsx";
import { Grip } from "../components/Grip.tsx";
import { EntryDialog } from "../components/EntryDialog.tsx";
import { SearchBar } from "../components/SearchBar.tsx";
import { CommandText } from "../components/CommandText.tsx";
import { CopyButton } from "../components/CopyButton.tsx";
import { ArgFields } from "../components/ArgFields.tsx";
import { TagBadge } from "../components/TagBadge.tsx";
import { Button, cx } from "../components/ui.tsx";

export function NotesPage({
  entries, onSave, onDelete, onToggleArchive, onUsed, tagColors, onTagColor,
  sort, onSort, onReorder,
}: {
  entries: Entry[];
  onSave: (input: EntryInput, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleArchive?: (entry: Entry) => Promise<void>;
  onUsed?: (id: string) => void;
  tagColors: Record<string, TagColor>;
  onTagColor?: (tag: string, color: TagColor | null) => void;
  sort: SortKey;
  onSort: (key: SortKey) => void;
  onReorder: (kind: KindId, ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Entry | null>(null);
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const ofKind = entries.filter((e) => e.kind === "note");
  const archivedCount = ofKind.filter((e) => e.archived).length;
  const scoped = showArchived ? ofKind : ofKind.filter((e) => !e.archived);
  const results = useSearch(scoped, query, tag);
  const { sorted, gripProps, rowProps, dragClass } = useOrdering(
    "note", results, sort, onReorder, query.trim().length > 0,
  );

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">{kind("note").plural}</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{kind("note").blurb}</p>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>+ New</Button>
      </header>

      <div className="space-y-2">
        <SearchBar
          query={query} onQuery={setQuery}
          tags={allTags(scoped)} tag={tag} onTag={setTag}
          count={results.length}
          tagColors={tagColors} onTagColor={onTagColor}
        />
        <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
          <SortPicker value={sort} onChange={onSort} />
          {archivedCount > 0 && (
            <label className="flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              Show archived ({archivedCount})
            </label>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {sorted.map((note) => (
          <article
            key={note.id}
            {...rowProps(note)}
            className={cx(
              "rounded-lg border border-neutral-200 bg-white p-3.5 transition dark:border-neutral-800 dark:bg-neutral-900",
              dragClass(note),
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="flex items-center gap-1.5 text-sm font-medium">
                  <Grip props={gripProps(note)} />
                  {note.title}
                </h3>
                {note.description && (
                  <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">{note.description}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                {onToggleArchive && (
                  <Button variant="ghost" onClick={() => onToggleArchive(note)}>
                    {note.archived ? "Unarchive" : "Archive"}
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setEditing(note)}>Edit</Button>
                <Button variant="danger" onClick={() => confirm(`Delete "${note.title}"?`) && onDelete(note.id)}>
                  Delete
                </Button>
              </div>
            </div>

            {note.params.length > 0 && (
              <div className="mt-3">
                <ArgFields
                  params={note.params}
                  values={values}
                  onChange={setValues}
                  hint="Fill in once. The note below fills in with it"
                />
              </div>
            )}

            <NoteBody
              text={resolveCommand(note.body, note.params, values)}
              onCopied={onUsed ? () => onUsed(note.id) : undefined}
            />

            {note.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {note.tags.map((t) => <TagBadge key={t} tag={t} color={tagColors[t]} />)}
              </div>
            )}
          </article>
        ))}
        {results.length === 0 && (
          <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
            {ofKind.length === 0 ? "No notes yet." : "No matches."}
          </p>
        )}
      </div>

      {(creating || editing) && (
        <EntryDialog
          kind="note"
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

/**
 * Markdown-lite: ``` fences become copyable commands, ## is a heading, --- a rule.
 * Deliberately not a markdown engine, since a note is mostly values and commands.
 */
function NoteBody({ text, onCopied }: { text: string; onCopied?: () => void }) {
  const blocks: React.ReactNode[] = [];
  const lines = text.split("\n");
  let paragraph: string[] = [];
  let fence: string[] | null = null;

  const flush = () => {
    if (paragraph.length === 0) return;
    blocks.push(
      <p key={`p${blocks.length}`} className="whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-300">
        {paragraph.join("\n")}
      </p>,
    );
    paragraph = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (fence) {
        const code = fence.join("\n");
        blocks.push(
          <div key={`c${blocks.length}`} className="flex items-start gap-2">
            <CommandText command={code} className="flex-1" />
            <CopyButton value={code} onCopied={onCopied} />
          </div>,
        );
        fence = null;
      } else {
        flush();
        fence = [];
      }
      continue;
    }
    if (fence) { fence.push(line); continue; }

    if (/^#{1,6}\s/.test(line)) {
      flush();
      blocks.push(
        <h4 key={`h${blocks.length}`} className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          {line.replace(/^#{1,6}\s/, "")}
        </h4>,
      );
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      flush();
      blocks.push(<hr key={`r${blocks.length}`} className="border-neutral-200 dark:border-neutral-800" />);
      continue;
    }
    if (!line.trim()) { flush(); continue; }
    paragraph.push(line);
  }
  if (fence) paragraph.push(...fence);
  flush();

  return <div className="mt-3 space-y-2">{blocks}</div>;
}
