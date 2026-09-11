import { useCallback, useState } from "react";
import type { KindId } from "../../shared/kinds.ts";
import type { Entry } from "../../shared/schema.ts";
import { moved, sortEntries, type SortKey } from "../../shared/sort.ts";

/**
 * One place for "what order is this list in, and can I drag it".
 *
 * Dragging is only offered under the manual sort, and never while searching:
 * dropping a row into a relevance-ranked list would look like it worked and
 * then undo itself on the next keystroke.
 */
export function useOrdering(
  kind: KindId,
  entries: Entry[],
  sort: SortKey,
  onReorder: (kind: KindId, ids: string[]) => void,
  searching = false,
) {
  const [held, setHeld] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const sorted = searching ? entries : sortEntries(entries, sort);
  const canDrag = sort === "manual" && !searching;

  const drop = useCallback((from: string, to: string) => {
    const ids = sorted.map((e) => e.id);
    const next = moved(ids, ids.indexOf(from), ids.indexOf(to));
    if (next !== ids) onReorder(kind, next);
  }, [kind, onReorder, sorted]);

  /**
   * Only the grip is draggable. Making a whole card draggable costs you text
   * selection inside it and makes its inputs awkward to focus.
   */
  const gripProps = (entry: Entry) =>
    !canDrag
      ? undefined
      : {
          draggable: true,
          onDragStart: (e: React.DragEvent) => {
            setHeld(entry.id);
            e.dataTransfer.effectAllowed = "move";
            // Firefox refuses to start a drag unless some data is set.
            e.dataTransfer.setData("text/plain", entry.id);
          },
          onDragEnd: () => {
            setHeld(null);
            setOver(null);
          },
        };

  /** The row is the drop target, and shows where the drop would land. */
  const rowProps = (entry: Entry) =>
    !canDrag
      ? {}
      : {
          onDragOver: (e: React.DragEvent) => {
            if (!held || held === entry.id) return;
            e.preventDefault();
            setOver(entry.id);
          },
          onDragLeave: () => setOver((id) => (id === entry.id ? null : id)),
          onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            if (held && held !== entry.id) drop(held, entry.id);
            setHeld(null);
            setOver(null);
          },
        };

  /** Dim the row being carried, outline the one it would land on. */
  const dragClass = (entry: Entry) =>
    !canDrag
      ? ""
      : [
          held === entry.id && "opacity-40",
          over === entry.id && "ring-2 ring-neutral-400 dark:ring-neutral-500",
        ].filter(Boolean).join(" ");

  return { sorted, canDrag, gripProps, rowProps, dragClass };
}
