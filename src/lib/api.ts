import type { Entry, EntryInput, Prefs, TagColor } from "../../shared/schema.ts";
import type { KindId } from "../../shared/kinds.ts";
import type { Resolution } from "../../shared/transfer.ts";
import { call } from "./bridge.ts";

export type TagColors = Record<string, TagColor>;

export type RcStatus = { file: string; name: string; exists: boolean; hasLine: boolean };

export type Config = {
  prefs: Prefs;
  configDir: string;
  aliasesFile: string;
  loaderFile: string;
  storePath: string;
  installed: boolean;
  sourceLine: string;
  rc: RcStatus[];
  importCandidates: string[];
};

export type ExportProblem = { entryId?: string; name?: string; level: "error" | "warn"; message: string };

export type ExportPreview = {
  aliases: string;
  loader: string;
  count: number;
  problems: ExportProblem[];
  configDir: string;
  aliasesFile: string;
  loaderFile: string;
  installed: boolean;
};

export type ScannedAlias = {
  name: string;
  command: string;
  title: string;
  description: string;
  params: { name: string; default: string; required: boolean }[];
  form: "alias" | "function";
  status: "new" | "duplicate";
};

export type ScanSource = {
  file: string;
  name: string;
  found: ScannedAlias[];
  skipped: { line: string; reason: string }[];
};

export type ScanResult = { target: string; candidates: string[]; sources: ScanSource[] };

export type ImportItem = {
  name: string;
  command: string;
  asFunction?: boolean;
  title?: string;
  description?: string;
  tags?: string[];
  params?: ScannedAlias["params"];
};

/** One incoming entry that already exists here, and how the two compare. */
export type TransferConflict = {
  key: string;
  match: "id" | "title";
  incoming: Entry;
  existing: Entry;
  identical: boolean;
};

export type TransferPreview = {
  file: string;
  exportedAt: string;
  total: number;
  newTags: string[];
  fresh: Entry[];
  conflicts: TransferConflict[];
};

export const api = {
  config: () => call<Config>("config", [], { url: "/api/config" }),
  tags: () => call<TagColors>("tags", [], { url: "/api/tags" }),
  setTagColor: (tag: string, color: TagColor | null) =>
    call<TagColors>("setTagColor", [tag, color], {
      url: `/api/tags/${encodeURIComponent(tag)}`, method: "PUT", body: { color },
    }),
  renameTag: (tag: string, to: string) =>
    call<{ touched: number; tagColors: TagColors }>("renameTag", [tag, to], {
      url: `/api/tags/${encodeURIComponent(tag)}/rename`, method: "POST", body: { to },
    }),
  deleteTag: (tag: string) =>
    call<{ touched: number; tagColors: TagColors }>("deleteTag", [tag], {
      url: `/api/tags/${encodeURIComponent(tag)}`, method: "DELETE",
    }),
  list: () => call<Entry[]>("list", [], { url: "/api/entries" }),
  create: (input: EntryInput) =>
    call<Entry>("create", [input], { url: "/api/entries", method: "POST", body: input }),
  update: (id: string, input: EntryInput) =>
    call<Entry>("update", [id, input], { url: `/api/entries/${id}`, method: "PUT", body: input }),
  remove: (id: string) =>
    call<{ ok: true }>("remove", [id], { url: `/api/entries/${id}`, method: "DELETE" }),
  markUsed: (id: string) =>
    call<{ id: string; useCount: number; lastUsedAt: string }>("markUsed", [id], {
      url: `/api/entries/${id}/used`, method: "POST",
    }),
  updatePrefs: (input: Partial<Prefs>) =>
    call<Prefs>("updatePrefs", [input], { url: "/api/prefs", method: "PUT", body: input }),
  resetUsage: () => call<{ cleared: number }>("resetUsage", [], { url: "/api/usage/reset", method: "POST" }),
  exportPreview: () => call<ExportPreview>("exportPreview", [], { url: "/api/export/preview" }),
  runExport: () =>
    call<{ ok: true; count: number; configDir: string; loaderFile: string }>("runExport", [], {
      url: "/api/export", method: "POST",
    }),
  removeFiles: () =>
    call<{ removed: string[]; kept: string[]; dirRemoved: boolean }>("removeFiles", [], {
      url: "/api/export", method: "DELETE",
    }),
  rc: (file: string, action: "install" | "remove") =>
    call<{ ok: true; changed: boolean; rc: RcStatus[] }>("rc", [file, action], {
      url: "/api/rc", method: "POST", body: { file, action },
    }),
  importScan: (target?: string) =>
    call<ScanResult>("importScan", [target], {
      url: target ? `/api/import/scan?path=${encodeURIComponent(target)}` : "/api/import/scan",
    }),
  runImport: (entries: ImportItem[]) =>
    call<{ added: number; rejected: { name: string; reason: string }[] }>("runImport", [{ entries }], {
      url: "/api/import", method: "POST", body: { entries },
    }),
  transferExport: (body: { file?: string; kinds?: KindId[] } = {}) =>
    call<{ file: string; entries: number }>("transferExport", [body], {
      url: "/api/transfer/export", method: "POST", body,
    }),
  transferPreview: (target: string) =>
    call<TransferPreview>("transferPreview", [target], {
      url: `/api/transfer/preview?path=${encodeURIComponent(target)}`,
    }),
  runTransferImport: (body: { file: string; resolutions: Record<string, Resolution>; fallback: Resolution }) =>
    call<{ added: number; overwritten: number; skipped: number; copied: number }>("runTransferImport", [body], {
      url: "/api/transfer/import", method: "POST", body,
    }),
};
