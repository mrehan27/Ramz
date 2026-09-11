/**
 * The IPC surface. One channel per core operation, named exactly like the
 * function it calls; the preload script and the renderer both derive from this
 * list, so adding an operation means touching one place.
 */
import * as core from "../server/core.ts";

export const HANDLERS = {
  config: () => core.getConfig(),
  list: () => core.listEntries(),
  create: (input: unknown) => core.createEntry(input),
  update: (id: string, input: unknown) => core.updateEntry(id, input),
  remove: (id: string) => core.deleteEntry(id),
  markUsed: (id: string) => core.markUsed(id),
  resetUsage: () => core.resetUsage(),
  updatePrefs: (input: unknown) => core.updatePrefs(input),
  tags: () => core.getTags(),
  setTagColor: (tag: string, color: unknown) => core.setTagColor(tag, color),
  renameTag: (tag: string, to: unknown) => core.renameTag(tag, to),
  deleteTag: (tag: string) => core.deleteTag(tag),
  exportPreview: () => core.exportPreview(),
  runExport: () => core.runExport(),
  removeFiles: () => core.removeGenerated(),
  rc: (file: string, action: "install" | "remove") => core.rcAction(file, action),
  importScan: (target?: string) => core.importScan(target),
  runImport: (payload: unknown) => core.runImport(payload),
  transferExport: (payload: unknown) => core.transferExport(payload),
  transferPreview: (target: string) => core.transferPreview(target),
  runTransferImport: (payload: unknown) => core.runTransferImport(payload),
  reorderEntries: (payload: unknown) => core.reorderEntries(payload),
} as const;

export type Handlers = typeof HANDLERS;
export const CHANNELS = Object.keys(HANDLERS) as (keyof Handlers)[];
