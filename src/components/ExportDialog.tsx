import { useEffect, useState } from "react";
import { api, type Config, type ExportPreview } from "../lib/api.ts";
import { Badge, Button, Modal, cx } from "./ui.tsx";
import { CopyButton } from "./CopyButton.tsx";
import { useToast } from "./Toast.tsx";

/**
 * Two questions, answered in order: is your shell connected, and do you want
 * to write the aliases now. Everything else (the generated files, per-rc
 * buttons, uninstalling) is under Details, because you need it once or never.
 */
export function ExportDialog({
  config, onClose, onChanged,
}: {
  config: Config | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [tab, setTab] = useState<"aliases" | "loader">("aliases");
  const [synced, setSynced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const load = () => api.exportPreview().then(setPreview).catch((e) => setError(e.message));
  useEffect(() => { void load(); }, []);

  // You paste the block in a terminal and come back: that return is when to recheck.
  useEffect(() => {
    window.addEventListener("focus", onChanged);
    return () => window.removeEventListener("focus", onChanged);
  }, [onChanged]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  };

  const rc = config?.rc ?? [];
  const wired = rc.filter((r) => r.hasLine);
  // Where to paste it if nothing loads Ramz yet: the first rc that exists, zsh first.
  const target = rc.find((r) => r.exists) ?? rc[0];
  const errors = preview?.problems.filter((p) => p.level === "error") ?? [];
  const warns = preview?.problems.filter((p) => p.level === "warn") ?? [];
  const reload = `. ${preview?.loaderFile ?? ""}`;

  return (
    <Modal wide title="Sync to shell" onClose={onClose}>
      {!preview && !error && <p className="text-sm text-neutral-500">Reading…</p>}
      {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {preview && (
        <div className="space-y-5 text-sm">
          {wired.length > 0 ? (
            <p className="flex items-center gap-2">
              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">connected</Badge>
              <span className="text-neutral-600 dark:text-neutral-400">
                {wired.map((r) => r.name).join(" and ")} loads Ramz.
              </span>
            </p>
          ) : (
            <section className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-950/20">
              <p>
                <b className="font-medium">One-time setup.</b> Paste this at the end of{" "}
                <span className="font-mono">~/{target?.name ?? ".zshrc"}</span>. It only reads a file Ramz
                owns, and does nothing if that file is gone.
              </p>
              <pre className="overflow-x-auto rounded bg-white p-2 font-mono text-xs dark:bg-neutral-950">
                {config?.sourceBlock}
              </pre>
              <div className="flex items-center gap-2">
                <CopyButton value={config?.sourceBlock ?? ""} />
                <span className="text-xs text-neutral-500">This dialog shows it as connected once it is there.</span>
              </div>
            </section>
          )}

          <section className="space-y-3">
            <p className="text-neutral-600 dark:text-neutral-400">
              {preview.count} {preview.count === 1 ? "alias" : "aliases"} into{" "}
              <span className="font-mono">{preview.configDir}</span>, a directory Ramz owns outright.
            </p>

            {errors.length > 0 && (
              <ul className="space-y-1 rounded-md border border-red-300 bg-red-50 p-3 dark:border-red-500/40 dark:bg-red-950/30">
                {errors.map((p, i) => (
                  <li key={i} className="text-red-700 dark:text-red-300">
                    <span className="font-mono">{p.name}</span>: {p.message}
                  </li>
                ))}
              </ul>
            )}
            {warns.length > 0 && (
              <ul className="space-y-1 rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
                {warns.map((p, i) => (
                  <li key={i} className="text-neutral-600 dark:text-neutral-400">
                    <span className="font-mono">{p.name}</span>: {p.message}
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                disabled={errors.length > 0 || busy}
                onClick={() => run(async () => {
                  const res = await api.runExport();
                  setSynced(true);
                  toast({ title: `Synced ${res.count} ${res.count === 1 ? "alias" : "aliases"}` });
                })}
              >
                {busy ? "Syncing…" : `Sync ${preview.count} ${preview.count === 1 ? "alias" : "aliases"}`}
              </Button>
            </div>

            {synced && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                <span>New terminals have them already. For the one you are in:</span>
                <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono dark:bg-neutral-950">{reload}</code>
                <CopyButton value={reload} />
              </div>
            )}
          </section>

          <details className="rounded-md border border-neutral-200 dark:border-neutral-800">
            <summary className="cursor-pointer px-3 py-2 text-neutral-500">Details</summary>
            <div className="space-y-5 border-t border-neutral-200 p-3 dark:border-neutral-800">
              <div className="space-y-2">
                <div className="flex items-center gap-1 border-b border-neutral-200 dark:border-neutral-800">
                  {([["aliases", "aliases.sh"], ["loader", "init.sh"]] as const).map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setTab(id)}
                      className={cx(
                        "-mb-px border-b-2 px-3 py-1.5 font-mono text-xs",
                        tab === id
                          ? "border-neutral-900 text-neutral-900 dark:border-white dark:text-white"
                          : "border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                  <span className="ml-auto pb-1 text-[11px] text-neutral-400">what Sync writes</span>
                </div>
                <pre className="max-h-60 overflow-auto rounded-md bg-neutral-100 p-3 font-mono text-xs leading-relaxed dark:bg-neutral-950">
                  {tab === "aliases" ? preview.aliases : preview.loader}
                </pre>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-neutral-500">
                  Or let Ramz edit an rc file for you. It adds or removes only the fenced block above.
                </p>
                <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
                  {rc.map((r) => (
                    <li key={r.file} className="flex items-center gap-3 px-3 py-2">
                      <span className="font-mono">{r.name}</span>
                      {!r.exists && <span className="text-xs text-neutral-400">does not exist</span>}
                      {r.hasLine && <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">loads Ramz</Badge>}
                      <span className="ml-auto" />
                      <Button
                        disabled={busy}
                        onClick={() => run(async () => {
                          await api.rc(r.file, r.hasLine ? "remove" : "install");
                          toast({
                            title: r.hasLine ? `Removed Ramz from ${r.name}` : `Added Ramz to ${r.name}`,
                            body: "Takes effect in new terminals.",
                            tone: r.hasLine ? "warn" : undefined,
                          });
                        })}
                      >
                        {r.hasLine ? "Remove" : r.exists ? "Add" : "Create and add"}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-neutral-500">
                  Removes only the files Ramz wrote. Your entries stay, and the rc block goes quiet.
                </p>
                <Button
                  variant="danger"
                  disabled={busy || !preview.installed}
                  onClick={() => run(async () => {
                    const res = await api.removeFiles();
                    const kept = res.kept.length ? ` Left alone: ${res.kept.join(", ")}.` : "";
                    toast({ title: `Removed ${res.removed.length} generated file${res.removed.length === 1 ? "" : "s"}`, body: kept || undefined, tone: "warn" });
                  })}
                >
                  Remove files
                </Button>
              </div>
            </div>
          </details>

          <div className="flex justify-end border-t border-neutral-200 pt-3 dark:border-neutral-800">
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
