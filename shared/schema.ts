import { z } from "zod";
import { KIND_IDS, kind } from "./kinds.ts";

/** Function name that strict POSIX sh accepts. bash and zsh are looser. */
export const POSIX_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
export { SHELL_NAME, LEGACY_KINDS } from "./kinds.ts";

export const ParamSchema = z.object({
  name: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "param must be a valid identifier"),
  description: z.string().default(""),
  default: z.string().default(""),
  required: z.boolean().default(false),
});

export const StepSchema = z.object({
  title: z.string().min(1),
  body: z.string().default(""),
  command: z.string().default(""),
});

export const KindSchema = z.enum(KIND_IDS);

export const EntrySchema = z
  .object({
    id: z.string().min(1),
    kind: KindSchema,
    name: z.string().default(""),
    title: z.string().min(1),
    description: z.string().default(""),
    tags: z.array(z.string()).default([]),
    command: z.string().default(""),
    params: z.array(ParamSchema).default([]),
    steps: z.array(StepSchema).default([]),
    /** Free-form reference text for notes: values, URLs, fenced commands. */
    body: z.string().default(""),
    /** Force function form even without arguments (multi-line bodies, or to match an existing definition). */
    asFunction: z.boolean().default(false),
    /** Sorts to the top of its list. */
    pinned: z.boolean().default(false),
    /** Kept, but out of the way: hidden from lists and from an empty palette. */
    archived: z.boolean().default(false),
    exported: z.boolean().default(false),
    /** Bumped on every copy: the evidence for what deserves to be an alias. */
    useCount: z.number().int().min(0).default(0),
    lastUsedAt: z.string().default(""),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  // Each kind states its own requirements; see shared/kinds.ts.
  .superRefine((e, ctx) => {
    for (const issue of kind(e.kind).validate(e as Entry)) {
      ctx.addIssue({ code: "custom", path: [issue.path], message: issue.message });
    }
  });

/** Palette keys, not raw CSS: the UI owns the actual shades in both themes. */
export const TAG_COLORS = ["slate", "red", "amber", "green", "teal", "blue", "violet", "pink"] as const;
export const TagColorSchema = z.enum(TAG_COLORS);
export type TagColor = z.infer<typeof TagColorSchema>;

/** App preferences. Stored with the entries so there is one file to back up. */
export const PrefsSchema = z.object({
  showInDock: z.boolean().default(true),
  /** Hide the panel as soon as you click away from it. */
  hideOnBlur: z.boolean().default(true),
});

export const StoreSchema = z.object({
  version: z.literal(1),
  entries: z.array(EntrySchema).default([]),
  tagColors: z.record(z.string(), TagColorSchema).default({}),
  prefs: PrefsSchema.default({ showInDock: true }),
});

/** Payload accepted from the client; server owns id/timestamps. */
export const EntryInputSchema = z.object({
  kind: KindSchema,
  name: z.string().default(""),
  title: z.string().min(1),
  description: z.string().default(""),
  tags: z.array(z.string()).default([]),
  command: z.string().default(""),
  params: z.array(ParamSchema).default([]),
  steps: z.array(StepSchema).default([]),
  body: z.string().default(""),
  asFunction: z.boolean().default(false),
  pinned: z.boolean().default(false),
  archived: z.boolean().default(false),
  exported: z.boolean().default(false),
});

export type Param = z.infer<typeof ParamSchema>;
export type Step = z.infer<typeof StepSchema>;
export type Kind = z.infer<typeof KindSchema>;
export type Entry = z.infer<typeof EntrySchema>;
export type EntryInput = z.infer<typeof EntryInputSchema>;
export type Store = z.infer<typeof StoreSchema>;
export type Prefs = z.infer<typeof PrefsSchema>;

export const PLACEHOLDER = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

/** Placeholder names used in a command template, in order of first appearance. */
export function placeholdersIn(command: string): string[] {
  const seen = new Set<string>();
  for (const m of command.matchAll(PLACEHOLDER)) seen.add(m[1]);
  return [...seen];
}

/** Every placeholder an entry uses, across its command and any runbook steps. */
export function entryPlaceholders(
  entry: { command: string; body?: string; steps: { command: string; body: string }[] },
): string[] {
  const seen = new Set<string>();
  for (const src of [entry.command, entry.body ?? "", ...entry.steps.flatMap((s) => [s.command, s.body])]) {
    for (const name of placeholdersIn(src)) seen.add(name);
  }
  return [...seen];
}

/**
 * Substitute {{name}} with values, falling back to the param default. Anything with
 * neither is left as {{name}}: silently dropping it produces a broken command
 * (`expo@^ --fix`) with nothing to show what is missing.
 */
export function resolveCommand(command: string, params: Param[], values: Record<string, string>) {
  return command.replace(PLACEHOLDER, (whole, key: string) => {
    const v = values[key];
    if (v !== undefined && v.trim() !== "") return v;
    return params.find((p) => p.name === key)?.default || whole;
  });
}
