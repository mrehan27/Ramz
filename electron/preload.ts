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
  openMainWindow: (view) => ipcRenderer.invoke("openMainWindow", view),
  /** The main process asking the window to show something, e.g. Settings. */
  onView: (fn) => ipcRenderer.on("view", (_e, view) => fn(view)),
  hidePanel: () => ipcRenderer.invoke("hidePanel"),
  revealStore: () => ipcRenderer.invoke("revealStore"),
  isPanel: new URLSearchParams(location.search).get("panel") === "1",
});
