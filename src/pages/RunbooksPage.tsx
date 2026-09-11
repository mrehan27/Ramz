import { useMemo, useState } from "react";
import { placeholdersIn, resolveCommand, type Entry, type EntryInput, type TagColor } from "../../shared/schema.ts";
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
import { Badge, Button, Input, Tip, cx } from "../components/ui.tsx";

export function RunbooksPage({
  entries, onSave, onDelete, tagColors, onTagColor, onUsed,
  sort, onSort, onReorder,
}: {
  entries: Entry[];
  onSave: (input: EntryInput, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  tagColors: Record<string, TagColor>;
  onTagColor?: (tag: string, color: TagColor | null) => void;
  onUsed?: (id: string) => void;
  sort: SortKey;
  onSort: (key: SortKey) => void;
  onReorder: (kind: KindId, ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Entry | null>(null);
  const [creating, setCreating] = useState(false);

  const scoped = entries.filter((e) => e.kind === "runbook");
  const results = useSearch(scoped, query, tag);
  const { sorted, gripProps, rowProps, dragClass } = useOrdering(
    "runbook", results, sort, onReorder, query.trim().length > 0,
  );

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">{kind("runbook").plural}</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{kind("runbook").blurb}</p>
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
        <SortPicker value={sort} onChange={onSort} />
      </div>

      <div className="space-y-2.5">
        {sorted.map((p) => {
          const expanded = open === p.id;
          return (
            <article
              key={p.id}
              {...rowProps(p)}
              className={cx(
                "rounded-lg border border-neutral-200 bg-white transition dark:border-neutral-800 dark:bg-neutral-900",
                dragClass(p),
              )}
            >
              <button
                className="flex w-full items-center justify-between gap-3 p-3.5 text-left"
                onClick={() => { setValues({}); setOpen(expanded ? null : p.id); }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Grip props={gripProps(p)} />
                    <span className="text-neutral-400">{expanded ? "▾" : "▸"}</span>
                    <h3 className="text-sm font-medium">{p.title}</h3>
                    <Badge>{p.steps.length} steps</Badge>
                  </div>
                  {p.description && (
                    <p className="mt-1 pl-5 text-sm text-neutral-500 dark:text-neutral-400">{p.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" onClick={() => setEditing(p)}>Edit</Button>
                  <Button variant="danger" onClick={() => confirm(`Delete "${p.title}"?`) && onDelete(p.id)}>Delete</Button>
                </div>
              </button>

              {expanded && (
                <RunbookBody entry={p} values={values} setValues={setValues} onUsed={onUsed ? () => onUsed(p.id) : undefined} />
              )}

            </article>
          );
        })}
        {results.length === 0 && (
          <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
            {scoped.length === 0 ? "No runbooks yet." : "No matches."}
          </p>
        )}
      </div>

      {(creating || editing) && (
        <EntryDialog
          kind="runbook"
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

/** A step's command, copyable only once nothing is left to fill in. */
function StepCommand({ text, onUsed }: { text: string; onUsed?: () => void }) {
  const open = placeholdersIn(text);
  return (
    <div className="flex items-start gap-2">
      <CommandText command={text} className="flex-1" />
      {open.length > 0 ? (
        <Tip text={`Fill in ${open.join(", ")} above. The highlighted part is what gets replaced.`}>
          <Button variant="outline" disabled>Copy</Button>
        </Tip>
      ) : (
        <CopyButton value={text} onCopied={onUsed} />
      )}
    </div>
  );
}

/** The steps, plus one fill-in that feeds every step at once. */
function RunbookBody({
  entry, values, setValues, onUsed,
}: {
  entry: Entry;
  values: Record<string, string>;
  setValues: (v: Record<string, string>) => void;
  onUsed?: () => void;
}) {
  const resolve = (cmd: string) => resolveCommand(cmd, entry.params, values);
  const withCommands = entry.steps
    .map((s, i) => ({ step: s, number: i + 1 }))
    .filter(({ step }) => step.command.trim());
  const missing = entry.params.filter((p) => !values[p.name]?.trim() && !p.default);

  const script = useMemo(
    () =>
      withCommands
        .map(({ step, number }) => `# ${number}. ${step.title}\n${resolve(step.command).trim()}`)
        .join("\n\n"),
    [withCommands, values, entry.params],
  );

  // Chaining only makes sense while every step is a single line.
  const chainable = withCommands.length > 1 && withCommands.every(({ step }) => !step.command.trim().includes("\n"));
  const chain = withCommands.map(({ step }) => resolve(step.command).trim()).join(" && ");

  return (
    <div className="space-y-3 border-t border-neutral-200 p-3.5 dark:border-neutral-800">
      {entry.params.length > 0 && (
        <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
          <p className="mb-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Fill in once. Every step below uses these
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {entry.params.map((p, i) => (
              <label key={p.name} className="space-y-1">
                <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
                  {p.name}
                  {!p.default && <span className="text-red-500"> *</span>}
                  {p.description && <span className="ml-1 font-sans">· {p.description}</span>}
                </span>
                <Input
                  autoFocus={i === 0}
                  value={values[p.name] ?? ""}
                  placeholder={p.default ? `${p.default} (default)` : p.name}
                  onChange={(e) => setValues({ ...values, [p.name]: e.target.value })}
                />
              </label>
            ))}
          </div>
        </div>
      )}

      <ol className="space-y-3">
        {entry.steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-medium dark:bg-neutral-800">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-sm font-medium">{s.title}</p>
              {s.body && (s.body.includes("\n") ? (
                <StepCommand text={resolve(s.body)} onUsed={onUsed} />
              ) : (
                <p className="whitespace-pre-wrap text-sm text-neutral-500 dark:text-neutral-400">{resolve(s.body)}</p>
              ))}
              {s.command && <StepCommand text={resolve(s.command)} onUsed={onUsed} />}
            </div>
          </li>
        ))}
      </ol>

      {withCommands.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
          <span className="text-xs text-neutral-400">All {withCommands.length} steps:</span>
          {missing.length > 0 ? (
            <Tip text={`Fill in ${missing.map((p) => p.name).join(", ")} first.`}>
              <Button variant="primary" disabled>Copy as script</Button>
            </Tip>
          ) : (
            <>
              <Tip text="Every command in order, each under its step title as a comment. Paste into a file or straight into a shell.">
                <CopyButton value={script} label="Copy as script" variant="primary" onCopied={onUsed} />
              </Tip>
              {chainable && (
                <Tip text="One line joined with &&. Stops at the first step that fails.">
                  <CopyButton value={chain} label="Copy as one line" onCopied={onUsed} />
                </Tip>
              )}
            </>
          )}
          <span className="text-xs text-neutral-400">or copy any step on its own above</span>
        </div>
      )}
    </div>
  );
}
