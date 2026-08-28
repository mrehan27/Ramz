# Install

macOS on Apple silicon. The build is unsigned, which is the only thing that makes any of
this more than a drag and drop.

## The script

```sh
curl -fsSL https://raw.githubusercontent.com/mrehan27/RAMZ/main/install.sh | sh
```

It finds the latest release, downloads the zip, quits a running copy, installs to
`/Applications`, clears the quarantine flag and opens the app. Set `RAMZ_DEST` to install
somewhere else:

```sh
curl -fsSL https://raw.githubusercontent.com/mrehan27/RAMZ/main/install.sh | RAMZ_DEST=~/Applications sh
```

## By hand

1. Download the zip from [releases](https://github.com/mrehan27/RAMZ/releases).
2. Unzip it and move `RAMZ.app` to `/Applications`.
3. Right-click the app and choose **Open**, then **Open** again in the dialog.

Step 3 matters. Double-clicking an unsigned app downloaded from a browser gets you
"RAMZ is damaged and can't be opened", which is macOS reporting the quarantine flag rather
than anything actually wrong. Right-click and Open tells Gatekeeper you meant it. The same
thing from a terminal:

```sh
xattr -dr com.apple.quarantine /Applications/RAMZ.app
```

## Updating

Run the install script again. It replaces the app in place, so anything you pinned to the
Dock keeps working, and your entries are untouched.

## Uninstalling

```sh
osascript -e 'quit app "RAMZ"'
rm -rf /Applications/RAMZ.app
rm -rf ~/Library/Application\ Support/RAMZ    # window state and caches
```

If you exported aliases, remove those too. The app's Export dialog has an Uninstall button
that does exactly this, or by hand:

```sh
rm -rf ~/.config/ramz                          # the generated shell files
```

and delete the line tagged `# ramz` from your `~/.zshrc` or `~/.bashrc`.

Your entries live in `~/.local/share/ramz/commands.json`. Deleting that is the last step,
and it is the only one you cannot undo.

---

<sub>Part of [RAMZ](../README.md). Written by Claude, directed and reviewed by the owner.</sub>
