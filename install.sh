#!/bin/sh
# Part of Ramz (https://github.com/mrehan27/Ramz). Written by Claude.
# Installs the latest Ramz release into /Applications.
#
#   curl -fsSL https://raw.githubusercontent.com/mrehan27/Ramz/main/install.sh | sh
#
# The app is unsigned, so macOS quarantines anything downloaded from a browser
# and refuses to open it. This clears that flag on the copy it just installed,
# which is the same thing right-click > Open does, minus the dialog.
set -eu

REPO="mrehan27/Ramz"
APP="Ramz.app"
DEST="${RAMZ_DEST:-/Applications}"

[ "$(uname -s)" = "Darwin" ] || { echo "Ramz is macOS only"; exit 1; }
[ "$(uname -m)" = "arm64" ] || echo "warning: releases are built for Apple silicon"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

echo "finding the latest release"
url=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
  | grep '"browser_download_url"' | grep '\.zip"' | head -1 | cut -d'"' -f4)
[ -n "$url" ] || { echo "no zip in the latest release of $REPO"; exit 1; }

echo "downloading $(basename "$url")"
curl -fsSL "$url" -o "$tmp/ramz.zip"
ditto -x -k "$tmp/ramz.zip" "$tmp"
[ -d "$tmp/$APP" ] || { echo "the zip did not contain $APP"; exit 1; }

if [ -d "$DEST/$APP" ]; then
  echo "quitting the running copy"
  osascript -e 'quit app "Ramz"' 2>/dev/null || true
  rm -rf "$DEST/$APP"
fi

echo "installing to $DEST"
ditto "$tmp/$APP" "$DEST/$APP"
xattr -dr com.apple.quarantine "$DEST/$APP" 2>/dev/null || true

open "$DEST/$APP"
echo "installed. Press cmd-shift-K for the palette, or click the menubar icon."
