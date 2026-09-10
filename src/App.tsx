import { useEffect, useRef, useState, type ReactNode } from "react";
import { useStore } from "./lib/useStore.ts";
import { KINDS, page as renderPage, type KindId } from "./kinds.tsx";
import { kind } from "../shared/kinds.ts";
import { ExportDialog } from "./components/ExportDialog.tsx";
import { ImportDialog } from "./components/ImportDialog.tsx";
import { Button, Tip, cx } from "./components/ui.tsx";
import { ToastHost } from "./components/Toast.tsx";
import { inPanel, hidePanel, openMainWindow, onView } from "./lib/bridge.ts";
import { Palette } from "./components/Palette.tsx";
import { TagsDialog } from "./components/TagsDialog.tsx";
import { SettingsDialog } from "./components/SettingsDialog.tsx";
import { AnalyticsPage } from "./pages/AnalyticsPage.tsx";


export default function App() {
  return (
    <ToastHost>
      {inPanel ? <Panel /> : <Shelf />}
    </ToastHost>
  );
}

/** The menubar surface: the palette, and a way through to everything else. */
function Panel() {
  const { entries, tagColors, loading, markUsed, refresh } = useStore();

  // The panel window is hidden rather than closed, so its entries would stay as
  // they were at launch: anything added in the main window never showed up here.
  useEffect(() => {
    const onVisibility = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [refresh]);

  // Settings is a management surface, so the panel hands it to the main window
  // rather than showing a dialog in a 640px strip.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        void openMainWindow("settings");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-full flex-col">
      {loading ? (
        <p className="p-6 text-sm text-neutral-500">Loading…</p>
      ) : (
        <Palette
          embedded
          entries={entries}
          tagColors={tagColors}
          onUsed={markUsed}
          onClose={() => void hidePanel()}
        />
      )}
      <footer className="flex items-center gap-3 border-t border-neutral-200 px-3 py-1.5 text-[11px] text-neutral-400 dark:border-neutral-800">
        <button
          onClick={() => void openMainWindow()}
          className="underline decoration-dotted underline-offset-2 hover:text-neutral-700 dark:hover:text-neutral-200"
        >
          Manage entries
        </button>
        <span className="ml-auto">esc hides</span>
      </footer>
    </div>
  );
}

/** The sidebar shows the kinds, plus the views that are not a kind. */
type View = KindId | "analytics";

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-2 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
      {children}
    </p>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-neutral-300 px-1 font-mono text-[10px] dark:border-neutral-700">
      {children}
    </kbd>
  );
}

function SidebarButton({
  icon, label, onClick, active, children,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  active?: boolean;
  children?: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition",
        active
          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
          : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800",
      )}
    >
      <span className="w-4 text-center opacity-60">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {children}
    </button>
  );
}

function Shelf() {
  const {
    entries, config, tagColors, error, loading, refresh,
    save, remove, toggleExport, togglePin, toggleArchive, markUsed, setTagColor, renameTag, deleteTag,
  } = useStore();
  const [current, setCurrent] = useState<View>("alias");
  const [dialog, setDialog] = useState<"export" | "import" | "tags" | "settings" | null>(null);
  const [palette, setPalette] = useState(false);
  const pane = useRef<HTMLElement>(null);

  // Each view starts at the top. Otherwise a scrolled page carries its offset
  // into the next one and opens halfway down.
  useEffect(() => { pane.current?.scrollTo({ top: 0 }); }, [current]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette(true);
      }
      // The mac convention, and the only shortcut people guess without being told.
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setDialog("settings");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => onView((view) => { if (view === "settings") setDialog("settings"); }), []);

  const counts = Object.fromEntries(
    KINDS.map((k) => [k.id, entries.filter((e) => e.kind === k.id).length]),
  ) as Record<KindId, number>;

  return (
    <div className="flex h-full">
      <nav className="flex w-52 shrink-0 flex-col border-r border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="px-2 py-2">
          <span className="text-lg font-bold tracking-tight">Ramz</span>
          <p className="text-xs text-neutral-400">your local command shelf</p>
          <button
            onClick={() => setPalette(true)}
            className="mt-2 flex w-full items-center gap-2 rounded-md border border-neutral-200 px-2 py-1 text-xs text-neutral-400 transition hover:border-neutral-300 hover:text-neutral-600 dark:border-neutral-800 dark:hover:border-neutral-700 dark:hover:text-neutral-300"
          >
            <span className="flex-1 text-left">Find a command</span>
            <Kbd>⌘K</Kbd>
          </button>
        </div>

        <SectionLabel>Library</SectionLabel>
        <div className="space-y-0.5">
          {KINDS.map((k) => (
            <button
              key={k.id}
              onClick={() => setCurrent(k.id)}
              className={cx(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition",
                current === k.id
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800",
              )}
            >
              <span className="w-4 text-center opacity-60">{k.icon}</span>
              <span className="flex-1 text-left">{k.plural}</span>
              <span className="text-xs opacity-50">{counts[k.id]}</span>
            </button>
          ))}
        </div>

        <SectionLabel>Organise</SectionLabel>
        <SidebarButton icon="#" label="Tags" onClick={() => setDialog("tags")}>
          <span className="text-xs opacity-50">{new Set(entries.flatMap((e) => e.tags)).size}</span>
        </SidebarButton>

        <div className="mt-auto space-y-0.5 border-t border-neutral-200 pt-2 dark:border-neutral-800">
          <SidebarButton
            icon="◔"
            label="Analytics"
            active={current === "analytics"}
            onClick={() => setCurrent("analytics")}
          />
          <SidebarButton icon="⚙" label="Settings" onClick={() => setDialog("settings")}>
            <Kbd>⌘,</Kbd>
          </SidebarButton>
        </div>
      </nav>

      <main ref={pane} className="flex-1 overflow-y-auto">
        {error && (
          <div className="border-b border-red-300 bg-red-50 px-6 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-300">
            {error}. Is <span className="font-mono">npm run dev</span> running?
          </div>
        )}
        {loading ? (
          <p className="p-6 text-sm text-neutral-500">Loading…</p>
        ) : current === "analytics" ? (
          <AnalyticsPage entries={entries} onChanged={refresh} />
        ) : (
          renderPage(current, {
            entries,
            tagColors,
            onSave: save,
            onDelete: remove,
            onToggleExport: toggleExport,
            onTogglePin: togglePin,
            onToggleArchive: toggleArchive,
            onUsed: markUsed,
            onTagColor: setTagColor,
            // Only a kind that reaches the shell has anything to import or export.
            actions: kind(current).exportable ? (
              <>
                <Tip text="Read aliases and functions out of an existing shell file or folder. The source file is never modified.">
                  <Button onClick={() => setDialog("import")}>Import</Button>
                </Tip>
                <Tip text="Write the ticked commands into your shell files, and wire your shell to load them. One way: Ramz writes, your shell reads.">
                  <Button onClick={() => setDialog("export")}>Sync to shell</Button>
                </Tip>
              </>
            ) : undefined,
          })
        )}
      </main>

      {palette && (
        <Palette entries={entries} tagColors={tagColors} onClose={() => setPalette(false)} onUsed={markUsed} />
      )}

      {dialog === "settings" && (
        <SettingsDialog
          config={config}
          onClose={() => setDialog(null)}
          onChanged={refresh}
        />
      )}

      {dialog === "tags" && (
        <TagsDialog
          entries={entries}
          tagColors={tagColors}
          onClose={() => setDialog(null)}
          onColor={setTagColor}
          onRename={renameTag}
          onDelete={deleteTag}
        />
      )}

      {dialog === "export" && <ExportDialog config={config} onClose={() => setDialog(null)} onChanged={refresh} />}
      {dialog === "import" && <ImportDialog onClose={() => setDialog(null)} onImported={refresh} />}
    </div>
  );
}
