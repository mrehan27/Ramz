import { forwardRef, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

const variants = {
  primary: "bg-neutral-900 text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200",
  ghost: "text-neutral-600 hover:bg-neutral-200/70 dark:text-neutral-400 dark:hover:bg-neutral-800",
  outline: "border border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800",
  danger: "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50",
};

export function Button({
  variant = "outline",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition",
        "disabled:cursor-not-allowed disabled:opacity-40",
        variants[variant],
        className,
      )}
    />
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        {...props}
        ref={ref}
        className={cx(
          "w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none",
          "focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-500",
          className,
        )}
      />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return (
      <select
        {...props}
        ref={ref}
        className={cx(
          "rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm outline-none",
          "focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-500",
          className,
        )}
      />
    );
  },
);

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cx(
        "w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 font-mono text-sm outline-none",
        "focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-500",
        className,
      )}
    />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{label}</span>
      {children}
      {hint && <span className="block text-xs text-neutral-400">{hint}</span>}
    </label>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "rounded px-1.5 py-0.5 text-xs font-medium",
        "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Modal({
  title, onClose, children, wide,
}: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={cx(
          "my-8 w-full rounded-xl border border-neutral-200 bg-white shadow-xl",
          "dark:border-neutral-800 dark:bg-neutral-900",
          wide ? "max-w-3xl" : "max-w-xl",
        )}
      >
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <h2 className="text-sm font-semibold">{title}</h2>
          <Button variant="ghost" onClick={onClose} aria-label="Close">✕</Button>
        </header>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

/**
 * Hover/focus explainer. Drawn in a portal at the top of the page and placed
 * where it fits: above by default, below when there is no room, and kept inside
 * the window. Drawn inside the layout it was clipped by any scrolling parent,
 * and ran off the edge for buttons at the top right.
 */
export function Tip({ text, children }: { text: string; children: ReactNode }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const el = tip.current;
    const a = anchor.current?.getBoundingClientRect();
    if (!open || !el || !a) return;
    const GAP = 6;
    const EDGE = 8;
    const left = Math.max(EDGE, Math.min(a.left + a.width / 2 - el.offsetWidth / 2, window.innerWidth - el.offsetWidth - EDGE));
    const above = a.top - el.offsetHeight - GAP;
    el.style.left = `${left}px`;
    el.style.top = `${above >= EDGE ? above : a.bottom + GAP}px`;
    el.style.opacity = "1";
  }, [open, text]);

  // A fixed tooltip would otherwise hang in the air while the page scrolls under it.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [open]);

  return (
    <span
      ref={anchor}
      className="inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && createPortal(
        <span
          ref={tip}
          role="tooltip"
          // Placed by the layout effect; hidden until then so it never flashes in the wrong spot.
          style={{ opacity: 0 }}
          className={cx(
            "pointer-events-none fixed z-[100] w-max max-w-xs",
            "rounded-md bg-neutral-900 px-2 py-1 text-xs font-normal leading-snug text-white shadow-lg transition-opacity",
            "dark:bg-neutral-700",
          )}
        >
          {text}
        </span>,
        document.body,
      )}
    </span>
  );
}

export function Info({ text }: { text: string }) {
  return (
    <Tip text={text}>
      <span
        tabIndex={0}
        className="flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-neutral-300 text-[10px] text-neutral-500 dark:border-neutral-600 dark:text-neutral-400"
      >
        i
      </span>
    </Tip>
  );
}
