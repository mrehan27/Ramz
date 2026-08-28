import { useEffect, useState } from "react";
import { api, type Config, type ExportPreview } from "../lib/api.ts";
import { Badge, Button, Info, Modal, cx } from "./ui.tsx";
import { CopyButton } from "./CopyButton.tsx";
import { useToast } from "./Toast.tsx";

export function ExportDialog({
  config, onClose, onChanged,
}: {
  config: Config | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [tab, setTab] = useState<"aliases" | "loader">("aliases");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const reload = () => {
    api.exportPreview().then(setPreview).catch((e) => setError(e.message));
    onChanged();
  };

  useEffect(() => {
    api.exportPreview().then(setPreview).catch((e) => setError(e.message));
  }, []);

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setError(null);
    try {
      setNote(await fn());
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  };

  const errors = preview?.problems.filter((p) => p.level === "error") ?? [];
  const warns = preview?.problems.filter((p) => p.level === "warn") ?? [];

  return (
    <Modal wide title="Shell" onClose={onClose}>
      {!preview && !error && <p className="text-sm text-neutral-500">Building preview…</p>}
      {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {preview && (
        <div className="space-y-5">
          <ol className="space-y-1.5 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm dark:border-neutral-800 dark:bg-neutral-950/40">
            <li className="flex gap-2">
              <span className="font-mono text-xs text-neutral-400">1</span>
              <span className="flex-1">
                <b className="font-medium">Write the files</b>: creates{" "}
                <span className="font-mono text-xs">init.sh</span> and{" "}
                <span className="font-mono text-xs">aliases.sh</span> in{" "}
                <span className="font-mono text-xs">{preview.configDir}</span>. Nothing outside that directory changes.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-mono text-xs text-neutral-400">2</span>
              <span className="flex-1">
                <b className="font-medium">Add one line to your shell rc</b>: once, with the buttons below. Until you
                do, the commands exist on disk but your shell has never heard of them.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-mono text-xs text-neutral-400">3</span>
              <span className="flex-1">
                <b className="font-medium">Reload</b>: every new terminal picks it up by itself. An already-open shell
                needs <span className="font-mono text-xs">. {preview.loaderFile}</span>{" "}
                <Info text="Sourcing the loader re-reads the generated file into the shell you are sitting in. Opening a new tab does the same thing." />
              </span>
            </li>
          </ol>

          <section className="space-y-3">
            <div className="text-sm text-neutral-600 dark:text-neutral-400">
              <span className="font-mono">{preview.count}</span> {preview.count === 1 ? "entry" : "entries"} into{" "}
              <span className="font-mono">{preview.configDir}</span>, a directory RAMZ owns outright. Nothing else on the
              system is touched, and deleting it removes RAMZ from your shell completely.
            </div>

            {errors.length > 0 && (
              <ul className="space-y-1 rounded-md border border-red-300 bg-red-50 p-3 text-sm dark:border-red-500/40 dark:bg-red-950/30">
                {errors.map((p, i) => (
                  <li key={i} className="text-red-700 dark:text-red-300">
                    <span className="font-mono">{p.name}</span>: {p.message}
                  </li>
                ))}
              </ul>
            )}

            {warns.length > 0 && (
              <ul className="space-y-1 rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-800">
                {warns.map((p, i) => (
                  <li key={i} className="text-neutral-600 dark:text-neutral-400">
                    <span className="font-mono">{p.name}</span>: {p.message}
                  </li>
                ))}
              </ul>
            )}

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
              <span className="ml-auto pb-1 text-[11px] text-neutral-400">
                {tab === "aliases" ? "regenerated on every export" : "sources the files next to it"}
              </span>
            </div>

            <pre className="max-h-72 overflow-auto rounded-md bg-neutral-100 p-3 font-mono text-xs leading-relaxed dark:bg-neutral-950">
              {tab === "aliases" ? preview.aliases : preview.loader}
            </pre>

            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                disabled={errors.length > 0 || busy}
                onClick={() => run(async () => {
                  const res = await api.runExport();
                  const wired = config?.rc.some((r) => r.hasLine);
                  toast({
                    title: `Wrote ${res.count} ${res.count === 1 ? "entry" : "entries"}`,
                    body: wired
                      ? "New shells load this automatically. To update the shell you are in now:"
                      : "Files are on disk. Add the line to your rc below, then reload:",
                    run: `. ${res.loaderFile}`,
                  });
                  return `Wrote ${res.count} to ${res.configDir}.`;
                })}
              >
                Write files
              </Button>
              <CopyButton value={tab === "aliases" ? preview.aliases : preview.loader} label="Copy file" />
              {preview.installed && <Badge>files written</Badge>}
            </div>
          </section>

          <section className="space-y-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              Load it from your shell
              <Info text="Your rc file runs on every new shell. This one line tells it to read the loader. RAMZ never adds anything else to it." />
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              One line, tagged <span className="font-mono">{"# ramz"}</span> so it can be removed again exactly. It does
              nothing if the directory is gone.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded bg-neutral-100 px-2 py-1.5 font-mono text-xs dark:bg-neutral-950">
                {config?.sourceLine}
              </code>
              <CopyButton value={config?.sourceLine ?? ""} />
            </div>
            <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
              {(config?.rc ?? []).map((rc) => (
                <li key={rc.file} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="font-mono">{rc.name}</span>
                  {!rc.exists && <span className="text-xs text-neutral-400">does not exist</span>}
                  {rc.hasLine && <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">loaded</Badge>}
                  <span className="ml-auto" />
                  {rc.hasLine ? (
                    <Button
                      disabled={busy}
                      onClick={() => run(async () => {
                        await api.rc(rc.file, "remove");
                        toast({
                          title: `Removed the RAMZ line from ${rc.name}`,
                          body: "Shells already running keep the commands until they are restarted.",
                          run: "exec $SHELL",
                          tone: "warn",
                        });
                        return `Removed the RAMZ line from ${rc.name}.`;
                      })}
                    >
                      Remove line
                    </Button>
                  ) : (
                    <Button
                      disabled={busy}
                      onClick={() => run(async () => {
                        await api.rc(rc.file, "install");
                        toast({
                          title: `Added one line to ${rc.name}`,
                          body: "Applies to new terminals. To apply it to this one, restart your shell:",
                          run: "exec $SHELL",
                        });
                        return `Added the RAMZ line to ${rc.name}.`;
                      })}
                    >
                      {rc.exists ? "Add line" : "Create + add line"}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              Uninstall
              <Info text="Removes the generated files only. Your entries stay in RAMZ, and you can export them again at any time." />
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Deletes only the files RAMZ generated (anything else in the directory is left, and reported back), then
              removes the directory if it is empty. Your entries stay in the store.
            </p>
            <Button
              variant="danger"
              disabled={busy || !preview.installed}
              onClick={() => run(async () => {
                const res = await api.removeFiles();
                const kept = res.kept.length ? ` Left alone: ${res.kept.join(", ")}.` : "";
                toast({
                  title: `Removed ${res.removed.length} generated file${res.removed.length === 1 ? "" : "s"}`,
                  body: "The rc line is inert now. Commands stay loaded in shells that are already open until they restart.",
                  tone: "warn",
                });
                return `Removed ${res.removed.length} file(s)${res.dirRemoved ? " and the directory" : ""}.${kept}`;
              })}
            >
              Remove generated files
            </Button>
          </section>

          {note && <p className="text-sm text-emerald-600 dark:text-emerald-400">{note}</p>}

          <div className="flex justify-end border-t border-neutral-200 pt-3 dark:border-neutral-800">
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
