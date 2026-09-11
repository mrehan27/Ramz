# Working notes

Decisions, open threads and traps. [development.md](development.md) covers how to run and
build it, [agents.md](agents.md) the conventions; this is the context that would otherwise
live only in conversation.

## Where things stand

- **Written entirely by Claude**, directed and reviewed by the owner. Which is why these
  notes exist: they carry the context a fresh session would otherwise have to rediscover.
- **`npm test` covers the logic, running it covers the rest.** 19 cases over the shell
  renderer and quoting, the search filters and per-kind validation, including a real bash and
  zsh load. Anything in the UI still has to be run: the selftest and the headless harnesses in
  [development.md](development.md) are how.
- **v0.1.0 is out**, cut from `main` with `npm run release`. The artifact was verified by
  downloading it from the release, extracting it and booting it with `RAMZ_SELFTEST=1`. The
  curl one-liner itself only works once the repo is public: while it was private, both
  `raw.githubusercontent.com` and the releases API returned 404.
- **Nothing is signed.** Releases are ad-hoc signed, and `install.sh` clears the quarantine
  flag on the user's own machine.

## Decisions worth remembering

- **The panel is an NSPanel** (`type: "panel"`, `screen-saver` level, visible on all Spaces).
  A plain window plus `app.focus({steal:true})` activates the app, and activating a regular
  app raises its own Space, which drops you out of a full-screen window onto the desktop. An
  NSPanel takes key focus without activating, so the panel overlays whatever is in front.
- **A variant is a named set of placeholder values, not a copy of the prompt.** The prompt
  body is written once; a variant only supplies values for the `{{placeholders}}` in it. That
  keeps the 90% that is shared in one place, and it is why variants are a generic field on
  `Entry` rather than something prompt-shaped. Anything a variant leaves unset still has to be
  typed, which is deliberate: the per-run detail should not hide inside a preset.
- **The panel refetches on show, via `visibilitychange`.** `useStore` loads once on mount and
  the panel window is hidden rather than closed, so its entries were frozen at launch: a prompt
  added in the main window never appeared in ⌘K until the app restarted.
- **Views start at the top.** One scroll container holds every page, so a scrolled list handed
  its offset to the next view and it opened halfway down.
- **The test suite is deliberately small.** 19 cases over what has actually broken: the shell
  renderer and quoting, the search filters, per-kind validation and variant behaviour. The rule
  is one case per risk, and a test that cannot name the bug it would have caught is noise. The
  UI is still verified by running it, because a node test cannot see it.
- **Keep-awake is an assertion, not a setting.** `powerSaveBlocker.start("prevent-display-sleep")`
  holds a `NoDisplaySleep` assertion for the life of the process, which beats the display-sleep
  timer and needs no permission, so it works on a managed machine where the setting is locked.
  It is released on quit and by its own timer. What it does not promise is the screen staying
  lit after a policy-forced lock: that runs on the screen-saver timer, and is untested.
- **Prompt rows collapse, and copying does not need them open.** A prompt card showed five
  stacked blocks (header, description, dropdown, every field, preview), so a handful of prompts
  filled several screens. The row keeps only identity and the action; one card opens at a time.
  Copy stays on the row because the default variant usually fills everything, and the blocked
  case says `Fill` and opens the row focused on the first blank.
- **Prompt cards are keyed on `id:updatedAt`.** Their variant and values come from `useState`
  initialisers, which React keeps across a re-render, so a newly marked default only appeared
  after leaving the page and coming back. The key makes an edited card rebuild itself; a copy
  does not bump `updatedAt`, so it does not throw away what you were typing.
- **No `Tip` inside a scroll container.** It is absolutely positioned, so `overflow: auto`
  clips it: on the variants grid it was cut 11px above and 96px past the right edge. Dense
  places inside a scroller use the native `title` instead, which the browser draws on top.
- **The default variant lives on the variant, not on the entry.** A flag survives renaming;
  a `defaultVariant: string` on the entry would have to be kept in step with the name. The
  schema allows at most one.
- **The panel resets on hide, via `visibilitychange`.** It is hidden rather than unmounted, so
  its React state survives; without a reset it reopened on the fill step of whatever you last
  copied. That one event covers every hide path: Esc, click away, the menubar icon, a copy.
- **No native `<select>` in the panel.** A native dropdown opens an NSMenu, which needs the
  app to be active. The panel takes key focus without activating (that is the whole point of
  the NSPanel), so the menu never opened and the control looked dead. The panel uses buttons
  instead: focus starts on them, 1-9 picks one, and the arrows move along the row.
- **Switching variant keeps what you typed.** Replacing every value wiped the one field the
  variant does not own (the version), which silently disabled Copy, so the clipboard kept
  whatever was in it and the whole thing read as "Copy ignores the dropdown". Only
  placeholders some variant owns are replaced; see `valuesFor`.
- **Long bodies are searched literally, not fuzzily.** Fuse over a page of prose finds a
  match for nearly any query, so indexing prompt and note bodies as fuzzy keys made every
  prompt match every search. `SearchDoc.text` is matched by substring and appended below the
  ranked hits; only short fields (title, description, tags, names) stay fuzzy.
- **The palette ignores Enter while a `<select>` has focus.** A native dropdown answers its
  own Enter, and the palette copying on that same keystroke used the value the select was in
  the middle of changing, which read as "copy always gives the default".
- **Analytics is a page, not a Settings section.** Settings is now only what you change
  (paths, app behaviour, shell status); what you observe moved out to its own view. It counts
  copies out of Ramz only, so an alias typed in your own shell never appears there, and the
  page says so rather than implying it measures your shell.
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

- **The UI trusts entries that came through the schema.** Every field is filled by then, and
  the renderer reads `entry.variants.length` without guarding. Feeding it the raw example JSON
  (written before variants existed) killed the renderer with `undefined.length` and left a
  blank window. Any stub or fixture has to fill the defaults; `complete()` in
  `scripts/demo-gif.cjs` is the one place that does.
- **A test fixture that renders shell output will run it.** The bash and zsh test sources the
  generated file and calls the definitions, so a fixture with `git checkout -b {{a}}/{{b}}`
  created a branch in this repo. Fixtures use `echo` commands only, and the test runs with its
  cwd in a temp directory.
- **A dead panel renderer looks like a broken shortcut.** The panel has `vibrancy` and no
  frame, so if its renderer process goes, the window still reports `isVisible()` true and
  paints nothing: pressing the hotkey called `showPanel`, which did its job and showed an
  invisible window, and quitting the app was the only way back. `watchPanel` now rebuilds it on
  `render-process-gone`, a real `did-fail-load` (not an aborted -3) or `unresponsive`, at most
  three times, and `showPanel` checks `webContents.isCrashed()` first. Verified by killing the
  renderer process and watching it come back. The tray menu reports panel and renderer state,
  because a packaged app has no console to read.

- **Scrubbing a string from history takes more than rewriting the branches.** A tag keeps its
  old commit, and everything it reaches, alive: after both branches were rewritten, 11 files
  still matched through `refs/tags/v0.1.0`, and the release zip carried the string inside the
  bundled example store. Deleting the release with `--cleanup-tag` and cutting a fresh one was
  the fix. Also, `filter-branch -- --all` rewrites the `origin/*` tracking refs too, which
  makes the follow-up `--force-with-lease` fail as stale; `-- --branches --tags` does not.
- **`npm run release` leaves the tree dirty.** It runs `npm run icon`, and the encoder is not
  byte-deterministic, so `build/icon.icns` always comes back modified. Discard it rather than
  committing the churn; the tracked icns is fine.

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

Waiting on the owner, not on code: **Sync to shell has still never been run**, so the generated
files and the rc line do not exist on his machine yet, and the **keep-awake lock-screen
question** is unverified (the display-sleep assertion holds, but a policy-forced lock runs on
its own timer).

Import and export is decided: **merge, and skip on a collision by default**, with the choice
offered per conflict (skip, overwrite, keep both) plus an apply-to-all, and a dry-run summary
("12 new, 3 conflicts") before anything is written.


0. File-based import and export, per the decision above. Copying the store file is the current
   answer and is all-or-nothing.

1. Install from the curl line on a clean path, now that the repo is public. v0.1.0 exists and
   the artifact boots, but the one-liner in the README has still never been run against the
   real URLs.
2. Run with output: `node-pty` plus `xterm.js`. **Low priority, kept rather than dropped.** The
   owner asked what it was worth and the honest answer was: little, since he runs commands in
   his own terminal where the context lives. Note that this was once called the reason Electron
   was chosen, which is wrong. The reasons are the global hotkey, a panel that floats over
   full-screen apps, and a Dock tile.
3. Launch at login (`app.setLoginItemSettings`).
4. Notes cannot reach the palette today, because they have no single thing to copy. Worth
   revisiting: a note is often exactly what you are hunting for. Prompts do reach it, via
   `copyText` on the kind, which is the shape a note would need too.
5. The menubar diagnostics block (behind the `debug` pref) can come out once the invisible
   panel has stayed away for a while. It exists because a packaged app has no console.
6. Variants only substitute values. A prompt whose platforms differ by a whole paragraph has
   to keep that paragraph in a placeholder, which works but reads oddly in the editor.

---

<sub>Part of [Ramz](../README.md). Written by Claude, directed and reviewed by the owner.</sub>
