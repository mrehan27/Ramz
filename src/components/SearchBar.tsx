import { useEffect, useRef, useState } from "react";
import type { TagColor } from "../../shared/schema.ts";
import { Input, Tip } from "./ui.tsx";
import { TagBadge, TagColorPicker } from "./TagBadge.tsx";

export function SearchBar({
  query, onQuery, tags, tag, onTag, count, tagColors, onTagColor,
}: {
  query: string;
  onQuery: (v: string) => void;
  tags: string[];
  tag: string | null;
  onTag: (v: string | null) => void;
  count: number;
  tagColors: Record<string, TagColor>;
  onTagColor?: (tag: string, color: TagColor | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [picking, setPicking] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = document.activeElement?.tagName.match(/INPUT|TEXTAREA/);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        ref.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === ref.current) {
        onQuery("");
        ref.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onQuery]);

  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Input
          ref={ref}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search name, description, command…"
          className="py-2 pr-16"
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-neutral-400">
          {query ? `${count}` : "/"}
        </span>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.map((t) => (
            <span key={t} className="relative">
              <Tip text={onTagColor ? "Click to filter, right-click to recolour" : "Click to filter"}>
                <TagBadge
                  tag={t}
                  color={tagColors[t]}
                  active={tag === t}
                  onClick={() => onTag(tag === t ? null : t)}
                  onContextMenu={onTagColor ? (e) => { e.preventDefault(); setPicking(t); } : undefined}
                />
              </Tip>
              {picking === t && onTagColor && (
                <TagColorPicker
                  tag={t}
                  color={tagColors[t]}
                  onPick={(c) => { onTagColor(t, c); setPicking(null); }}
                  onClose={() => setPicking(null)}
                />
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
