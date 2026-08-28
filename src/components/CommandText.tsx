import { PLACEHOLDER } from "../../shared/schema.ts";
import { cx } from "./ui.tsx";

/** Renders a command template with {{param}} highlighted. */
export function CommandText({ command, className }: { command: string; className?: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of command.matchAll(PLACEHOLDER)) {
    const start = m.index!;
    if (start > last) parts.push(command.slice(last, start));
    parts.push(
      <span key={start} className="rounded bg-amber-200/60 px-1 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300">
        {m[1]}
      </span>,
    );
    last = start + m[0].length;
  }
  parts.push(command.slice(last));

  return (
    <code
      className={cx(
        "block whitespace-pre-wrap break-all rounded-md bg-neutral-100 px-2.5 py-2 font-mono text-[13px] leading-relaxed",
        "text-neutral-800 dark:bg-neutral-950 dark:text-neutral-200",
        className,
      )}
    >
      {parts}
    </code>
  );
}
