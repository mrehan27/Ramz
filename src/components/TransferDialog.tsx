import { useState } from "react";
import { KINDS } from "../kinds.tsx";
import type { KindId } from "../../shared/kinds.ts";
import type { Resolution } from "../../shared/transfer.ts";
import { api, type TransferPreview } from "../lib/api.ts";
import { Badge, Button, Input, Modal, Select, Tip } from "./ui.tsx";
import { CopyButton } from "./CopyButton.tsx";
import { useToast } from "./Toast.tsx";

/**
 * Moving a library between machines, or handing part of one to someone else.
 * Nothing is written until the summary has been seen: an import that silently
 * overwrote an entry would be the one thing you cannot undo.
 */
export function TransferDialog({
  mode, onClose, onImported,
}: { mode: "export" | "import"; onClose: () => void; onImported: () => void }) {
  return mode === "export"
    ? <ExportPane onClose={onClose} />
    : <ImportPane onClose={onClose} onImported={onImported} />;
}

function ExportPane({ onClose }: { onClose: () => void }) {
  const [kinds, setKinds] = useState<Set<KindId>>(new Set());
  const [file, setFile] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ file: string; entries: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: KindId) =>
    setKinds((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const write = () => {
    setBusy(true);
    setError(null);
    api.transferExport({ file: file.trim() || undefined, kinds: [...kinds] })
      .then(setDone)
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  };

  return (
    <Modal title="Export to a file" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs leading-relaxed text-neutral-500">
          One JSON file: entries, their tags and their colours. Plain text on purpose, so you can
          read it, diff it, or fix a line by hand. Usage counters travel with it and stay yours on
          the way back in.
        </p>

        <div className="space-y-1.5">
          <div className="text-xs font-medium text-neutral-500">
            What to include {kinds.size === 0 && <span className="font-normal">(everything)</span>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map((k) => (
              <button
                key={k.id}
                onClick={() => toggle(k.id)}
                aria-pressed={kinds.has(k.id)}
                className={
                  kinds.has(k.id)
                    ? "rounded-md bg-neutral-900 px-2 py-1 text-xs font-medium text-white dark:bg-white dark:text-neutral-900"
                    : "rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
                }
              >
                {k.icon} {k.plural}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="text-xs font-medium text-neutral-500">Where</div>
          <Input
            value={file}
            onChange={(e) => setFile(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && write()}
            placeholder="~/Downloads/ramz-<today>.json"
            className="font-mono text-xs"
          />
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        {done ? (
          <div className="space-y-2 rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
            <p className="text-sm">
              Wrote {done.entries} {done.entries === 1 ? "entry" : "entries"}.
            </p>
            <p className="break-all font-mono text-xs text-neutral-500">{done.file}</p>
            <div className="flex gap-2">
              <CopyButton value={done.file} label="Copy path" />
              <Button onClick={onClose}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={write} disabled={busy}>
              {busy ? "Writing…" : "Export"}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

const CHOICES: { value: Resolution; label: string }[] = [
  { value: "skip", label: "Keep mine" },
  { value: "overwrite", label: "Take theirs" },
  { value: "keepBoth", label: "Keep both" },
];

function ImportPane({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [file, setFile] = useState("");
  const [preview, setPreview] = useState<TransferPreview | null>(null);
  const [fallback, setFallback] = useState<Resolution>("skip");
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const look = () => {
    setBusy(true);
    setError(null);
    setPreview(null);
    api.transferPreview(file.trim())
      .then((p) => {
        setPreview(p);
        setResolutions({});
      })
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  };

  const apply = () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    api.runTransferImport({ file: preview.file, resolutions, fallback })
      .then((r) => {
        const parts = [
          r.added && `${r.added} added`,
          r.overwritten && `${r.overwritten} replaced`,
          r.copied && `${r.copied} kept as copies`,
          r.skipped && `${r.skipped} left alone`,
        ].filter(Boolean);
        toast({
          title: parts.length ? "Imported" : "Nothing to import",
          body: parts.length ? parts.join(", ") : "every entry in that file is already here",
        });
        onImported();
        onClose();
      })
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  };

  const decided = (key: string) => resolutions[key] ?? fallback;
  const toDecide = preview?.conflicts.filter((c) => !c.identical) ?? [];

  return (
    <Modal wide title="Import from a file" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Input
            value={file}
            onChange={(e) => setFile(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && look()}
            placeholder="a .json file exported from Ramz"
            className="flex-1 font-mono text-xs"
          />
          <Button onClick={look} disabled={busy || !file.trim()}>Preview</Button>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        {preview && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge>{preview.fresh.length} new</Badge>
              <Badge>{preview.conflicts.length} already here</Badge>
              {preview.newTags.length > 0 && <Badge>{preview.newTags.length} new tags</Badge>}
              <span className="text-xs text-neutral-500">
                of {preview.total} in the file
                {preview.exportedAt && `, exported ${preview.exportedAt.slice(0, 10)}`}
              </span>
            </div>

            {preview.fresh.length > 0 && (
              <details className="rounded-md border border-neutral-200 dark:border-neutral-800">
                <summary className="cursor-pointer px-3 py-2 text-sm">
                  {preview.fresh.length} to add
                </summary>
                <ul className="space-y-1 border-t border-neutral-200 px-3 py-2 text-xs dark:border-neutral-800">
                  {preview.fresh.map((e) => (
                    <li key={e.id} className="flex items-center gap-2">
                      <span className="text-neutral-400">{KINDS.find((k) => k.id === e.kind)?.icon}</span>
                      <span className="truncate">{e.title}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {toDecide.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-medium text-neutral-500">
                    {toDecide.length} to decide
                    <Tip text="Keep mine changes nothing. Take theirs replaces the content but keeps your usage counts. Keep both adds a second copy.">
                      <span className="ml-1 cursor-help text-neutral-400">?</span>
                    </Tip>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-neutral-500">
                    all:
                    <Select
                      value={fallback}
                      onChange={(e) => {
                        setFallback(e.target.value as Resolution);
                        setResolutions({});
                      }}
                    >
                      {CHOICES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </Select>
                  </label>
                </div>

                <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
                  {toDecide.map((c) => (
                    <li key={c.key} className="flex flex-wrap items-center gap-2 px-3 py-2">
                      <span className="text-neutral-400">{KINDS.find((k) => k.id === c.incoming.kind)?.icon}</span>
                      <span className="min-w-0 flex-1 truncate text-sm">{c.incoming.title}</span>
                      <span className="text-xs text-neutral-500">
                        {c.match === "id" ? "same entry" : "same title"}
                      </span>
                      <div className="flex gap-1">
                        {CHOICES.map((choice) => (
                          <button
                            key={choice.value}
                            onClick={() => setResolutions((r) => ({ ...r, [c.key]: choice.value }))}
                            aria-pressed={decided(c.key) === choice.value}
                            className={
                              decided(c.key) === choice.value
                                ? "rounded bg-neutral-900 px-2 py-0.5 text-xs font-medium text-white dark:bg-white dark:text-neutral-900"
                                : "rounded border border-neutral-300 px-2 py-0.5 text-xs text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
                            }
                          >
                            {choice.label}
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {preview.conflicts.length > toDecide.length && (
              <p className="text-xs text-neutral-500">
                {preview.conflicts.length - toDecide.length} already match exactly, so there is
                nothing to decide for those.
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button onClick={onClose}>Cancel</Button>
              <Button variant="primary" onClick={apply} disabled={busy}>
                {busy ? "Importing…" : "Import"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
