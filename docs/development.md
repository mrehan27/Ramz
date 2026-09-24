# Development

Node 22+, macOS. `npm install`, then pick a mode.

## Running from source

```sh
npm run dev:app    # vite plus Electron pointed at it, live reload
npm run dev        # web only: api on 5174, ui on 5173
```

`dev:app` is the one to use for app work. `dev` is enough for UI work and runs in a browser
against the HTTP adapter.

## Installing your build

```sh
npm run install:app
```

The whole update loop in one command: package, quit a running copy, replace
`~/Applications/Ramz.app`, launch it. `--no-build` installs whatever is already in
`release/`; `--no-launch` leaves it closed.

It installs into `~/Applications` rather than running from `release/`, which every rebuild
wipes. The path never changes, so a Dock tile pinned once keeps working.

## Scripts

| | |
|---|---|
| `npm run dev:app` | app development, vite plus Electron |
| `npm run dev` | web development, live reload |
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm run package` | build `release/mac-arm64/Ramz.app` and the release zip |
| `npm run install:app` | build, install to `~/Applications`, relaunch |
| `npm run release` | tag, build and publish a GitHub release |
| `npm run icon` | regenerate `build/icon.icns` |
| `npm run icon:tray` | regenerate the menubar mark |
| `RAMZ_SELFTEST=1 electron .` | boot the app, check the panel rendered against the real store, print the result and quit |

## Testing

```sh
npm test          # node --test over tests/*.test.ts, no framework, no new dependency
```

Deliberately small: 34 cases over the logic that has actually broken, not coverage for its own
sake. What they pin down:

| file | what it guards |
|---|---|
| `tests/shell.test.ts` | the renderer and quoting rules, that the generated file really loads and runs in both bash and zsh, and that the rc block is added and removed exactly, never touching someone else's `init.sh` |
| `tests/transfer.test.ts` | import merge rules: re-importing is a no-op, collisions by id and by title, what overwrite keeps, refusing a bad file whole |
| `tests/sort.test.ts` | pinned first in every sort, each sort's order and tie-break, repairing a stale sidebar order |
| `tests/query.test.ts` | search filters, and that long bodies stay out of the fuzzy index |
| `tests/entries.test.ts` | per-kind validation, the one-default-variant rule, variant switching, and that older stored entries still load |

Two rules for anything added here:

- **Fixtures run.** The shell test sources its output and calls the definitions, so a fixture
  containing `git checkout -b {{a}}/{{b}}` will check out a branch in this repo. Write `echo`
  commands only, and the test also runs with its cwd in a temp directory.
- **One case per risk.** If a test cannot name the bug it would have caught, it is noise.

Beyond the suite:

- **`RAMZ_SELFTEST=1`** boots the packaged or unpackaged app, waits for React, and reports
  the bridge size, entry count, store path and rendered row count. It catches a broken
  preload, a broken IPC channel and a blank render, which are the failures that actually
  happen.
- **A headless UI harness.** Load `dist/index.html` in an Electron window with a stubbed
  `window.ramz`, drive it, and assert on rendered text. This is how the pages, the palette and
  the panel get checked, since none of it is reachable from a node test. Leave about 100ms
  between synthetic drag events, or React has not re-rendered and the drop silently does
  nothing.
- **`npm run typecheck` covers `electron/` too.** It did not until 2026-09-24, and the main
  process had four errors nobody could see, because esbuild strips types without checking them.

## The panel log

With Diagnostics on in Settings, the app writes `~/Library/Logs/Ramz/panel.log`: one JSON line
per event, window state only. Point it elsewhere with `RAMZ_LOG_DIR`, which is how to test it
without touching a real log. With `RAMZ_STORE` at a temp store whose prefs say `"debug": true`
and `--user-data-dir` at a temp directory (so it does not collide with an installed copy's
single-instance lock), a run leaves a log you can read:

```sh
python3 -c 'import json,sys; [print(json.loads(l)["e"], l[:160]) for l in open(sys.argv[1])]' panel.log
```

The events that matter are `show` (trigger, state before and after), then `show-ok` or
`show-suspect` 400ms later with the page's own answer. Everything around them (`power`,
`displays`, `rebuild`, `hotkey`) is context for why. To simulate a hung panel, `kill -STOP` the
renderer pid recorded in any snapshot, then ask for the panel.

## The README demo

```sh
npm run build && npm run demo:gif     # needs gifski: brew install gifski
```

`scripts/demo-gif.cjs` boots the built UI against **`data/commands.example.json`**, drives a
scripted sequence, captures frames through a frame subscription and hands them to gifski. It
records the example entries on purpose: the real store is personal and this output is
published, so the demo cannot show anything of yours.

Notes if you change it:

- Start the clock only once the first render has settled. The frames before that are the
  loading state, and the first frame is the poster GitHub shows.
- `capturePage` is about 7ms, so speed was never the problem there; a frame subscription plus a
  fixed-rate write is what makes a still moment repeat a frame rather than leave a gap.
- The pointer is drawn in the page. `capturePage` does not include the real cursor, so without
  it a click looks like the app moving on its own.
- `RAMZ_DEMO_KEEP=1` leaves the frames behind, which is the only way to check the middle.

## Icons

Both icons come from `assets/`, converted by `scripts/app-icon.cjs`:

| file | becomes | what it should be |
|---|---|---|
| `assets/icon.svg` | `build/icon.icns` | square art with the macOS rounded tile baked in |
| `assets/tray.svg` | `electron/assets/trayTemplate.png` | one shape, black plus alpha only |

PNG works too (`icon.png` at 1024x1024, `tray.png` at 44x44) and goes through `sips`. SVG is
rendered by drawing it in an Electron window and capturing it, because Electron is the only
renderer this project already depends on and `nativeImage` cannot read SVG.

The menubar image is a template: macOS recolours it for light and dark menubars, so colour
and gradients are dropped. It needs its own simple shape, not a copy of the app icon.

`npm run icon -- some/file.svg` renders a candidate without installing it. Both icons are
baked in at package time, so picking a new one means a full `npm run install:app`.

## Branches

`develop` is where work lands. `main` is what people install from, so it only moves when a
release is cut:

```sh
git checkout develop          # day to day
git checkout main && git merge develop && npm run release
```

Direct pushes to either are fine; this is a one-person project, and the split exists so an
unfinished afternoon never becomes someone's download.

## Releases

```sh
npm run release            # tag v<version in package.json>
npm run release -- 0.2.0   # set the version, then tag it
```

Needs `gh` and a clean working tree. It builds, tags, pushes the tag and creates a GitHub
release with the zip attached, which is what `install.sh` downloads.

Builds are unsigned (`identity: null`). Signing needs a paid Apple Developer account, and
without it downloads get quarantined, which `install.sh` handles.

## The web mode

Ramz can also run as a local web app, served by a launchd agent:

```sh
npm run build
npm run agent:install   # runs at login, http://127.0.0.1:5170
```

Logs go to `~/Library/Logs/ramz.log`. `agent:status`, `agent:restart`, `agent:reload`
(rebuild and restart) and `agent:uninstall` do what they say, and uninstall leaves nothing
behind. The agent and the dev servers use different ports on purpose, so both can run at
once; they share one store file.

This predates the menubar app and is kept because a browser tab reaches a phone over
tailscale. If you only want the app, you never need it.

---

<sub>Part of [Ramz](../README.md). Written by Claude, directed and reviewed by the owner.</sub>
