# Working notes

Decisions, open threads and traps. [development.md](development.md) covers how to run and
build it, [agents.md](agents.md) the conventions; this is the context that would otherwise
live only in conversation.

## Where things stand

- **Written entirely by Claude**, directed and reviewed by the owner. Which is why these
  notes exist: they carry the context a fresh session would otherwise have to rediscover.
- **No tests.** Everything is verified by running it: the packaged app against a real store,
  and the generated shell files executed in bash and zsh. Three real bugs have shipped through
  the render and quoting path, so that is the biggest gap.
- **Nothing is signed.** Releases are ad-hoc signed, and `install.sh` clears the quarantine
  flag on the user's own machine.

## Decisions worth remembering

- **The panel is an NSPanel** (`type: "panel"`, `screen-saver` level, visible on all Spaces).
  A plain window plus `app.focus({steal:true})` activates the app, and activating a regular
  app raises its own Space, which drops you out of a full-screen window onto the desktop. An
  NSPanel takes key focus without activating, so the panel overlays whatever is in front.
- **"Sync to shell", never "export".** The operation regenerates files Ramz owns from the
  entries; nothing portable comes out of it. Moving machines is copying `commands.json`, which
  is what Settings → Your data says.
- **The app is called Ramz** (symbol, code, cipher), and the name is used
  everywhere: `~/.config/ramz`, `~/.local/share/ramz`, `RAMZ_*` env vars, the `# ramz` rc marker,
  the launchd label `local.ramz`, the npm package name, `window.ramz`. No `dx` is left in the
  code.
- **The icons are artwork, not code** (`assets/icon.svg`, `assets/tray.svg`), converted by
  `scripts/app-icon.cjs` through electron, since it is the only renderer we depend on and
  nativeImage cannot read SVG. The menubar mark is a template image: black plus alpha only, so
  it is its own simplified shape rather than a copy of the app icon.
- **The mark is the list, not a terminal prompt.** The `>_` icon was replaced because the app is
  a shelf of commands, not a terminal.
- **`LSUIElement` is deliberately not set.** It makes the Dock refuse to keep a tile, so the
  app could only be launched from Spotlight. The Dock icon is a stored preference instead
  (Settings → App → Show in the Dock), applied at runtime with `app.dock.show()/hide()`.
- **Preferences live in the store** (`prefs` in `commands.json`), not in `localStorage`, so the
  main process can read them before the UI exists. One file to back up.
- **The Dock tile points at `~/Applications/Ramz.app`**, not at `release/`, which every
  rebuild wipes. `npm run install:app` copies it there.

- **Kind describes what a thing is; frequency does not.** Hence `archived` as a flag and
  usage counters, rather than a fifth kind.
- **Aliases are scarce on purpose.** The test is "would I type this weekly", not "is it
  long". 54 → 23 in one pass; a 241-character command used twice a year is a better snippet.
- **Form is preserved on import.** A function stays a function, because in zsh
  defining a function whose name is already an alias is a parse error, and turning one into the
  other breaks the original file if both are loaded.
- **Aliases are emitted before functions**, since a function body only picks up an alias it
  calls if that alias already exists when the function is parsed.
- **Store lives outside the repo** so the project stays shareable; only
  `data/commands.example.json` is tracked.
- **Kinds are a registry, not conditionals** (`shared/kinds.ts` plus `src/kinds.tsx`). Adding
  a kind is two rows; nothing generic knows the names. Storage stays one `Entry` shape, so a
  new kind is never a store migration.
- **One core, two adapters** (`server/core.ts` + HTTP + IPC) so the Electron app and the web
  app can never drift.

## Traps already hit (do not rediscover)

- `ELECTRON_RUN_AS_NODE=1` is set in the VS Code terminal; inherited, the electron binary
  runs as plain node and `require("electron")` returns a path. The npm scripts clear it,
  and so does `install:app` before calling `open`, because `open` forwards the caller's
  environment: with the variable set the app launches and exits instantly, looking like a
  crash that only happens from the terminal.
- Replacing the bundle under a running copy orphans the process and leaves a Dock tile that
  only offers Force Quit (`killall Dock` clears it). `install:app` quits the app first.
- Electron's module is CJS: the main bundle must be CJS, which makes `import.meta.url`
  undefined, hence `PROJECT_ROOT` in `server/paths.ts`.
- Vite's default absolute `/assets/` paths break under `file://`; `base: "./"` is required.
- `nativeImage` cannot decode SVG, and `createEmpty()` + `setTitle()` is not reliably drawn.
  Both icons are rendered to PNG first (`scripts/app-icon.cjs`).
- A menubar app does not get key focus from `show()` alone; without `app.focus({steal:true})`
  the panel blurs and hides immediately, which looks like a crash.
- Placeholders left unfilled must stay as `{{name}}`. Substituting an empty string produced
  `expo@^ --fix`, a broken command with nothing to show what was missing.
- Quoting is context-sensitive: `"…#{{ref}}"` must emit `${1:-main}` bare inside the quotes,
  or the expansion lands outside them and splits on spaces.

## Open threads

0. File-based import and export with merge semantics, so entries can come from another
   machine without overwriting. The open question is collision behaviour: skip, overwrite, or
   keep both. Copying the store file is the current answer and is all-or-nothing.

1. Run with output: `node-pty` plus `xterm.js`. The reason Electron was chosen over a browser
   tab, and still the largest missing feature.
2. Launch at login (`app.setLoginItemSettings`).
3. Tests. See the verification methods in [development.md](development.md) for what they
   should cover first: the shell renderer and the quoting rules.
4. Notes cannot reach the palette today, because they have no single thing to copy. Worth
   revisiting: a note is often exactly what you are hunting for.

---

<sub>Part of [Ramz](../README.md). Written by Claude, directed and reviewed by the owner.</sub>
