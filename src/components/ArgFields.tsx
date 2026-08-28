import type { Param } from "../../shared/schema.ts";
import { Input } from "./ui.tsx";

/** The fill-in used by anything that resolves placeholders in more than one place. */
export function ArgFields({
  params, values, onChange, hint,
}: {
  params: Param[];
  values: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  hint: string;
}) {
  if (params.length === 0) return null;
  return (
    <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
      <p className="mb-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">{hint}</p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {params.map((p, i) => (
          <label key={p.name} className="space-y-1">
            <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
              {p.name}
              {!p.default && <span className="text-red-500"> *</span>}
              {p.description && <span className="ml-1 font-sans">· {p.description}</span>}
            </span>
            <Input
              autoFocus={i === 0}
              value={values[p.name] ?? ""}
              placeholder={p.default ? `${p.default} (default)` : p.name}
              onChange={(e) => onChange({ ...values, [p.name]: e.target.value })}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
