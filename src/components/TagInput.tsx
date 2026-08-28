import { useState } from "react";
import type { TagColor } from "../../shared/schema.ts";
import { Input, cx } from "./ui.tsx";
import { TagBadge } from "./TagBadge.tsx";

/** Tag entry that suggests what already exists, so tags don't fork on a typo. */
export function TagInput({
  value, onChange, known, colors,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  known: string[];
  colors: Record<string, TagColor>;
}) {
  const [draft, setDraft] = useState("");

  const add = (tag: string) => {
    const t = tag.trim().replace(/,+$/, "");
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft("");
  };

  const suggestions = known
    .filter((t) => !value.includes(t) && t.toLowerCase().includes(draft.trim().toLowerCase()))
    .slice(0, 12);

  const isNew = draft.trim().length > 0 && !known.includes(draft.trim());

  return (
    <div className="space-y-1.5">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((t) => (
            <span key={t} className="inline-flex items-center gap-1">
              <TagBadge tag={t} color={colors[t]} />
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== t))}
                aria-label={`Remove ${t}`}
                className="text-xs text-neutral-400 hover:text-red-600 dark:hover:text-red-400"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(draft); }
          if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => draft.trim() && add(draft)}
        placeholder="type to filter or add…"
      />

      {(suggestions.length > 0 || isNew) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {suggestions.map((t) => (
            <button key={t} type="button" onClick={() => add(t)}>
              <TagBadge tag={t} color={colors[t]} className="hover:opacity-80" />
            </button>
          ))}
          {isNew && (
            <button
              type="button"
              onClick={() => add(draft)}
              className={cx(
                "rounded border border-dashed border-neutral-400 px-1.5 py-0.5 text-xs",
                "text-neutral-500 hover:border-neutral-600 hover:text-neutral-800",
                "dark:border-neutral-600 dark:text-neutral-400 dark:hover:text-neutral-200",
              )}
            >
              + new tag “{draft.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}
