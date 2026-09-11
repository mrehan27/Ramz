import type { DragEventHandler } from "react";
import { Tip } from "./ui.tsx";

export type GripProps = {
  draggable: boolean;
  onDragStart: DragEventHandler;
  onDragEnd: () => void;
} | undefined;

/**
 * The drag handle, shown only under the manual sort. Nothing else in the row is
 * draggable, so text stays selectable and the inputs stay usable.
 */
export function Grip({ props }: { props: GripProps }) {
  if (!props) return null;
  return (
    <Tip text="Drag to reorder">
      <span
        {...props}
        // Some rows are themselves a button: grabbing the grip must not open them.
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
        onMouseDown={(e) => e.stopPropagation()}
        aria-label="Drag to reorder"
        className="cursor-grab select-none px-0.5 text-neutral-300 transition hover:text-neutral-500 active:cursor-grabbing dark:text-neutral-600 dark:hover:text-neutral-400"
      >
        ⠿
      </span>
    </Tip>
  );
}
