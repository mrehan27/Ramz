/**
 * Records the README demo: boots the built UI against the example entries, drives
 * it, captures frames and hands them to gifski.
 *
 * The example store is deliberate. The real one is personal, and this output is
 * published, so the demo can only ever show the entries that ship with the repo.
 *
 *   npm run demo:gif        (needs `npm run build` first, and `brew install gifski`)
 */
const { app, BrowserWindow, nativeTheme } = require("electron");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const PAGE = path.join(ROOT, "dist", "index.html");
const SEED = path.join(ROOT, "data", "commands.example.json");
const OUT = path.join(ROOT, "assets", "demo.gif");
const FPS = 10;
const WIDTH = 820;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * The UI trusts entries that have been through the schema, which fills in every
 * field. The seed file predates some of them, so a stub has to do that job or the
 * renderer dies on `entry.variants.length`.
 */
function complete(entries) {
  return entries.map((e) => ({
    name: "", description: "", tags: [], command: "", params: [], steps: [], variants: [],
    body: "", asFunction: false, pinned: false, archived: false, exported: false,
    useCount: 0, lastUsedAt: "", ...e,
  }));
}

function preloadFile(dir, entries) {
  const file = path.join(dir, "demo-preload.cjs");
  fs.writeFileSync(file, `
const { contextBridge } = require("electron");
const ok = (value) => Promise.resolve({ ok: true, value });
const entries = ${JSON.stringify(entries)};
const config = ${JSON.stringify({
    prefs: { showInDock: true, hideOnBlur: true, debug: false },
    configDir: "~/.config/ramz",
    aliasesFile: "~/.config/ramz/aliases.sh",
    loaderFile: "~/.config/ramz/ramz.sh",
    storePath: "~/.local/share/ramz/commands.json",
    installed: true,
    sourceLine: "source ~/.config/ramz/ramz.sh # ramz",
    rc: [{ file: "~/.zshrc", name: ".zshrc", exists: true, hasLine: true }],
    importCandidates: [],
  })};
contextBridge.exposeInMainWorld("ramz", {
  isPanel: false,
  list: () => ok(entries),
  config: () => ok(config),
  tags: () => ok({ git: "amber", agents: "violet", rn: "blue", k8s: "teal", expo: "green" }),
  markUsed: () => ok({ id: "x", useCount: 1, lastUsedAt: new Date().toISOString() }),
  updatePrefs: () => ok(config.prefs),
  resetUsage: () => ok({ cleared: 0 }),
  openMainWindow: () => Promise.resolve(),
  hidePanel: () => Promise.resolve(),
  revealStore: () => Promise.resolve(),
  onView: () => {},
});
`);
  return file;
}

/** A drawn pointer: capturePage does not include the real cursor, so a click would
 *  otherwise look like the app moving on its own. */
const CURSOR = `
  (() => {
    const d = document.createElement("div");
    d.id = "__cursor";
    d.style.cssText = "position:fixed;z-index:99999;width:13px;height:13px;border-radius:50%;" +
      "background:rgba(255,255,255,.92);box-shadow:0 0 0 2px rgba(0,0,0,.4),0 2px 8px rgba(0,0,0,.45);" +
      "pointer-events:none;left:-40px;top:-40px;transition:left .28s ease,top .28s ease,transform .12s ease";
    document.body.appendChild(d);
    return 1;
  })()`;

const step = (what) => console.log(`… ${what}`);

app.whenReady().then(async () => {
  if (!fs.existsSync(PAGE)) {
    console.error("no dist/index.html: run `npm run build` first");
    return app.exit(1);
  }
  if (!spawnSync("gifski", ["--version"]).stdout) {
    console.error("gifski not found: brew install gifski");
    return app.exit(1);
  }

  const frames = fs.mkdtempSync(path.join(os.tmpdir(), "ramz-demo-"));
  const entries = complete(JSON.parse(fs.readFileSync(SEED, "utf8")).entries);
  nativeTheme.themeSource = "dark";

  const win = new BrowserWindow({
    width: 1060,
    height: 720,
    show: true,
    x: -20000,
    y: -20000,
    frame: false,
    webPreferences: { preload: preloadFile(frames, entries), contextIsolation: true },
  });

  void win.loadFile(PAGE);

  const run = (js) => win.webContents.executeJavaScript(js);
  const at = (sel) => `(() => { const e = ${sel}; if (!e) return null; const b = e.getBoundingClientRect();
    return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; })()`;

  const move = async (sel) => {
    const p = await run(at(sel));
    if (!p) throw new Error(`nothing to point at: ${sel}`);
    await run(`(() => { const d = document.getElementById("__cursor");
      d.style.left = "${p.x - 6}px"; d.style.top = "${p.y - 6}px"; return 1; })()`);
    await wait(320);
  };
  const click = async (sel) => {
    await move(sel);
    await run(`(() => { const d = document.getElementById("__cursor"); d.style.transform = "scale(.65)"; return 1; })()`);
    await wait(120);
    await run(`(${sel}).click(), 1`);
    await run(`(() => { const d = document.getElementById("__cursor"); d.style.transform = "scale(1)"; return 1; })()`);
  };
  const typeInto = async (sel, text) => {
    for (const ch of text) {
      await run(`(() => { const i = ${sel}; const set = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, "value").set;
        set.call(i, i.value + ${JSON.stringify(ch)});
        i.dispatchEvent(new Event("input", { bubbles: true })); return 1; })()`);
      await wait(95);
    }
  };

  // capturePage costs ~600ms a shot, which is 2fps and unwatchable. A frame
  // subscription hands over paints as they happen; the clock then writes the
  // latest one at a steady rate, so a still moment repeats a frame rather than
  // leaving a gap.
  let latest = null;
  let n = 0;
  let shots = null;
  win.webContents.beginFrameSubscription(false, (image) => { latest = image; });
  // Started only once the first render has settled: the frames before that are
  // the loading state and half-painted, and the first one is the poster GitHub shows.
  const record = () => {
    shots = setInterval(() => {
      if (!latest) return;
      const png = latest.toPNG();
      if (png.length === 0) return;
      fs.writeFileSync(path.join(frames, `f${String(n++).padStart(4, "0")}.png`), png);
    }, 1000 / FPS);
  };

  try {
    await new Promise((r) => win.webContents.once("did-finish-load", r));
    await run(`(async () => { for (let i = 0; i < 60 && !document.querySelector("main article"); i++) {
      await new Promise((r) => setTimeout(r, 100)); } return 1; })()`);
    await wait(600);
    await run(CURSOR);
    await wait(400);
    record();
    await wait(900);

    const nav = (label) => `[...document.querySelectorAll('nav button')].find(b => b.innerText.includes(${JSON.stringify(label)}))`;
    const palette = `[...document.querySelectorAll('div')].find(d => d.className.includes('z-[70]'))`;

    // 1. find and copy a command without leaving the keyboard
    step("palette open");
    await run(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })), 1`);
    await wait(500);
    step("typing");
    await typeInto(`${palette}.querySelector('input')`, "port");
    await wait(700);
    step("copy from the palette");
    await run(`(() => { const i = ${palette}.querySelector('input'); i.focus();
      i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return 1; })()`);
    await wait(1400);

    // 2. a prompt, its variants, and a copy
    step("prompts page");
    await click(nav("Prompts"));
    await wait(900);
    const row = `[...document.querySelectorAll('main article')][0]`;
    step("expand a prompt");
    await click(`${row}.querySelector('button[aria-label="Expand"]')`);
    await wait(900);
    step("pick a variant");
    await move(`${row}.querySelector('select')`);
    await run(`(() => { const s = ${row}.querySelector('select'); s.value = 'iOS';
      s.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);
    await wait(1100);
    // The variant fills the platform bits; the one blank left is the point of the
    // fill-in, so type it rather than hiding it.
    step("fill the blank");
    await move(`${row}.querySelector('input[data-arg="feature"]')`);
    await typeInto(`${row}.querySelector('input[data-arg="feature"]')`, "dark mode");
    await wait(600);

    step("copy the prompt");
    await click(`[...${row}.querySelectorAll('button')].find(b => b.innerText.trim() === 'Copy')`);
    await wait(1300);

    // 3. what all that copying adds up to
    step("analytics");
    await click(nav("Analytics"));
    await wait(1800);
  } finally {
    if (shots) clearInterval(shots);
    win.webContents.endFrameSubscription();
    await wait(200);
  }

  const files = fs.readdirSync(frames).filter((f) => f.endsWith(".png")).sort()
    .map((f) => path.join(frames, f));
  console.log(`captured ${files.length} frames`);
  if (files.length < 30) {
    console.error("too few frames to make a demo");
    return app.exit(1);
  }
  const gif = spawnSync("gifski", [
    "--fps", String(FPS), "--width", String(WIDTH), "--quality", "80", "-o", OUT, ...files,
  ], { encoding: "utf8" });
  if (gif.status !== 0) {
    console.error(gif.stderr || "gifski failed");
    return app.exit(1);
  }
  console.log(`wrote ${OUT} (${(fs.statSync(OUT).size / 1e6).toFixed(2)} MB)`);
  // RAMZ_DEMO_KEEP=1 leaves the frames behind, for checking the middle of the run.
  if (process.env.RAMZ_DEMO_KEEP) console.log(`frames in ${frames}`);
  else fs.rmSync(frames, { recursive: true, force: true });
  app.exit(0);
}).catch((err) => {
  // Without this the rejection is silent and the app just sits there.
  console.error(`demo failed: ${err.stack ?? err.message}`);
  app.exit(1);
});
