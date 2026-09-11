import { useEffect, useRef, useState } from "react";
import { kind } from "../../shared/kinds.ts";
import { defaultVariant, resolveCommand, type Entry, type EntryInput, type TagColor, type Variant } from "../../shared/schema.ts";
import { allTags, isTextSearch, useSearch } from "../lib/search.ts";
import { useOrdering } from "../lib/useOrdering.ts";
import type { SortKey } from "../../shared/sort.ts";
import type { KindId } from "../../shared/kinds.ts";
import { SortPicker } from "../components/SortPicker.tsx";
import { Grip, type GripProps } from "../components/Grip.tsx";
import { EntryDialog } from "../components/EntryDialog.tsx";
import { SearchBar } from "../components/SearchBar.tsx";
import { CopyButton } from "../components/CopyButton.tsx";
import { ArgFields } from "../components/ArgFields.tsx";
import { VariantPicker, valuesFor } from "../components/VariantPicker.tsx";
import { TagBadge } from "../components/TagBadge.tsx";
import { Badge, Button, Tip, cx } from "../components/ui.tsx";

const CLAMP = 6;

/** Same width as the cards elsewhere, so Copy does not jump when it says Copied. */
const ACTION = "min-w-[5rem] justify-center";

export function PromptsPage({
  entries, onSave, onDelete, onToggleArchive, onUsed, onTogglePin, tagColors, onTagColor,
  sort, onSort, onReorder,
}: {
  entries: Entry[];
  onSave: (input: EntryInput, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleArchive?: (entry: Entry) => Promise<void>;
  onTogglePin?: (entry: Entry) => Promise<void>;
  onUsed?: (id: string) => void;
  tagColors: Record<string, TagColor>;
  onTagColor?: (tag: string, color: TagColor | null) => void;
  sort: SortKey;
  onSort: (key: SortKey) => void;
  onReorder: (kind: KindId, ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [focus, setFocus] = useState<"variants" | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const ofKind = entries.filter((e) => e.kind === "prompt");
  const archivedCount = ofKind.filter((e) => e.archived).length;
  const scoped = showArchived ? ofKind : ofKind.filter((e) => !e.archived);
  const found = useSearch(scoped, query, tag);
  // Relevance order while searching, the chosen sort otherwise.
  const { sorted: results, gripProps, rowProps, dragClass } = useOrdering(
    "prompt", found, sort, onReorder, isTextSearch(query),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">{kind("prompt").plural}</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{kind("prompt").blurb}</p>
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
        {results.map((prompt) => (
          <PromptCard
            // Rebuilt after an edit, so a newly marked default variant takes effect
            // here rather than the next time the page is opened.
            key={`${prompt.id}:${prompt.updatedAt}`}
            prompt={prompt}
            grip={gripProps(prompt)}
            row={rowProps(prompt)}
            className={dragClass(prompt)}
            tagColors={tagColors}
            onEdit={() => setEditing(prompt)}
            open={openId === prompt.id}
            onToggle={(next) => {
              const want = next ?? openId !== prompt.id;
              setOpenId(want ? prompt.id : null);
            }}
            onManageVariants={() => { setFocus("variants"); setEditing(prompt); }}
            onDelete={() => confirm(`Delete "${prompt.title}"?`) && onDelete(prompt.id)}
            onTogglePin={onTogglePin ? () => onTogglePin(prompt) : undefined}
            onToggleArchive={onToggleArchive ? () => onToggleArchive(prompt) : undefined}
            onUsed={onUsed ? () => onUsed(prompt.id) : undefined}
          />
        ))}
        {results.length === 0 && (
          <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
            {ofKind.length === 0
              ? "No prompts yet. Paste one you keep retyping, and put {{braces}} around the parts that change."
              : "No matches."}
          </p>
        )}
      </div>

      {(creating || editing) && (
        <EntryDialog
          kind="prompt"
          entry={editing ?? undefined}
          knownTags={allTags(entries)}
          tagColors={tagColors}
          focus={focus}
          onClose={() => { setCreating(false); setEditing(null); setFocus(undefined); }}
          onSave={(input) => onSave(input, editing?.id)}
        />
      )}
    </div>
  );
}

function PromptCard({
  prompt, tagColors, open, onToggle, onEdit, onManageVariants, onDelete, onTogglePin, onToggleArchive, onUsed,
  grip, row, className,
}: {
  prompt: Entry;
  tagColors: Record<string, TagColor>;
  /** One card is open at a time: a page of long prompts is otherwise unreadable. */
  open: boolean;
  onToggle: (next?: boolean) => void;
  onEdit: () => void;
  onManageVariants: () => void;
  onDelete: () => void;
  onTogglePin?: () => void;
  onToggleArchive?: () => void;
  onUsed?: () => void;
  grip?: GripProps;
  row?: React.HTMLAttributes<HTMLElement>;
  className?: string;
}) {
  const preset = defaultVariant(prompt.variants);
  const [variant, setVariant] = useState<string | null>(preset?.name ?? null);
  const [values, setValues] = useState<Record<string, string>>(preset ? { ...preset.values } : {});
  const [expanded, setExpanded] = useState(false);
  const body = useRef<HTMLDivElement>(null);

  const resolved = resolveCommand(prompt.body, prompt.params, values);
  const missing = prompt.params.filter((p) => !values[p.name]?.trim() && !p.default);
  const lines = resolved.split("\n");
  const preview = expanded ? resolved : lines.slice(0, CLAMP).join("\n");

  const pick = (v: Variant | null) => {
    setVariant(v?.name ?? null);
    setValues((prev) => valuesFor(prompt.variants, v, prev));
  };

  // Fill opens the card on the first thing still to type.
  useEffect(() => {
    if (!open || missing.length === 0) return;
    body.current?.querySelector<HTMLInputElement>(`input[data-arg="${missing[0].name}"]`)?.focus();
  }, [open]);

  return (
    <article
      {...row}
      className={cx(
        "rounded-lg border border-neutral-200 bg-white transition dark:border-neutral-800 dark:bg-neutral-900",
        className,
      )}
    >
      <div className="flex items-center gap-2 p-3">
        <Grip props={grip} />
        {onTogglePin && (
          <Tip text={prompt.pinned ? "Unpin" : "Pin to the top of the list"}>
            <button
              onClick={onTogglePin}
              aria-label={prompt.pinned ? "Unpin" : "Pin"}
              className={prompt.pinned
                ? "text-sm leading-none text-amber-500"
                : "text-sm leading-none text-neutral-300 transition hover:text-neutral-500 dark:text-neutral-700 dark:hover:text-neutral-500"}
            >
              ★
            </button>
          </Tip>
        )}
        <button onClick={() => onToggle()} className="flex min-w-0 flex-1 flex-col text-left">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{prompt.title}</span>
            {prompt.archived && <Badge>archived</Badge>}
          </span>
          {prompt.description && (
            <span className="truncate text-xs text-neutral-400 dark:text-neutral-500">{prompt.description}</span>
          )}
        </button>

        {(prompt.variants.length > 0 || prompt.params.length > 0) && (
          <VariantPicker
            compact
            variants={prompt.variants}
            active={variant}
            onPick={pick}
            onManage={onManageVariants}
          />
        )}

        {missing.length > 0 ? (
          <Tip text={`Needs ${missing.map((p) => p.name).join(", ")}. Fill it in, or pick a variant that sets it.`}>
            <Button variant="primary" className={ACTION} onClick={() => onToggle(true)}>Fill</Button>
          </Tip>
        ) : (
          <CopyButton value={resolved} variant="primary" className={ACTION} onCopied={onUsed} />
        )}

        <button
          onClick={() => onToggle()}
          aria-label={open ? "Collapse" : "Expand"}
          aria-expanded={open}
          className="shrink-0 px-1 text-neutral-400 transition hover:text-neutral-700 dark:hover:text-neutral-200"
        >
          <span className={cx("inline-block transition", open ? "rotate-90" : "")}>›</span>
        </button>
      </div>

      {open && (
        <div ref={body} className="space-y-3 border-t border-neutral-200 p-3 dark:border-neutral-800">
          {prompt.params.length > 0 && (
            <ArgFields
              params={prompt.params}
              values={values}
              onChange={setValues}
              hint={variant
                ? `Filled in by ${variant}. Change anything before you copy`
                : "The parts that change. The prompt below fills in as you type"}
            />
          )}

          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-neutral-100 p-2.5 text-xs leading-relaxed dark:bg-neutral-950">
            {preview}
            {!expanded && lines.length > CLAMP && "\n…"}
          </pre>

          <div className="flex items-center gap-3">
            {lines.length > CLAMP && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-xs text-neutral-400 underline decoration-dotted underline-offset-2 hover:text-neutral-600 dark:hover:text-neutral-300"
              >
                {expanded ? "show less" : `show all ${lines.length} lines`}
              </button>
            )}
            <div className="ml-auto flex items-center gap-1">
              {onToggleArchive && (
                <Button variant="ghost" onClick={onToggleArchive}>{prompt.archived ? "Unarchive" : "Archive"}</Button>
              )}
              <Button variant="ghost" onClick={onEdit}>Edit</Button>
              <Button variant="danger" onClick={onDelete}>Delete</Button>
            </div>
          </div>

          {(prompt.tags.length > 0 || prompt.useCount > 0) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {prompt.tags.map((t) => <TagBadge key={t} tag={t} color={tagColors[t]} />)}
              {prompt.useCount > 0 && (
                <Tip text={`Copied ${prompt.useCount} time${prompt.useCount === 1 ? "" : "s"} from Ramz`}>
                  <span className="text-[11px] text-neutral-400">·  {prompt.useCount}×</span>
                </Tip>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
