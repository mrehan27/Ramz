import { useState } from "react";
import { TAG_COLORS, type Entry, type TagColor } from "../../shared/schema.ts";
import { Button, Input, Modal, Tip, cx } from "./ui.tsx";
import { TagBadge } from "./TagBadge.tsx";
import { useToast } from "./Toast.tsx";

const DOT: Record<TagColor, string> = {
  slate: "bg-slate-400", red: "bg-red-500", amber: "bg-amber-500", green: "bg-green-500",
  teal: "bg-teal-500", blue: "bg-blue-500", violet: "bg-violet-500", pink: "bg-pink-500",
};

export function TagsDialog({
  entries, tagColors, onClose, onColor, onRename, onDelete,
}: {
  entries: Entry[];
  tagColors: Record<string, TagColor>;
  onClose: () => void;
  onColor: (tag: string, color: TagColor | null) => Promise<void> | void;
  onRename: (tag: string, to: string) => Promise<void>;
  onDelete: (tag: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const counts = new Map<string, number>();
  for (const e of entries) for (const t of e.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  for (const t of Object.keys(tagColors)) if (!counts.has(t)) counts.set(t, 0);
  const tags = [...counts.keys()].sort();

  const rename = async (tag: string) => {
    const to = draft.trim();
    if (!to || to === tag) { setEditing(null); return; }
    try {
      await onRename(tag, to);
      toast({ title: `Renamed “${tag}” to “${to}”`, body: `${counts.get(tag) ?? 0} command(s) updated` });
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "rename failed");
    }
  };

  return (
    <Modal title="Tags" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Renaming or removing a tag updates every command that carries it. Colours are yours to pick.
        </p>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {tags.map((tag) => (
            <li key={tag} className="space-y-2 px-3 py-2.5">
              <div className="flex items-center gap-2">
                {editing === tag ? (
                  <>
                    <Input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void rename(tag);
                        if (e.key === "Escape") setEditing(null);
                      }}
                      className="h-7 flex-1 py-0.5"
                    />
                    <Button variant="primary" onClick={() => void rename(tag)}>Save</Button>
                    <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                  </>
                ) : (
                  <>
                    <TagBadge tag={tag} color={tagColors[tag]} />
                    <span className="text-xs text-neutral-400">
                      {counts.get(tag)} command{counts.get(tag) === 1 ? "" : "s"}
                    </span>
                    <span className="ml-auto flex items-center gap-1">
                      {TAG_COLORS.map((c) => (
                        <Tip key={c} text={c}>
                          <button
                            aria-label={`${tag}: ${c}`}
                            onClick={() => void onColor(tag, c)}
                            className={cx(
                              "h-4 w-4 rounded-full transition hover:scale-110",
                              DOT[c],
                              tagColors[tag] === c && "ring-2 ring-neutral-900 ring-offset-1 dark:ring-white dark:ring-offset-neutral-900",
                            )}
                          />
                        </Tip>
                      ))}
                      {tagColors[tag] && (
                        <Button variant="ghost" onClick={() => void onColor(tag, null)}>clear</Button>
                      )}
                      <Button variant="ghost" onClick={() => { setEditing(tag); setDraft(tag); }}>Rename</Button>
                      <Button
                        variant="danger"
                        onClick={async () => {
                          const n = counts.get(tag) ?? 0;
                          if (!confirm(`Remove “${tag}” from ${n} command${n === 1 ? "" : "s"}? The commands stay.`)) return;
                          await onDelete(tag);
                          toast({ title: `Removed the “${tag}” tag`, body: `${n} command(s) updated`, tone: "warn" });
                        }}
                      >
                        Delete
                      </Button>
                    </span>
                  </>
                )}
              </div>
            </li>
          ))}
          {tags.length === 0 && <li className="px-3 py-6 text-center text-sm text-neutral-500">No tags yet.</li>}
        </ul>

        <div className="flex justify-end border-t border-neutral-200 pt-3 dark:border-neutral-800">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}
