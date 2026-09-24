import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// tsx loads these as ESM; the Electron bundle is CommonJS. Resolve the repo root
// in whichever of the two is actually available.
declare const __dirname: string | undefined;
const moduleDir = typeof __dirname === "string" ? __dirname : path.dirname(fileURLToPath(import.meta.url));

/** Repo root: where `dist/` and the seed store live. */
export const PROJECT_ROOT = path.resolve(moduleDir, "..");

/** Marks the rc line as ours so it can be removed again exactly. */
export const TAG = "# ramz";

/** Everything Ramz generates lives in one directory it owns entirely. */
export const RAMZ_DIR =
  process.env.RAMZ_DIR ??
  path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config"), "ramz");

/** Personal data, kept apart from the generated shell files, and from the repo. */
export const DATA_DIR =
  process.env.XDG_DATA_HOME ? path.join(process.env.XDG_DATA_HOME, "ramz")
  : path.join(os.homedir(), ".local", "share", "ramz");

export const LOADER = "init.sh";
export const ALIASES = "aliases.sh";

/** Files the loader sources, in order. Add one here and the rc line still never changes. */
export const GENERATED = [ALIASES];

export const loaderPath = () => path.join(RAMZ_DIR, LOADER);
export const aliasesPath = () => path.join(RAMZ_DIR, ALIASES);

export const RC_FILES = [".zshrc", ".bashrc", ".bash_profile", ".profile"].map((f) =>
  path.join(os.homedir(), f),
);

/** Where an exported file lands unless you say otherwise. */
export const downloadsDir = () => path.join(os.homedir(), "Downloads");

/** Expands a leading ~ so a typed path behaves the way it looks. */
export const expandHome = (file: string) =>
  file.startsWith("~") ? path.join(os.homedir(), file.slice(1)) : file;

/** Fences our lines in an rc file, so they can be found, checked and removed exactly. */
export const BLOCK_BEGIN = "# BEGIN Ramz SECTION";
export const BLOCK_END = "# END Ramz SECTION";

/**
 * The one line that loads Ramz: expands to the loader the same way the server
 * resolves it, and does nothing when the directory is gone. `if` rather than
 * `[ ] &&`, because the && form exits 1 once Ramz is removed, and as the last
 * line of an rc that shows up as an error on a fresh prompt.
 */
export function sourceLine(): string {
  const dir = process.env.RAMZ_DIR
    ? RAMZ_DIR
    : `${process.env.XDG_CONFIG_HOME ? "$XDG_CONFIG_HOME" : "${XDG_CONFIG_HOME:-$HOME/.config}"}/ramz`;
  const file = `"${dir}/${LOADER}"`;
  return `if [ -r ${file} ]; then . ${file}; fi`;
}

/** What goes in the rc: the line, fenced. The owner's own hand-written format. */
export const sourceBlock = () => [BLOCK_BEGIN, sourceLine(), BLOCK_END].join("\n");
