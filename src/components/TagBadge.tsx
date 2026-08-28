import { useEffect, useRef } from "react";
import { TAG_COLORS, type TagColor } from "../../shared/schema.ts";
import { cx } from "./ui.tsx";

/** Written out in full so Tailwind keeps every variant in the build. */
const SWATCH: Record<TagColor, string> = {
  slate: "bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
  red: "bg-red-200 text-red-800 dark:bg-red-500/20 dark:text-red-300",
  amber: "bg-amber-200 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300",
  green: "bg-green-200 text-green-800 dark:bg-green-500/20 dark:text-green-300",
  teal: "bg-teal-200 text-teal-800 dark:bg-teal-500/20 dark:text-teal-300",
  blue: "bg-blue-200 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300",
  violet: "bg-violet-200 text-violet-800 dark:bg-violet-500/20 dark:text-violet-300",
  pink: "bg-pink-200 text-pink-800 dark:bg-pink-500/20 dark:text-pink-300",
};

const DOT: Record<TagColor, string> = {
  slate: "bg-slate-400", red: "bg-red-500", amber: "bg-amber-500", green: "bg-green-500",
  teal: "bg-teal-500", blue: "bg-blue-500", violet: "bg-violet-500", pink: "bg-pink-500",
};

export const tagClass = (color?: TagColor) =>
  color ? SWATCH[color] : "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400";

export function TagBadge({
  tag, color, active, onClick, onContextMenu, className,
}: {
  tag: string;
  color?: TagColor;
  active?: boolean;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  className?: string;
}) {
  const Element = onClick ? "button" : "span";
  return (
    <Element
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={cx(
        "rounded px-1.5 py-0.5 text-xs font-medium transition",
        tagClass(color),
        active && "ring-2 ring-neutral-900 ring-offset-1 dark:ring-white dark:ring-offset-neutral-900",
        onClick && "cursor-pointer hover:opacity-80",
        className,
      )}
    >
      {tag}
    </Element>
  );
}

/** Palette popover: pick a colour for a tag, or clear it. */
export function TagColorPicker({
  tag, color, onPick, onClose,
}: {
  tag: string;
  color?: TagColor;
  onPick: (c: TagColor | null) => void;
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", away);
    window.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      window.removeEventListener("keydown", key);
    };
  }, [onClose]);

  return (
    <div
      ref={box}
      className="absolute left-0 top-full z-50 mt-1 w-max rounded-lg border border-neutral-200 bg-white p-2 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
    >
      <p className="mb-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">colour for “{tag}”</p>
      <div className="flex items-center gap-1">
        {TAG_COLORS.map((c) => (
          <button
            key={c}
            aria-label={c}
            onClick={() => onPick(c)}
            className={cx(
              "h-5 w-5 rounded-full transition hover:scale-110",
              DOT[c],
              color === c && "ring-2 ring-neutral-900 ring-offset-1 dark:ring-white dark:ring-offset-neutral-900",
            )}
          />
        ))}
        <button
          onClick={() => onPick(null)}
          className="ml-1 rounded px-1.5 py-0.5 text-[11px] text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          clear
        </button>
      </div>
    </div>
  );
}
