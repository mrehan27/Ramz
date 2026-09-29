import { cx } from "./ui.tsx";

/**
 * A placeholder's choices, under its field. Buttons rather than a dropdown for
 * the reason in VariantPicker: a native menu does not open in the panel. Typing
 * narrows them, Tab reaches them, and the field still takes anything.
 */
export function Choices({
  choices, value, onPick,
}: {
  choices: string[];
  value: string;
  onPick: (choice: string) => void;
}) {
  const typed = value.trim().toLowerCase();
  const shown = !typed || choices.includes(value)
    ? choices
    : choices.filter((c) => c.toLowerCase().includes(typed));
  if (shown.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Choices">
      {shown.map((c) => (
        <button
          key={c}
          type="button"
          data-choice={c}
          aria-pressed={c === value}
          onClick={() => onPick(c)}
          className={cx(
            "max-w-full truncate rounded-full px-2 py-0.5 font-mono text-[11px] transition",
            c === value
              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
              : "border border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800",
          )}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
