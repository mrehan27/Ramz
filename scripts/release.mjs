#!/usr/bin/env node
// Part of RAMZ (https://github.com/mrehan27/RAMZ). Written by Claude.
/**
 * Cuts a GitHub release: builds the app, then uploads the zip that install.sh
 * downloads.
 *
 *   npm run release            # tag v<version from package.json>
 *   npm run release -- 0.2.0   # set the version first, then tag it
 *
 * The build is unsigned, so macOS quarantines it on download. install.sh clears
 * that; see docs/install.md.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkgFile = path.join(ROOT, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8"));

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: ROOT, stdio: "inherit", ...opts });
const out = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, encoding: "utf8" }).trim();

const asked = process.argv.slice(2).find((a) => !a.startsWith("-"));
if (asked && asked !== pkg.version) {
  pkg.version = asked;
  fs.writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`version set to ${asked}`);
}
const tag = `v${pkg.version}`;

try {
  out("gh", ["--version"]);
} catch {
  bail("gh is not installed: brew install gh");
}
if (out("git", ["status", "--porcelain"])) bail("working tree is dirty: commit before releasing");
if (tagExists()) bail(`${tag} already exists: bump the version first`);

run("npm", ["run", "package"]);

const zip = fs.readdirSync(path.join(ROOT, "release")).find((f) => f.endsWith(".zip"));
if (!zip) bail("no zip in release/: check the electron-builder mac targets");

run("git", ["tag", tag]);
run("git", ["push", "origin", tag]);
run("gh", ["release", "create", tag, path.join(ROOT, "release", zip),
  "--title", `RAMZ ${tag}`, "--generate-notes"]);

console.log(`\nreleased ${tag}. Install it anywhere with:\n  curl -fsSL https://raw.githubusercontent.com/mrehan27/RAMZ/main/install.sh | sh`);

function tagExists() {
  try {
    return Boolean(out("git", ["tag", "--list", tag]));
  } catch {
    return false;
  }
}

function bail(message) {
  console.error(message);
  process.exit(1);
}
