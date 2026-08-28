import { useEffect, useMemo, useState } from "react";
import { KINDS, kind as kindDef, type KindId } from "../../shared/kinds.ts";
import { entryPlaceholders, type Entry, type EntryInput, type Param, type Step } from "../../shared/schema.ts";
import { Button, Field, Input, Modal, Textarea, Tip, cx } from "./ui.tsx";
import { TagInput } from "./TagInput.tsx";
import type { TagColor } from "../../shared/schema.ts";

const blank = (kind: KindId): EntryInput => ({
  kind,
  name: "",
  title: "",
  description: "",
  tags: [],
  command: "",
  params: [],
  steps: kindDef(kind).defaults?.steps ?? [],
  body: "",
  asFunction: false,
  pinned: false,
  archived: false,
  exported: kindDef(kind).defaults?.exported ?? false,
});

export function EntryDialog({
  entry, kind, onClose, onSave, knownTags, tagColors,
}: {
  entry?: Entry;
  kind: KindId;
  onClose: () => void;
  onSave: (input: EntryInput) => Promise<void>;
  knownTags: string[];
  tagColors: Record<string, TagColor>;
}) {
  const [form, setForm] = useState<EntryInput>(() => (entry ? { ...entry } : blank(kind)));
  const [error, setError] = useState<string | null>(null);
  const { fields, exportable } = kindDef(form.kind);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof EntryInput>(key: K, value: EntryInput[K]) =>
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "kind") {
        const def = kindDef(value as KindId);
        next.exported = def.defaults?.exported ? f.exported || !entry : false;
        if (def.defaults?.steps && next.steps.length === 0) next.steps = def.defaults.steps;
      }
      return next;
    });

  // Params are derived from the template so the two can never drift apart.
  // Runbooks collect theirs from every step, so one fill-in covers the whole thing.
  const detected = useMemo(() => entryPlaceholders(form), [form.command, form.steps]);
  useEffect(() => {
    setForm((f) => {
      const kept = new Map(f.params.map((p) => [p.name, p]));
      const next: Param[] = detected.map(
        (n) => kept.get(n) ?? { name: n, description: "", default: "", required: true },
      );
      const same = next.length === f.params.length && next.every((p, i) => p === f.params[i]);
      return same ? f : { ...f, params: next };
    });
  }, [detected]);

  const setParam = (i: number, patch: Partial<Param>) =>
    setForm((f) => ({ ...f, params: f.params.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));

  const setStep = (i: number, patch: Partial<Step>) =>
    setForm((f) => ({ ...f, steps: f.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "save failed");
      setSaving(false);
    }
  };

  return (
    <Modal wide title={`${entry ? "Edit" : "New"} ${form.kind}`} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Kind" hint="A snippet is copy-only; an alias is also written to your shell file.">
          <div className="flex gap-1">
            {KINDS.map((k) => (
              <Tip key={k.id} text={k.blurb}>
                <button
                  type="button"
                  onClick={() => set("kind", k.id)}
                  className={cx(
                    "rounded-md px-2.5 py-1 text-sm transition",
                    form.kind === k.id
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                      : "border border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800",
                  )}
                >
                  {k.singular}
                </button>
              </Tip>
            ))}
          </div>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          {fields.name && (
            <Field label="Shell name" hint={form.params.length > 0 ? "exports as a function (letters, digits, _ only)" : "exports as an alias"}>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="gcm" className="font-mono" />
            </Field>
          )}
          <Field label="Title">
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Checkout main" />
          </Field>
        </div>

        <Field label="Description (optional)" hint="Shown on the card, and as a comment above the exported command.">
          <Input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="what it does, in a few words" />
        </Field>

        {fields.body && (
          <Field label="Note" hint="Wrap commands in ``` fences to make them copyable. Use ## for headings and --- for a divider.">
            <Textarea
              rows={12}
              value={form.body}
              onChange={(e) => set("body", e.target.value)}
              placeholder={"## Staging\n\nAPI: https://api.staging.example.com\n\n```\nkubectl port-forward svc/api 8080:80\n```"}
            />
          </Field>
        )}

        {fields.command && (
          <Field label="Command" hint="Use {{name}} for arguments. They become a fill-in form here and positional args in the exported function.">
            <Textarea rows={3} value={form.command} onChange={(e) => set("command", e.target.value)} placeholder="kubectl apply -f {{file}} -n {{ns}}" />
          </Field>
        )}

        {form.params.length > 0 && (
          <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
            <p className="mb-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Arguments (detected from the command). Description and default are optional
            </p>
            <div className="space-y-2">
              {form.params.map((p, i) => (
                <div key={p.name} className="grid items-center gap-2 sm:grid-cols-[7rem_1fr_1fr_auto]">
                  <span className="font-mono text-xs text-amber-700 dark:text-amber-400">${i + 1} {p.name}</span>
                  <Input value={p.description} placeholder="description" onChange={(e) => setParam(i, { description: e.target.value })} />
                  <Input value={p.default} placeholder="default value" className="font-mono" onChange={(e) => setParam(i, { default: e.target.value })} />
                  <label className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                    <input type="checkbox" checked={p.required} onChange={(e) => setParam(i, { required: e.target.checked })} />
                    required
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {fields.steps && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Steps</p>
            {form.steps.map((s, i) => (
              <div key={i} className="space-y-2 rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-400">{i + 1}</span>
                  <Input value={s.title} placeholder="Step title" onChange={(e) => setStep(i, { title: e.target.value })} />
                  <Button variant="danger" onClick={() => set("steps", form.steps.filter((_, j) => j !== i))}>✕</Button>
                </div>
                <Textarea rows={2} value={s.body} placeholder="Notes (optional)" onChange={(e) => setStep(i, { body: e.target.value })} />
                <Textarea rows={1} value={s.command} placeholder="Command (optional)" onChange={(e) => setStep(i, { command: e.target.value })} />
              </div>
            ))}
            <Button onClick={() => set("steps", [...form.steps, { title: "", body: "", command: "" }])}>+ Add step</Button>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tags" hint="pick an existing one, or type a new name">
            <TagInput
              value={form.tags}
              onChange={(tags) => set("tags", tags)}
              known={knownTags}
              colors={tagColors}
            />
          </Field>
          {exportable && (
            <div className="flex flex-col justify-end gap-1.5 pb-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.exported} onChange={(e) => set("exported", e.target.checked)} />
                Include in exported shell file
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.asFunction || form.params.length > 0 || form.command.includes("\n")}
                  disabled={form.params.length > 0 || form.command.includes("\n")}
                  onChange={(e) => set("asFunction", e.target.checked)}
                />
                <span className={form.params.length > 0 || form.command.includes("\n") ? "text-neutral-400" : ""}>
                  Export as a function
                </span>
              </label>
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.archived} onChange={(e) => set("archived", e.target.checked)} />
          Archived: kept, but out of the lists and the palette
        </label>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={saving} onClick={submit}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </div>
    </Modal>
  );
}
