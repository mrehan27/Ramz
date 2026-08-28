import { contextBridge, ipcRenderer } from "electron";

/**
 * Kept in sync with electron/ipc.ts. Listed literally rather than imported so
 * the preload bundle stays tiny and free of server code.
 */
const CHANNELS = [
  "config", "list", "create", "update", "remove", "markUsed", "resetUsage", "updatePrefs",
  "tags", "setTagColor", "renameTag", "deleteTag",
  "exportPreview", "runExport", "removeFiles", "rc",
  "importScan", "runImport",
] as const;

const bridge = Object.fromEntries(
  CHANNELS.map((name) => [name, (...args: unknown[]) => ipcRenderer.invoke(name, ...args)]),
);

contextBridge.exposeInMainWorld("ramz", {
  ...bridge,
  /** Panel-only affordances the web build does not have. */
  openMainWindow: () => ipcRenderer.invoke("openMainWindow"),
  hidePanel: () => ipcRenderer.invoke("hidePanel"),
  isPanel: new URLSearchParams(location.search).get("panel") === "1",
});
