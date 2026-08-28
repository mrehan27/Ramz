import { useEffect, useState } from "react";
import { Button } from "./ui.tsx";
import { useToast } from "./Toast.tsx";

export function CopyButton({
  value, label = "Copy", variant = "outline", onCopied,
}: {
  value: string;
  label?: string;
  variant?: "outline" | "primary" | "ghost";
  onCopied?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <Button
      variant={variant}
      disabled={!value.trim()}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        toast({ title: "Copied to clipboard", body: value.split("\n")[0].slice(0, 90) });
        onCopied?.();
      }}
    >
      {copied ? "Copied" : label}
    </Button>
  );
}
