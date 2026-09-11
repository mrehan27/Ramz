import { SORTS, type SortKey } from "../../shared/sort.ts";
import { Select, Tip } from "./ui.tsx";

/**
 * The order was pinned-first then alphabetical, with nothing saying so. This
 * says so, and lets you change it per kind.
 */
export function SortPicker({
  value, onChange, disabled,
}: { value: SortKey; onChange: (key: SortKey) => void; disabled?: string }) {
  const current = SORTS.find((s) => s.key === value) ?? SORTS[1];
  return (
    <Tip text={disabled ?? `${current.hint}. Pinned entries stay on top.`}>
      <label className="flex items-center gap-1.5 text-xs text-neutral-500">
        <span>Sort</span>
        <Select
          value={value}
          onChange={(e) => onChange(e.target.value as SortKey)}
          aria-label="Sort order"
          className="py-0.5 text-xs"
        >
          {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </Select>
      </label>
    </Tip>
  );
}
