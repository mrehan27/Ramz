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

There is no test suite yet. What there is instead:

- **`RAMZ_SELFTEST=1`** boots the packaged or unpackaged app, waits for React, and reports
  the bridge size, entry count, store path and rendered row count. It catches a broken
  preload, a broken IPC channel and a blank render, which are the failures that actually
  happen.
- **Isolated export runs.** Point `RAMZ_DIR` and `RAMZ_STORE` at a scratch directory, export,
  then source the generated files in real `sh`, `bash` and `zsh` with stubbed binaries. Three
  real bugs have shipped through the render and quoting path, so shell output is worth
  executing rather than eyeballing.

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
