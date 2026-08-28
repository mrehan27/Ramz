/**
 * What a kind of entry is, in one place.
 *
 * Everything generic asks this registry rather than testing `kind === "alias"`:
 * the nav, search, the palette, export, validation, and which fields the editor
 * shows. Adding a kind means adding an entry here and a page in `src/kinds.tsx`.
 *
 * Data-level only, so the server can import it. Anything React lives in
 * `src/kinds.tsx`.
 */
import type { Entry } from "./schema.ts";

export const KIND_IDS = ["alias", "snippet", "runbook", "note"] as const;
export type KindId = (typeof KIND_IDS)[number];

/** Entries written before runbooks were called runbooks. */
export const LEGACY_KINDS: Record<string, KindId> = { process: "runbook" };

/** What search should look at. `primary` is weighted well above `strong`. */
export type SearchDoc = { primary: string[]; strong: string[]; weak: string[] };

export type Issue = { path: string; message: string };

export type KindDef = {
  id: KindId;
  /** Sidebar label, and the page heading. */
  plural: string;
  singular: string;
  icon: string;
  blurb: string;
  /** Reaches the shell on export. Only aliases do, and only when ticked. */
  exportable: boolean;
  /** Offered in the palette: one thing to put on the clipboard. */
  inPalette: boolean;
  /** Editor fields this kind uses. Everything else is hidden. */
  fields: { name?: boolean; command?: boolean; steps?: boolean; body?: boolean };
  /** What a new entry of this kind starts as. */
  defaults?: { exported?: boolean; steps?: { title: string; body: string; command: string }[] };
  search: (e: Entry) => SearchDoc;
  /** Kind-specific validation, run by the schema for every entry. */
  validate: (e: Entry) => Issue[];
};

const required = (value: string, path: string, message: string): Issue[] =>
  value.trim() ? [] : [{ path, message }];

/** What bash and zsh accept for both aliases and functions. */
export const SHELL_NAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

const commandSearch = (e: Entry): SearchDoc => ({
  primary: [e.name, e.title],
  strong: [e.description],
  weak: [e.command, ...e.tags],
});

export const KINDS: KindDef[] = [
  {
    id: "alias",
    plural: "Aliases",
    singular: "Alias",
    icon: "⌘",
    blurb: "Exported to your shell file. Entries with arguments become shell functions.",
    exportable: true,
    inPalette: true,
    fields: { name: true, command: true },
    defaults: { exported: true },
    search: commandSearch,
    validate: (e) => [
      ...(!e.name
        ? [{ path: "name", message: "aliases need a shell name" }]
        : SHELL_NAME.test(e.name)
          ? []
          : [{ path: "name", message: "invalid shell name" }]),
      ...required(e.command, "command", "command is required"),
    ],
  },
  {
    id: "snippet",
    plural: "Snippets",
    singular: "Snippet",
    icon: "⧉",
    blurb: "Frequently used commands. Never exported; search and copy.",
    exportable: false,
    inPalette: true,
    fields: { name: true, command: true },
    search: commandSearch,
    validate: (e) => required(e.command, "command", "command is required"),
  },
  {
    id: "runbook",
    plural: "Runbooks",
    singular: "Runbook",
    icon: "▶",
    blurb: "Step-by-step guides: scaffolding a new app, cutting a release, onboarding a repo.",
    exportable: false,
    inPalette: false,
    fields: { steps: true },
    defaults: { steps: [{ title: "", body: "", command: "" }] },
    search: (e) => ({
      primary: [e.title],
      strong: [e.description, ...e.steps.map((s) => s.title)],
      weak: [...e.tags, ...e.steps.map((s) => s.command)],
    }),
    validate: (e) => (e.steps.length ? [] : [{ path: "steps", message: "a runbook needs at least one step" }]),
  },
  {
    id: "note",
    plural: "Notes",
    singular: "Note",
    icon: "✎",
    blurb: "Endpoints, hosts, values: the things you look up rather than run.",
    exportable: false,
    inPalette: false,
    fields: { body: true },
    search: (e) => ({
      primary: [e.title],
      strong: [e.description],
      weak: [e.body, ...e.tags],
    }),
    validate: (e) => required(e.body, "body", "a note needs something in it"),
  },
];

const BY_ID = new Map(KINDS.map((k) => [k.id, k]));

export function kind(id: string): KindDef {
  const found = BY_ID.get(id as KindId);
  if (!found) throw new Error(`unknown kind "${id}"`);
  return found;
}

/** Kinds whose entries can reach the shell. */
export const EXPORTABLE_KINDS = KINDS.filter((k) => k.exportable).map((k) => k.id);

export const isExportable = (e: { kind: string; exported: boolean }) =>
  EXPORTABLE_KINDS.includes(e.kind as KindId) && e.exported;
