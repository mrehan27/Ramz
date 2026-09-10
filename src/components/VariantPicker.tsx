import { forwardRef } from "react";
import type { Variant } from "../../shared/schema.ts";
import { Select, cx } from "./ui.tsx";

/** Chosen from the list, so it cannot be misspelt. */
const MANAGE = "__manage__";

/**
 * The 10% that changes, as a set of named presets. Picking one fills the fields
 * below; they stay editable, so a preset is a starting point rather than a lock.
 * "Custom" is always there for the run that matches no preset.
 *
 * Two layouts, for one macOS reason: a native `<select>` opens an NSMenu, which
 * needs the app to be active. The panel takes key focus without activating, so a
 * dropdown there would not open at all. The panel gets buttons instead.
 */
export function VariantPicker({
  variants, active, onPick, onManage, compact = false,
}: {
  variants: Variant[];
  active: string | null;
  onPick: (variant: Variant | null) => void;
  /** Offered as the last entry in the list. Left out where there is no editor to open. */
  onManage?: () => void;
  /** In a row rather than a panel: no label, and a width that cannot push the row about. */
  compact?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
      {!compact && <span className="shrink-0">Variant</span>}
      <Select
        className={compact ? "max-w-[9rem] truncate" : undefined}
        value={active ?? ""}
        onChange={(e) => {
          // Hand focus back, so the next Enter copies rather than reopening this.
          e.target.blur();
          const chosen = e.target.value;
          // A real variant wins, so a variant named like the action still works.
          const found = variants.find((v) => v.name === chosen);
          if (found) return onPick(found);
          if (chosen === MANAGE) return onManage?.();
          onPick(null);
        }}
      >
        <option value="">Custom (type your own)</option>
        {variants.map((v) => (
          <option key={v.name} value={v.name}>
            {[v.name, v.isDefault ? "(default)" : "", v.description ? `· ${v.description}` : ""].filter(Boolean).join(" ")}
          </option>
        ))}
        {onManage && <option value={MANAGE}>{variants.length ? "Manage variants…" : "Add a variant…"}</option>}
      </Select>
    </label>
  );
}

/** The panel's version: no native menu, and every option one keystroke away. */
export const VariantChips = forwardRef<HTMLDivElement, {
  variants: Variant[];
  active: string | null;
  onPick: (variant: Variant | null) => void;
}>(function VariantChips({ variants, active, onPick }, ref) {
  const options: (Variant | null)[] = [null, ...variants];
  return (
    <div ref={ref} className="flex flex-wrap items-center gap-1" role="group" aria-label="Variant">
      {options.map((v, i) => (
        <button
          key={v?.name ?? "custom"}
          data-variant={i}
          aria-pressed={(v?.name ?? null) === active}
          onClick={() => onPick(v)}
          title={v?.description || (v ? v.name : "Type every value yourself")}
          className={cx(
            "rounded-full px-2 py-0.5 text-xs font-medium transition",
            (v?.name ?? null) === active
              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
              : "border border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800",
          )}
        >
          <span className="mr-1 opacity-50">{i + 1}</span>
          {v?.name ?? "Custom"}
        </button>
      ))}
    </div>
  );
});

/**
 * Switching variant keeps what you typed by hand. Only placeholders some variant
 * owns get replaced: the version you just typed is not the platform's business,
 * and losing it silently disabled Copy.
 */
export function valuesFor(
  variants: Variant[],
  chosen: Variant | null,
  previous: Record<string, string>,
): Record<string, string> {
  const owned = new Set(variants.flatMap((v) => Object.keys(v.values)));
  const kept = Object.fromEntries(Object.entries(previous).filter(([k]) => !owned.has(k)));
  return chosen ? { ...kept, ...chosen.values } : kept;
}
