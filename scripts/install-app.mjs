#!/usr/bin/env node
/**
 * The whole update loop, in one command: build, quit the running copy, replace
 * ~/Applications/RAMZ.app, launch it again.
 *
 *   npm run install:app                 # build, install, relaunch
 *   npm run install:app -- --no-build   # install whatever is in release/
 *   npm run install:app -- --no-launch  # leave it closed
 *
 * It installs into ~/Applications rather than running from `release/`, which
 * every rebuild wipes, and a Dock tile pointing in there would go stale. The path
 * never changes, so a tile pinned once keeps working across updates.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP = "RAMZ.app";
const src = path.join(ROOT, "release", "mac-arm64", APP);
const destDir = path.join(os.homedir(), "Applications");
const dest = path.join(destDir, APP);

const flag = (name) => process.argv.includes(`--${name}`);
const run = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, stdio: "inherit" });

/** pgrep exits 1 when nothing matches, which is not an error here. */
function running() {
  try {
    execFileSync("pgrep", ["-f", "RAMZ.app/Contents/MacOS/RAMZ"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

if (!flag("no-build")) run("npm", ["run", "package"]);

if (!fs.existsSync(src)) {
  console.error(`no build at ${path.relative(ROOT, src)}; run without --no-build`);
  process.exit(1);
}

// Replacing the bundle under a running copy orphans it: the process survives with
// no bundle behind it, and the Dock is left with a tile that only offers Force Quit.
if (running()) {
  console.log("RAMZ is running, asking it to quit");
  try { execFileSync("osascript", ["-e", 'quit app "RAMZ"']); } catch { /* no scripting bridge */ }
  for (let i = 0; i < 25 && running(); i++) execFileSync("sleep", ["0.2"]);
  if (running()) {
    console.error("RAMZ is still running; quit it from the menubar icon, then run this again");
    process.exit(1);
  }
}

fs.mkdirSync(destDir, { recursive: true });
const replacing = fs.existsSync(dest);
fs.rmSync(dest, { recursive: true, force: true });
execFileSync("ditto", [src, dest]);
// The Dock and Finder cache icons per bundle; touching the app nudges them.
execFileSync("touch", [dest]);

console.log(`${replacing ? "replaced" : "installed"} ${dest}`);
if (!replacing) console.log("drag it onto the Dock once to keep it there");

if (!flag("no-launch")) {
  // `open` forwards this shell's environment, and VS Code sets
  // ELECTRON_RUN_AS_NODE=1, which makes the app run as plain node and exit.
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  execFileSync("open", [dest], { env });
  console.log("launched");
}
