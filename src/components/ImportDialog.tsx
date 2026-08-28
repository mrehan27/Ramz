import { useEffect, useState } from "react";
import { api, type ScanResult } from "../lib/api.ts";
import { Badge, Button, Input, Modal } from "./ui.tsx";
import { useToast } from "./Toast.tsx";
import { CommandText } from "./CommandText.tsx";

/** Source file name becomes the tag, so imported groups stay filterable. */
const tagFor = (name: string) => name.replace(/\.(sh|zsh|bash)$/, "");

export function ImportDialog({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [path, setPath] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const run = (target?: string) => {
    setScan(null);
    setError(null);
    api.importScan(target)
      .then((r) => {
        setScan(r);
        setPath(r.target);
        setPicked(new Set(
          r.sources.flatMap((s) => s.found.filter((f) => f.status === "new").map((f) => `${s.file}::${f.name}`)),
        ));
      })
      .catch((e) => setError(e.message));
  };

  useEffect(() => { run(); }, []);

  const toggle = (key: string) =>
    setPicked((s) => {
      const next = new Set(s);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const total = scan?.sources.reduce((n, s) => n + s.found.length, 0) ?? 0;

  return (
    <Modal wide title="Import from shell files" onClose={onClose}>
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run(path)}
              placeholder="a file or a directory of shell files"
              className="flex-1 font-mono text-xs"
            />
            <Button onClick={() => run(path)}>Scan</Button>
          </div>
          {(scan?.candidates.length ?? 0) > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
              <span>known:</span>
              {scan?.candidates.map((c) => (
                <button
                  key={c}
                  onClick={() => { setPath(c); run(c); }}
                  className="rounded border border-neutral-300 px-1.5 py-0.5 font-mono hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  {c.replace(/^.*\//, "")}
                </button>
              ))}
            </div>
          )}
          <p className="text-xs text-neutral-400">
            Read-only: the file you scan is never modified. Nothing is exported until you say so.
          </p>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {!scan && !error && <p className="text-sm text-neutral-500">Scanning…</p>}

        {scan && (
          <>
            <div className="max-h-[26rem] space-y-4 overflow-y-auto">
              {scan.sources.map((src) => {
                const keys = src.found.map((f) => `${src.file}::${f.name}`);
                const allOn = keys.length > 0 && keys.every((k) => picked.has(k));
                return (
                  <section key={src.file} className="space-y-2">
                    <div className="flex items-center gap-2 border-b border-neutral-200 pb-1 dark:border-neutral-800">
                      <span className="font-mono text-sm font-semibold">{src.name}</span>
                      <Badge>tag: {tagFor(src.name)}</Badge>
                      <span className="text-xs text-neutral-400">{src.found.length} found</span>
                      <button
                        onClick={() => setPicked((s) => {
                          const next = new Set(s);
                          for (const k of keys) allOn ? next.delete(k) : next.add(k);
                          return next;
                        })}
                        className="ml-auto text-xs text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200"
                      >
                        {allOn ? "none" : "all"}
                      </button>
                    </div>

                    {src.found.map((f) => {
                      const key = `${src.file}::${f.name}`;
                      return (
                        <label key={key} className="flex gap-3 rounded-md border border-neutral-200 p-2.5 dark:border-neutral-800">
                          <input type="checkbox" className="mt-1" checked={picked.has(key)} onChange={() => toggle(key)} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-400">{f.name}</span>
                              <Badge>{f.form}</Badge>
                              {f.params.length > 0 && <Badge>{f.params.length} arg{f.params.length > 1 ? "s" : ""}</Badge>}
                              {f.status === "duplicate" && (
                                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">already here</Badge>
                              )}
                            </div>
                            {f.title !== f.name && <p className="mt-1 text-xs text-neutral-500">{f.title}</p>}
                            <CommandText command={f.command} className="mt-1.5" />
                          </div>
                        </label>
                      );
                    })}

                    {src.skipped.length > 0 && (
                      <ul className="space-y-0.5 pl-1 text-xs text-neutral-400">
                        {src.skipped.map((s, i) => (
                          <li key={i}>
                            skipped <span className="font-mono">{s.line}</span>: {s.reason}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
              {total === 0 && <p className="text-sm text-neutral-500">Nothing importable found.</p>}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
              <span className="mr-auto text-xs text-neutral-400">{picked.size} of {total} selected</span>
              <Button onClick={onClose}>Cancel</Button>
              <Button
                variant="primary"
                disabled={picked.size === 0 || busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const res = await api.runImport(
                      scan.sources.flatMap((src) =>
                        src.found
                          .filter((f) => picked.has(`${src.file}::${f.name}`))
                          .map((f) => ({
                            name: f.name,
                            command: f.command,
                            asFunction: f.form === "function",
                            title: f.title,
                            description: f.description,
                            tags: [tagFor(src.name)],
                            params: f.params,
                          })),
                      ),
                    );
                    toast({
                      title: `Imported ${res.added} command${res.added === 1 ? "" : "s"}`,
                      body: res.rejected.length
                        ? `${res.rejected.length} skipped: ${res.rejected.map((r) => `${r.name} (${r.reason})`).join(", ")}`
                        : "They live in RAMZ only until you run Export.",
                      tone: res.rejected.length ? "warn" : "ok",
                    });
                    onImported();
                    onClose();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "import failed");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Import {picked.size || ""}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
