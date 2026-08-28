import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, cx } from "./ui.tsx";

export type Toast = {
  id: number;
  title: string;
  body?: string;
  /** Shell command the user should run next, shown copyable. */
  run?: string;
  tone?: "ok" | "warn";
};

const Ctx = createContext<(t: Omit<Toast, "id">) => void>(() => {});

export const useToast = () => useContext(Ctx);

export function ToastHost({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { ...t, id }]);
    setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), t.run ? 12000 : 5000);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
        {items.map((t) => (
          <ToastCard key={t.id} toast={t} onClose={() => setItems((s) => s.filter((i) => i.id !== t.id))} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastCard({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <div
      className={cx(
        "pointer-events-auto rounded-lg border p-3 text-sm shadow-lg",
        toast.tone === "warn"
          ? "border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-950/40"
          : "border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{toast.title}</p>
          {toast.body && <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{toast.body}</p>}
        </div>
        <button onClick={onClose} className="shrink-0 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200">✕</button>
      </div>
      {toast.run && (
        <div className="mt-2 flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded bg-neutral-100 px-2 py-1 font-mono text-xs dark:bg-neutral-950">
            {toast.run}
          </code>
          <Button
            variant="ghost"
            onClick={async () => { await navigator.clipboard.writeText(toast.run!); setCopied(true); }}
          >
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      )}
    </div>
  );
}
