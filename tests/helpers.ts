import type { Entry } from "../shared/schema.ts";

const NOW = "2026-01-01T00:00:00.000Z";

/** A complete entry, so a test states only the field it is about. */
export function entry(over: Partial<Entry> & { kind?: Entry["kind"] } = {}): Entry {
  return {
    id: over.id ?? "id",
    kind: "alias",
    name: "",
    title: "t",
    description: "",
    tags: [],
    command: "",
    params: [],
    steps: [],
    variants: [],
    body: "",
    asFunction: false,
    pinned: false,
    order: 0,
    archived: false,
    exported: true,
    useCount: 0,
    lastUsedAt: "",
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  } as Entry;
}

export const param = (name: string, dflt = "") =>
  ({ name, description: "", default: dflt, required: !dflt });
