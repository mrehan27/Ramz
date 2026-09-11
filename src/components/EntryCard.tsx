import { useEffect, useRef, useState } from "react";
import { needsFill, resolveCommand, type Entry } from "../../shared/schema.ts";
import type { TagColor } from "../../shared/schema.ts";
import { Badge, Button, Input, Tip, cx } from "./ui.tsx";
import { TagBadge } from "./TagBadge.tsx";
import { CopyButton } from "./CopyButton.tsx";
import { CommandText } from "./CommandText.tsx";
import { Grip, type GripProps } from "./Grip.tsx";

const CLAMP = 3;

/** Fill, Copy and Copied are one button in three states, so they hold one width. */
const ACTION = "min-w-[5rem] justify-center";

export function EntryCard({
  entry, onEdit, onDelete, onToggleExport, onTogglePin, onToggleArchive, onUsed, tagColors,
  grip, row, className,
}: {
  entry: Entry;
  tagColors: Record<string, TagColor>;
  onEdit: () => void;
  onDelete: () => void;
  onToggleExport?: () => void;
  onTogglePin?: () => void;
  onToggleArchive?: () => void;
  onUsed?: () => void;
  /** Set only under the manual sort; see useOrdering. */
  grip?: GripProps;
  row?: React.HTMLAttributes<HTMLElement>;
  className?: string;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [filling, setFilling] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const firstField = useRef<HTMLInputElement>(null);

  const hasParams = entry.params.length > 0;
  const resolved = resolveCommand(entry.command, entry.params, values);
  const missing = entry.params.filter((p) => !values[p.name]?.trim() && !p.default);
  const dirty = Object.values(values).some((v) => v.trim());
  // Nothing to type only when every argument can fall back to a default.
  const needsInput = needsFill(entry);

  useEffect(() => {
    if (filling) firstField.current?.focus();
  }, [filling]);

  // Long bodies (the seven-step uninstall, say) would otherwise dominate the list.
  const lines = entry.command.split("\n");
  const preview = lines.slice(0, CLAMP).join("\n") + (lines.length > CLAMP ? "\n…" : "");

  return (
    <article
      {...row}
      className={cx(
        "rounded-lg border border-neutral-200 bg-white p-3.5 transition dark:border-neutral-800 dark:bg-neutral-900",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Grip props={grip} />
            {onTogglePin && (
              <Tip text={entry.pinned ? "Unpin" : "Pin to the top of the list"}>
                <button
                  onClick={onTogglePin}
                  aria-label={entry.pinned ? "Unpin" : "Pin"}
                  className={cx(
                    "text-sm leading-none transition",
                    entry.pinned ? "text-amber-500" : "text-neutral-300 hover:text-neutral-500 dark:text-neutral-700 dark:hover:text-neutral-500",
                  )}
                >
                  ★
                </button>
              </Tip>
            )}
            {entry.name && (
              <span className="font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-400">{entry.name}</span>
            )}
            <h3 className="truncate text-sm font-medium">{entry.title}</h3>
            {hasParams && (
              <Tip text={`Takes ${entry.params.length} argument${entry.params.length > 1 ? "s" : ""}, so it exports as a shell function rather than an alias.`}>
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">fn</Badge>
              </Tip>
            )}
            {entry.archived && (
              <Tip text="Archived: kept, but out of the lists and out of the palette until you search for it.">
                <Badge>archived</Badge>
              </Tip>
            )}
            {entry.kind === "alias" && !entry.exported && (
              <Tip text="Kept here only. It is left out of the generated shell file until you tick 'export to shell'.">
                <Badge>not exported</Badge>
              </Tip>
            )}
          </div>
          {entry.description && (
            <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">{entry.description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {hasParams && !needsInput && (
            <Button variant="ghost" onClick={() => setFilling((v) => !v)}>
              {filling ? "Hide args" : "Set args"}
            </Button>
          )}
          {hasParams && needsInput ? (
            <Tip text="This command needs arguments. Fill them in and copy the finished line.">
              <Button variant="primary" className={ACTION} onClick={() => setFilling(true)}>Fill</Button>
            </Tip>
          ) : (
            <CopyButton value={hasParams ? resolved : entry.command} variant="primary" className={ACTION} onCopied={onUsed} />
          )}
          {onToggleArchive && (
            <Tip text={entry.archived ? "Bring it back into the lists" : "Keep it, but out of the way. Still found by searching"}>
              <Button variant="ghost" onClick={onToggleArchive}>{entry.archived ? "Unarchive" : "Archive"}</Button>
            </Tip>
          )}
          <Button variant="ghost" onClick={onEdit}>Edit</Button>
          <Button variant="danger" onClick={onDelete}>Delete</Button>
        </div>
      </div>

      <div className="mt-2.5">
        <CommandText command={expanded ? entry.command : preview} />
        {lines.length > CLAMP && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 text-xs text-neutral-400 underline decoration-dotted underline-offset-2 hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            {expanded ? "show less" : `show all ${lines.length} lines`}
          </button>
        )}
      </div>

      {filling && hasParams && (
        <div className="mt-2.5 rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
          <div className="grid gap-2.5 sm:grid-cols-2">
            {entry.params.map((p, i) => (
              <label key={p.name} className="space-y-1">
                <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
                  {p.name}
                  {!p.default && <span className="text-red-500"> *</span>}
                  {p.description && <span className="ml-1 font-sans">· {p.description}</span>}
                </span>
                <Input
                  ref={i === 0 ? firstField : undefined}
                  value={values[p.name] ?? ""}
                  placeholder={p.default ? `${p.default} (default)` : p.name}
                  onChange={(e) => setValues((v) => ({ ...v, [p.name]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && missing.length === 0) {
                      void navigator.clipboard.writeText(resolved);
                    }
                    if (e.key === "Escape") setFilling(false);
                  }}
                />
              </label>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            <CommandText command={resolved} className="bg-emerald-50 dark:bg-emerald-950/30" />
            <div className="flex items-center gap-2">
              {missing.length > 0 ? (
                <Tip text={`Fill in ${missing.map((p) => p.name).join(", ")} first. There is no default to fall back on.`}>
                  <Button variant="primary" className={ACTION} disabled>Copy</Button>
                </Tip>
              ) : (
                <CopyButton value={resolved} variant="primary" className={ACTION} onCopied={onUsed} />
              )}
              {dirty && (
                <Tip text="Clear what you typed and go back to the defaults">
                  <Button variant="ghost" onClick={() => setValues({})} aria-label="Reset arguments">↺</Button>
                </Tip>
              )}
              <Button variant="ghost" onClick={() => setFilling(false)}>Close</Button>
              {missing.length > 0 && (
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  needs {missing.map((p) => p.name).join(", ")}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {(entry.tags.length > 0 || onToggleExport) && (
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {entry.tags.map((t) => <TagBadge key={t} tag={t} color={tagColors[t]} />)}
            {entry.useCount > 0 && (
              <Tip text={`Copied ${entry.useCount} time${entry.useCount === 1 ? "" : "s"} from Ramz`}>
                <span className="text-[11px] text-neutral-400">·  {entry.useCount}×</span>
              </Tip>
            )}
          </div>
          {onToggleExport && (
            <Tip text="Include this in ~/.config/ramz/aliases.sh the next time you sync to the shell.">
              <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                <input type="checkbox" checked={entry.exported} onChange={onToggleExport} />
                export to shell
              </label>
            </Tip>
          )}
        </div>
      )}
    </article>
  );
}
