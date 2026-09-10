import { useState } from "react";
import { KINDS, kind } from "../../shared/kinds.ts";
import type { Entry } from "../../shared/schema.ts";
import { api } from "../lib/api.ts";
import { useToast } from "../components/Toast.tsx";
import { Button, Info, cx } from "../components/ui.tsx";

/** Everything here is derived from one number per entry: how often you copied it. */
export function AnalyticsPage({ entries, onChanged }: { entries: Entry[]; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const copies = entries.reduce((n, e) => n + e.useCount, 0);
  const used = entries.filter((e) => e.useCount > 0);
  const top = [...used].sort((a, b) => b.useCount - a.useCount).slice(0, 10);
  const recent = [...used].filter((e) => e.lastUsedAt).sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt)).slice(0, 6);
  const tags = new Set(entries.flatMap((e) => e.tags)).size;
  const archived = entries.filter((e) => e.archived).length;
  const byKind = KINDS.map((k) => ({
    def: k,
    count: entries.filter((e) => e.kind === k.id).length,
    copies: entries.filter((e) => e.kind === k.id).reduce((n, e) => n + e.useCount, 0),
  }));
  const busiest = Math.max(1, ...byKind.map((k) => k.count));

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-lg font-semibold">Analytics</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          What you actually reach for. Counted on every copy out of Ramz, so it is evidence for what
          deserves to become an alias, and for what can go.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Entries" value={entries.length} hint={archived ? `${archived} archived` : undefined} />
        <Stat label="Copies" value={copies} />
        <Stat label="Ever copied" value={used.length} hint={`${entries.length - used.length} never`} />
        <Stat label="Tags" value={tags} />
      </div>

      <Section title="Library" hint="How the shelf is made up.">
        <div className="space-y-1.5">
          {byKind.map(({ def, count, copies: n }) => (
            <div key={def.id} className="flex items-center gap-3 text-sm">
              <span className="w-4 shrink-0 text-center opacity-60">{def.icon}</span>
              <span className="w-24 shrink-0 text-neutral-600 dark:text-neutral-400">{def.plural}</span>
              <Bar fraction={count / busiest} />
              <span className="w-8 shrink-0 text-right font-mono text-xs">{count}</span>
              <span className="w-20 shrink-0 text-right text-xs text-neutral-400">
                {n} {n === 1 ? "copy" : "copies"}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Most copied"
        hint="An alias earns its place here first. Anything near the top and still only a snippet is worth promoting."
      >
        {top.length === 0 ? (
          <Empty>Nothing copied yet. The counts start the first time you use ⌘K.</Empty>
        ) : (
          <div className="space-y-1.5">
            {top.map((e) => (
              <div key={e.id} className="flex items-center gap-3 text-sm">
                <span className="w-14 shrink-0 text-[11px] uppercase tracking-wide text-neutral-400">
                  {kind(e.kind).singular}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {e.name && <span className="font-mono text-emerald-700 dark:text-emerald-400">{e.name} </span>}
                  {e.title}
                </span>
                <Bar fraction={e.useCount / top[0].useCount} className="w-24" />
                <span className="w-10 shrink-0 text-right font-mono text-xs">{e.useCount}×</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Last copied" hint="The tail end of what you have been working on.">
        {recent.length === 0 ? (
          <Empty>Nothing yet.</Empty>
        ) : (
          <div className="space-y-1">
            {recent.map((e) => (
              <div key={e.id} className="flex items-center gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate">{e.name || e.title}</span>
                <span className="shrink-0 text-xs text-neutral-400">{ago(e.lastUsedAt)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <section className="flex items-center gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <Button
          variant="danger"
          disabled={busy || copies === 0}
          onClick={async () => {
            if (!confirm(`Reset counters on ${used.length} entries? The entries themselves stay.`)) return;
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
        <p className="text-xs text-neutral-400">
          Counts copies out of Ramz only. An alias you type in your own shell is invisible here.
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
      {hint && <p className="text-[11px] text-neutral-400">{hint}</p>}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold">
        {title}
        <Info text={hint} />
      </h2>
      {children}
    </section>
  );
}

function Bar({ fraction, className }: { fraction: number; className?: string }) {
  return (
    <div className={cx("h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800", className)}>
      <div
        className="h-full rounded-full bg-neutral-400 dark:bg-neutral-500"
        style={{ width: `${Math.max(2, Math.round(fraction * 100))}%` }}
      />
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
      {children}
    </p>
  );
}

function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days}d ago` : new Date(iso).toLocaleDateString();
}
