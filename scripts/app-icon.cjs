#!/usr/bin/env node
/**
 * Turns the artwork in assets/ into what macOS wants:
 *
 *   npm run icon                    # assets/icon.svg  -> build/icon.icns, assets/icon-256.png
 *   npm run icon:tray               # assets/tray.svg  -> electron/assets/trayTemplate.png
 *   npm run icon -- some/file.svg   # try one without installing it
 *
 * SVG goes through electron, which is the only renderer this project already
 * depends on and the reason this script exists: nativeImage cannot read SVG.
 * PNG goes through sips. The tray image must be black plus alpha, because macOS
 * recolours it for light and dark menubars.
 *
 * CJS because electron's main process is CJS.
 */
const { app, BrowserWindow } = require("electron");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

app.setName("Ramz"); // share one userData dir with the app itself

const ROOT = path.resolve(__dirname, "..");
const BUILD = path.join(ROOT, "build");
const ART = ["icon.svg", "icon.png"].map((f) => path.join(ROOT, "assets", f));
const ART_TRAY = ["tray.svg", "tray.png"].map((f) => path.join(ROOT, "assets", f));

const given = process.argv.slice(2).find((a) => !a.startsWith("--"));
const artwork = (candidates) => (given ? path.resolve(given) : candidates.find((f) => fs.existsSync(f)));

const SIZES = [16, 32, 64, 128, 256, 512, 1024];
const ICONSET = [
  ["icon_16x16.png", 16], ["icon_16x16@2x.png", 32],
  ["icon_32x32.png", 32], ["icon_32x32@2x.png", 64],
  ["icon_128x128.png", 128], ["icon_128x128@2x.png", 256],
  ["icon_256x256.png", 256], ["icon_256x256@2x.png", 512],
  ["icon_512x512.png", 512], ["icon_512x512@2x.png", 1024],
];

const page = (body, w, h) => `<!doctype html><meta charset="utf-8">
  <style>html,body{margin:0;padding:0;background:transparent}
  svg{display:block}</style>
  <div style="width:${w}px;height:${h}px">${body}</div>`;

let win = null;
let n = 0;

/**
 * Captures the render window. Two things this has to work around: capturePage
 * on a window that was never shown fails with UnknownVizError, so the window is
 * shown far off-screen instead of hidden; and a fresh BrowserWindow per shot
 * fails to load after the first, so one window is reused. capturePage returns
 * backing-store pixels, i.e. a 2x supersample on retina, which we resize down.
 */
async function shot(html, w, h, out) {
  if (!win) {
    win = new BrowserWindow({
      x: -20000, y: -20000, width: w, height: h, useContentSize: true,
      show: false, transparent: true, backgroundColor: "#00000000",
      frame: false, skipTaskbar: true, focusable: false,
    });
    win.showInactive();
  }
  win.setContentSize(w, h);
  // A temp file, not a data: URL, because chromium refuses some top-level data: loads.
  const tmp = path.join(BUILD, `.render-${process.pid}-${n++}.html`);
  fs.writeFileSync(tmp, html);
  try {
    await win.loadFile(tmp);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
  let img = await capture();
  if (img.getSize().width !== w) img = img.resize({ width: w, height: h, quality: "best" });
  if (!hasInk(img)) throw new Error(`rendered ${path.basename(out)} came out blank`);
  fs.writeFileSync(out, img.toPNG());
}

/** The first capture after a load can come back empty or throw; give it a beat. */
async function capture() {
  let last;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const img = await win.webContents.capturePage();
      if (hasInk(img)) return img;
      last = new Error("blank capture");
    } catch (err) {
      last = err;
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  throw last;
}

/** capturePage on a hidden window can silently return nothing; check for pixels. */
function hasInk(img) {
  const bmp = img.toBitmap();
  for (let i = 3; i < bmp.length; i += 4) if (bmp[i] > 8) return true;
  return false;
}

async function buildIcns() {
  const art = need(artwork(ART), "assets/icon.svg");
  const iconset = path.join(BUILD, "icon.iconset");
  fs.rmSync(iconset, { recursive: true, force: true });
  fs.mkdirSync(iconset, { recursive: true });

  const rendered = new Map();
  for (const size of SIZES) {
    const file = path.join(iconset, `_${size}.png`);
    await render(art, size, file);
    rendered.set(size, fs.readFileSync(file));
    fs.rmSync(file);
  }
  for (const [name, size] of ICONSET) fs.writeFileSync(path.join(iconset, name), rendered.get(size));

  // The README shows the icon, and a PNG straight from the source keeps it
  // honest: pulling one back out of the .icns crops the shadow padding.
  fs.writeFileSync(path.join(ROOT, "assets", "icon-256.png"), rendered.get(256));

  const icns = path.join(BUILD, "icon.icns");
  execFileSync("iconutil", ["-c", "icns", iconset, "-o", icns]);
  fs.rmSync(iconset, { recursive: true, force: true });
  console.log(`wrote ${path.relative(ROOT, icns)} from ${source(art)} (${fs.statSync(icns).size} bytes)`);
}

const source = (art) => path.relative(ROOT, art);

function need(art, what) {
  if (!art) throw new Error(`no artwork: expected ${what}`);
  return art;
}

/** PNG goes through sips; SVG goes through the renderer, which is why it is here. */
async function render(art, size, out) {
  if (art.endsWith(".svg")) {
    // Supplied art carries its own width/height; make it fill the capture instead.
    const body = fs.readFileSync(art, "utf8");
    const scaled = `<style>svg{width:${size}px;height:${size}px}</style>${body}`;
    await shot(page(scaled, size, size), size, size, out);
  } else {
    resize(art, size, out);
  }
}

/** sips ships with macOS and keeps the alpha channel, which is all this needs. */
function resize(src, size, out) {
  execFileSync("sips", ["-s", "format", "png", "-z", String(size), String(size), src, "--out", out], { stdio: "ignore" });
}

async function buildTray() {
  const out = path.join(ROOT, "electron", "assets");
  fs.mkdirSync(out, { recursive: true });
  const art = need(artwork(ART_TRAY), "assets/tray.svg");
  for (const [size, name] of [[22, "trayTemplate.png"], [44, "trayTemplate@2x.png"]]) {
    await render(art, size, path.join(out, name));
  }
  console.log(`wrote electron/assets/trayTemplate.png and @2x from ${source(art)}`);
}

app.whenReady().then(async () => {
  try {
    fs.mkdirSync(BUILD, { recursive: true });
    if (process.argv.includes("--tray")) await buildTray();
    else await buildIcns();
    app.exit(0);
  } catch (err) {
    console.error(String(err && err.message ? err.message : err));
    app.exit(1);
  }
});
