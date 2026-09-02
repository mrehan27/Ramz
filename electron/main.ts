import { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, nativeImage, screen, shell } from "electron";
import path from "node:path";
import { RamzError, getPrefs } from "../server/core.ts";
import { STORE_PATH } from "../server/store.ts";
import type { Prefs } from "../shared/schema.ts";
import { HANDLERS, CHANNELS } from "./ipc.ts";

// Before ready, so dev and packaged runs share one ~/Library/Application Support/Ramz.
app.setName("Ramz");

// Bundled to CommonJS: electron's own module is CJS, so named ESM imports of it fail.
declare const __dirname: string;
const HERE = __dirname;
// Packaged, everything lives inside app.asar; in dev it is the repo.
const ROOT = app.isPackaged ? app.getAppPath() : path.resolve(HERE, "..");
const DEV_URL = process.env.RAMZ_DEV_URL;           // set by `npm run dev:app`
const PRELOAD = path.join(HERE, "preload.cjs");
const TRAY_ICON = path.join(ROOT, "electron", "assets", "trayTemplate.png");
const HOTKEY = process.env.RAMZ_HOTKEY ?? "CommandOrControl+Shift+K";
const HOTKEY_MAIN = process.env.RAMZ_HOTKEY_MAIN ?? "CommandOrControl+Shift+M";

// Mirrors the stored preferences, so window callbacks can read them synchronously.
let prefs: Prefs = { showInDock: true, hideOnBlur: true };

let panel: BrowserWindow | null = null;
let main: BrowserWindow | null = null;
let tray: Tray | null = null;

function load(win: BrowserWindow, asPanel: boolean) {
  const query = asPanel ? "?panel=1" : "";
  if (DEV_URL) return win.loadURL(`${DEV_URL}/${query}`);
  return win.loadFile(path.join(ROOT, "dist", "index.html"), { search: query.slice(1) });
}

/** The everyday surface: a small window over whatever you are doing. */
function createPanel() {
  const win = new BrowserWindow({
    width: 640,
    height: 460,
    show: false,
    frame: false,
    resizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    vibrancy: "sidebar",
    // An NSPanel, not a window: it can take key focus without activating the app,
    // which is what stops macOS switching Spaces out of a full-screen window.
    type: "panel",
    webPreferences: { preload: PRELOAD, sandbox: false },
  });
  // Joins every Space, including over a full-screen app, instead of pulling you
  // to the Space the app happens to live on.
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setAlwaysOnTop(true, "screen-saver");
  // Ignore the blur that arrives while the window is still coming up.
  let shownAt = 0;
  win.on("show", () => { shownAt = Date.now(); });
  win.on("blur", () => {
    if (!prefs.hideOnBlur) return;
    if (Date.now() - shownAt < 400 || win.webContents.isDevToolsOpened()) return;
    win.hide();
  });
  void load(win, true);
  return win;
}

/** The full UI, for managing entries rather than reaching for one. */
function createMain(view?: "settings") {
  const win = new BrowserWindow({
    width: 1100,
    height: 780,
    title: "Ramz",
    webPreferences: { preload: PRELOAD, sandbox: false },
  });
  void load(win, false);
  if (view) win.webContents.once("did-finish-load", () => win.webContents.send("view", view));
  win.on("closed", () => { main = null; });
  return win;
}

function showPanel() {
  if (!panel || panel.isDestroyed()) panel = createPanel();
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const bounds = panel.getBounds();
  // Under the menubar, horizontally centred on the active display.
  panel.setPosition(
    Math.round(display.workArea.x + (display.workArea.width - bounds.width) / 2),
    Math.round(display.workArea.y + 8),
  );
  // No app.focus({steal:true}) here: activating a regular app raises its own
  // Space and drops you onto the desktop. The panel takes key focus by itself.
  panel.show();
  panel.focus();
  panel.webContents.focus();
}

function togglePanel() {
  if (panel && !panel.isDestroyed() && panel.isVisible()) panel.hide();
  else showPanel();
}

/** From anywhere: the full window, with the panel out of the way. */
function showMain() {
  app.focus({ steal: true });
  openMain();
  panel?.hide();
}

function openMain(view?: "settings") {
  if (main && !main.isDestroyed()) {
    main.show();
    main.focus();
    if (view) main.webContents.send("view", view);
    return;
  }
  main = createMain(view);
}

/**
 * A real PNG: nativeImage cannot decode SVG, and an empty image plus a title is
 * not reliably drawn either, which leaves an app with no visible affordance.
 * Falls back to a text title if the icon is somehow missing.
 */
function makeTray() {
  const icon = nativeImage.createFromPath(TRAY_ICON);
  icon.setTemplateImage(true);
  const t = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  if (icon.isEmpty()) {
    console.error(`tray icon missing at ${TRAY_ICON}: falling back to a title`);
    t.setTitle("Ramz");
  }
  t.setToolTip("Ramz (⌘⇧K)");
  return t;
}

/** Preferences take effect immediately, without a restart. */
function applyPrefs(next: Prefs) {
  prefs = next;
  if (next.showInDock) void app.dock?.show();
  else app.dock?.hide();
}

// A second launch should surface the running app, not start a rival copy.
if (!app.requestSingleInstanceLock()) {
  console.log("another instance holds the lock, handing over to it");
  app.quit();
} else {
  app.on("second-instance", () => showPanel());
  app.on("activate", () => showPanel());
}

app.whenReady().then(() => {
  for (const channel of CHANNELS) {
    ipcMain.handle(channel, async (_e, ...args: unknown[]) => {
      try {
        const value = await (HANDLERS[channel] as (...a: unknown[]) => unknown)(...args);
        if (channel === "updatePrefs") applyPrefs(value as Prefs);
        return { ok: true, value };
      } catch (err) {
        const message = err instanceof RamzError ? err.message : (err as Error).message ?? "failed";
        return { ok: false, error: message };
      }
    });
  }
  ipcMain.handle("openMainWindow", (_e, view?: "settings") => { openMain(view); panel?.hide(); });
  ipcMain.handle("hidePanel", () => panel?.hide());
  ipcMain.handle("revealStore", () => shell.showItemInFolder(STORE_PATH));

  tray = makeTray();
  tray.on("click", togglePanel);
  tray.on("right-click", () => tray?.popUpContextMenu(Menu.buildFromTemplate([
    { label: "Quick search…", accelerator: HOTKEY, click: togglePanel },
    { label: "Open main window", accelerator: HOTKEY_MAIN, click: openMain },
    { type: "separator" },
    { label: "Open the shell directory", click: () => void shell.openPath(path.join(process.env.HOME ?? "", ".config", "ramz")) },
    { type: "separator" },
    { label: "Quit Ramz", role: "quit" },
  ])));

  for (const [key, action] of [[HOTKEY, togglePanel], [HOTKEY_MAIN, showMain]] as const) {
    if (globalShortcut.register(key, action)) console.log(`hotkey ${key} registered`);
    else console.error(`could not register ${key}: another app owns it`);
  }

  // A regular app on purpose: a Dock icon to click, a place in cmd-tab, and a
  // tile the Dock will actually keep. LSUIElement would take all three away, so
  // hiding the icon is done at runtime, only if asked for.
  void getPrefs().then(applyPrefs).catch(() => {});
  panel = createPanel();
  if (process.env.RAMZ_SELFTEST) { panel.once("ready-to-show", showPanel); void selfTest(panel); }
  // Opened by hand? Show it. Opened at login? Stay out of the way.
  else if (!app.getLoginItemSettings().wasOpenedAtLogin) panel.once("ready-to-show", showPanel);
});

/**
 * `RAMZ_SELFTEST=1` boots the app, checks the panel really rendered against the
 * real store over IPC, prints the result and quits. Cheap end-to-end check for
 * a UI that otherwise can only be tested by clicking it.
 */
async function selfTest(win: BrowserWindow) {
  win.webContents.on("did-fail-load", (_e, code, desc) => console.error(`load failed: ${code} ${desc}`));
  win.webContents.on("console-message", (_e, _level, message) => console.log(`[renderer] ${message}`));
  const timer = setTimeout(() => { console.error("SELFTEST timed out"); app.quit(); }, 20000);
  try {
    await new Promise<void>((r) => win.webContents.once("did-finish-load", () => r()));
    const result: Record<string, unknown> = await win.webContents.executeJavaScript(`(async () => {
      try {
        // give React a moment to mount and the first load to settle
        for (let i = 0; i < 40 && !document.querySelector("input"); i++) {
          await new Promise((r) => setTimeout(r, 100));
        }
        const bridge = window.ramz;
        if (!bridge) return { error: "window.ramz missing - preload did not run" };
        const entries = await bridge.list();
        const config = await bridge.config();
        return {
          focused: document.activeElement ? document.activeElement.tagName : "none",
          bridgeKeys: Object.keys(bridge).length,
          isPanel: bridge.isPanel,
          entries: entries && entries.ok ? entries.value.length : JSON.stringify(entries),
          store: config && config.ok ? config.value.storePath : JSON.stringify(config),
          rows: document.querySelectorAll("li button").length,
          hasInput: !!document.querySelector("input"),
          text: (document.body.innerText || "").slice(0, 80),
        };
      } catch (e) {
        return { error: String((e && e.stack) || e) };
      }
    })()`);
    if (typeof result?.text === "string") result.text = result.text.split("\n").join(" | ");
    console.log("SELFTEST " + JSON.stringify(result, null, 2));
  } catch (e) {
    console.error("SELFTEST threw:", (e as Error).message);
  } finally {
    clearTimeout(timer);
    app.quit();
  }
}

app.on("window-all-closed", () => { /* stays alive in the menubar */ });
app.on("will-quit", () => globalShortcut.unregisterAll());
