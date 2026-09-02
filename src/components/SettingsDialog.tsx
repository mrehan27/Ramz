import { useState } from "react";
import type { Entry, Prefs } from "../../shared/schema.ts";
import { api, type Config } from "../lib/api.ts";
import { inApp, revealStore } from "../lib/bridge.ts";
import { Button, Info, Modal, cx } from "./ui.tsx";
import { CopyButton } from "./CopyButton.tsx";
import { useToast } from "./Toast.tsx";

export function SettingsDialog({
  entries, config, onClose, onChanged,
}: {
  entries: Entry[];
  config: Config | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const savePref = async (patch: Partial<Prefs>) => {
    setBusy(true);
    try {
      await api.updatePrefs(patch);
      onChanged();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "could not save" });
    } finally {
      setBusy(false);
    }
  };

  const copies = entries.reduce((n, e) => n + e.useCount, 0);
  const counted = entries.filter((e) => e.useCount > 0);
  const top = [...counted].sort((a, b) => b.useCount - a.useCount).slice(0, 5);
  const byKind = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.kind] = (acc[e.kind] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Modal title="Settings" onClose={onClose}>
      <div className="space-y-5 text-sm">
        <section className="space-y-2">
          <h3 className="flex items-center gap-1.5 font-semibold">
            Your data
            <Info text="Entries, tags, counters and these preferences are all in that one file. Copy it to another machine and Ramz there is this Ramz." />
          </h3>
          <Row label="Entries" value={config?.storePath} />
          <Row label="Generated shell files" value={config?.configDir} />
          <p className="text-xs leading-relaxed text-neutral-400">
            Ordinary files on disk: back them up, edit them by hand, or point elsewhere with
            RAMZ_STORE and RAMZ_DIR.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <CopyButton value={config?.storePath ?? ""} label="Copy path" />
            {inApp && <Button onClick={() => void revealStore()}>Show in Finder</Button>}
          </div>
        </section>

        {inApp && (
          <section className="space-y-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
            <h3 className="font-semibold">App</h3>
            <Pref
              label="Show in the Dock"
              hint="Off leaves only the menubar icon and ⌘⇧K. A Dock tile you pinned stays either way."
              checked={config?.prefs.showInDock ?? true}
              busy={busy}
              onChange={(showInDock) => savePref({ showInDock })}
            />
            <Pref
              label="Close the panel when I click away"
              hint="Off keeps it open until you press Esc, click the menubar icon, or press ⌘⇧K again."
              checked={config?.prefs.hideOnBlur ?? true}
              busy={busy}
              onChange={(hideOnBlur) => savePref({ hideOnBlur })}
            />
          </section>
        )}

        <section className="space-y-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <h3 className="font-semibold">Shell</h3>
          <ShellStatus config={config} />
        </section>

        <section className="space-y-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <h3 className="font-semibold">Library</h3>
          <p className="text-neutral-600 dark:text-neutral-400">
            {entries.length} entries: {Object.entries(byKind).map(([k, n]) => `${n} ${k}${n === 1 ? "" : "s"}`).join(", ")}
            {entries.some((e) => e.archived) && `, ${entries.filter((e) => e.archived).length} archived`}
          </p>
        </section>

        <section className="space-y-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <h3 className="flex items-center gap-1.5 font-semibold">
            Usage
            <Info text="Counted whenever you copy something from Ramz. The evidence for what deserves to be a shell alias." />
          </h3>
          <p className="text-neutral-600 dark:text-neutral-400">
            {copies} {copies === 1 ? "copy" : "copies"} across {counted.length} {counted.length === 1 ? "entry" : "entries"}.
          </p>
          {top.length > 0 && (
            <ol className="space-y-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              {top.map((e) => (
                <li key={e.id}>
                  <span className="font-mono">{e.useCount}×</span> {e.name || e.title}
                </li>
              ))}
            </ol>
          )}
          <Button
            variant="danger"
            disabled={busy || copies === 0}
            onClick={async () => {
              if (!confirm(`Reset counters on ${counted.length} entries? The entries themselves stay.`)) return;
              setBusy(true);
              try {
                const res = await api.resetUsage();
                toast({ title: `Reset ${res.cleared} counter${res.cleared === 1 ? "" : "s"}`, tone: "warn" });
                onChanged();
              } finally {
                setBusy(false);
              }
            }}
          >
            Reset all counters
          </Button>
        </section>
      </div>

      <div className="mt-5 flex justify-end border-t border-neutral-200 pt-3 dark:border-neutral-800">
        <Button onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}

function Pref({
  label, hint, checked, busy, onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  busy: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={checked} disabled={busy} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
      <p className="pl-6 text-xs text-neutral-400">{hint}</p>
    </div>
  );
}

/** Where the aliases have actually got to: in Ramz, on disk, or in your shell. */
function ShellStatus({ config }: { config: Config | null }) {
  if (!config) return null;
  const state = !config.installed
    ? {
        dot: "bg-neutral-400",
        title: "Not synced yet",
        body: "Your aliases live in Ramz only. Sync to shell writes them to the directory above and adds one line to your shell rc.",
      }
    : config.rc.some((r) => r.hasLine)
      ? {
          dot: "bg-emerald-500",
          title: "Synced and loaded",
          body: "New shells pick up changes on their own. Reload an open one to see the latest.",
        }
      : {
          dot: "bg-amber-500",
          title: "Synced, but not loaded",
          body: "The files are on disk, but no shell rc sources them yet. Add the line from the Shell dialog.",
        };
  return (
    <div className="flex gap-2.5">
      <span className={cx("mt-1.5 size-2 shrink-0 rounded-full", state.dot)} />
      <div className="min-w-0">
        <p className="font-medium">{state.title}</p>
        <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">{state.body}</p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-44 shrink-0 text-neutral-500 dark:text-neutral-400">{label}</span>
      <code className="min-w-0 flex-1 truncate rounded bg-neutral-100 px-2 py-1 font-mono text-xs dark:bg-neutral-950">
        {value ?? "…"}
      </code>
      <CopyButton value={value ?? ""} variant="ghost" />
    </div>
  );
}
