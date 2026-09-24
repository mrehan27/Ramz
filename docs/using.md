# Using Ramz

## In the UI

- **Archive** keeps a rarely-used entry out of the lists and out of an empty ⌘K, while
  leaving it fully searchable. **Usage** is counted on every copy, so ⌘K orders by what you
  actually reach for, and **Analytics** in the sidebar shows where those copies went.
- **The Prompts page is a list of rows**, one open at a time. A row carries the title, its
  description, the variant dropdown and Copy, which is everything the common case needs: no
  expanding to copy. **Fill** opens the row on the first value still to type, and the chevron
  opens it for the fields, the preview and Edit or Delete.
- **Prompts** are the prompts you hand an agent more than once. Write the body once, put
  `{{braces}}` around the parts that change, and add a **variant** for each place it lands:
  a named set of values, so one prompt covers the Android repo and the iOS one without
  becoming two prompts that drift apart. The variant list is a dropdown on the card: pick one
  and the form fills, edit anything before copying, or leave it on **Custom** for a run that
  matches no preset. The last entry in that list opens the editor on the variants themselves,
  so a prompt can grow one later. Switching variant keeps anything you typed that the variant
  does not set, so changing platform does not lose the version you just entered. Mark one
  variant as the **default** and the prompt opens on it, which is what makes a prompt with no
  per-placeholder defaults copyable without picking anything first.
- **In ⌘K** the variants are buttons rather than a dropdown, because a native menu cannot open
  over the panel. Focus starts on them, **1-9** picks one, ←/→ walks the row, and picking one
  jumps to the first value still to type. Fields a variant has already answered are not shown
  at all, so a variant that fills everything leaves nothing but enter to press. Each row
  carries its kind's icon. The panel resets to an empty search every time it hides, so it never
  reopens halfway through the last thing you copied.
- **Notes** hold reference text rather than commands: markdown-lite, where ``` fences become
  copyable blocks, `##` is a heading and `---` a rule. Placeholders work in a note body too.
- **⌘K** opens a lookup palette: type, ↑↓, Enter copies. Commands that need arguments open
  a fill-in step first instead of copying a template with holes in it. Processes are left
  out, since there is nothing to copy.
- **Search** is fuzzy over name, title, description and tags, and literal over long bodies.
  It also takes filters, typed in any order and in any search box:

  | typed | means |
  |---|---|
  | `prompt:` `prompts:` `p:` | only prompts. Every kind answers to its own name, plural and first letter |
  | `cmd:` `command:` | aliases and snippets together, the things that run |
  | `#git` | only entries tagged `git`, matched on a prefix so `#and` finds `android` |
  | `prompt: release` | both at once. `prompt:release` works too |

  Anything that is not a filter stays search text, so a query with a colon in it (a URL, a
  ratio) still searches for itself. ⌘K shows the active filters above the list.
- **Pin** (★) floats a command to the top of its list, and pinned commands get their own
  group. Sorting is otherwise alphabetical by title.
- **Group by tag** buckets cards under their first tag; groups collapse on click, with
  collapse-all/expand-all. Grouping pauses while searching, where relevance order matters
  more. Both the toggle and which groups are collapsed live in `localStorage`.
- **Tags** are managed from the sidebar: colour from a fixed palette (`TAG_COLORS` in
  `shared/schema.ts`, stored per tag in the store), rename, or remove. Renaming rewrites
  every command carrying the tag and merges cleanly if the target already exists; removing
  strips the tag and leaves the commands alone. Right-clicking a tag chip in the filter row
  is a shortcut to the colour palette.
- **Tag entry** on a command suggests what already exists and marks anything unrecognised as
  a new tag, so a typo cannot quietly fork `android` into `andriod`.
- **Fill** on a command with arguments opens the fill-in form and focuses the first field
  instead of copying a template full of `{{placeholders}}`. Arguments that have a default
  can be copied straight away, using the defaults. Typed values stick around after a copy,
  which helps when you copy the same command with one argument changed, and ↺ clears them.
- Actions that change the shell (Sync, adding or removing the rc block, uninstall) raise a
  toast with the exact command to reload an already-open shell.

## Keeping the screen awake

The menubar menu has **Keep the screen awake**: off, 15 or 30 minutes, 1 or 4 hours, or until
you turn it off. A dot appears next to the menubar icon while it is on, and the menu shows the time
left, so an hour of held-awake screen is hard to forget.

It holds a `NoDisplaySleep` assertion, the same one a video call holds. That outranks the
display-sleep timer without changing a setting, so a managed machine has nothing to object to.
Confirm it with:

```sh
pmset -g assertions | grep -i nodisplay
```

Settings has one more switch worth knowing about: **Show diagnostics in the menubar menu** adds
panel, renderer and shortcut state to the bottom of that menu. Leave it off until quick search
misbehaves.

Whether the display stays lit after the screen locks depends on your machine's screen-saver
and lock policy, which is a separate timer. Test it before relying on it.

## Arguments

Write `{{name}}` in a command. Arguments are derived from the template, so the two can't
drift. In the UI they become a fill-in form whose output you copy. On export they become
positional parameters:

```sh
alias gcm='git checkout main'                       # no arguments -> alias
gbr() { git checkout -b "$1-$2"; }                  # arguments -> function
ports() { lsof -nP -iTCP:"${1:-3000}" -sTCP:LISTEN; }   # default value
```

Aliases cannot take arguments in any shell, which is why anything parameterised is
emitted as a function. Output is restricted to syntax valid in both bash and zsh.

Arguments become positional parameters in the order they are listed, so **arguments with a
default belong last**, otherwise callers have to pass an empty string to skip one. Export
warns when the order would force that.

Substitution is quote-aware, because the same `$1` needs different treatment depending on
where the placeholder sits in the template:

| template | emitted |
|---|---|
| `run {{x}}` | `run "$1"` |
| `npm i "github:o/r#{{x}}"` | `npm i "github:o/r#${1:-main}"` |
| `sh -c 'echo {{x}}'` | `sh -c 'echo '"$1"' here'` |

Without this, a placeholder inside quotes would end up expanding unquoted and split on
spaces.

## Sync to shell

Two things, in order: connect your shell once, then press **Sync** whenever you change an
alias.

**Connecting** is three lines at the end of `~/.zshrc`, fenced so they can be found, checked
and removed exactly:

```sh
# BEGIN Ramz SECTION
if [ -r "${XDG_CONFIG_HOME:-$HOME/.config}/ramz/init.sh" ]; then . "${XDG_CONFIG_HOME:-$HOME/.config}/ramz/init.sh"; fi
# END Ramz SECTION
```

The dialog shows the block with a Copy button until it finds it, then just says
**connected**. Paste it yourself, or let Ramz add it from Details. The line only reads a file
Ramz owns, and does nothing, exit status 0, if that file is gone. Ramz recognises the older
single line, and the same block with `[ ] &&` in place of the `if`, so an rc you set up
earlier keeps working.

**Sync** writes two files, both owned entirely by Ramz:

```
~/.config/ramz/
  init.sh      loader: finds its own directory, sources the files beside it
  aliases.sh   the generated aliases and functions
```

Both are rewritten in full every time (atomic tmp + rename), so no file is ever half ours.
Before writing, Ramz blocks on duplicate names and undefined placeholders, and warns when a
name shadows something already on `$PATH`. New terminals pick the result up by themselves;
the dialog gives you the one command to reload the terminal you are in.

`rm -rf ~/.config/ramz` is a complete uninstall: the rc block goes quiet. Remove files in
Details does the same, and refuses to delete anything in there that does not carry the
generated header. Removing the block, from Details or by hand, takes exactly the fenced lines
and nothing else. An unrelated `source ~/something/init.sh` is never mistaken for ours.

Adding another generated file later (per-tag files, completions) means adding it to
`GENERATED` in `server/paths.ts`; `init.sh` picks it up and the rc block never changes.

## Order

Every list has a **Sort** control, because the old order was pinned first then alphabetical
with nothing on screen saying so, which reads as arbitrary.

| | |
|---|---|
| **My order** | whatever you dragged it into |
| **A to Z** | by title, the default |
| **Recently used** | last copied first; never copied sorts last, not first |
| **Most used** | by how often you have copied it |
| **Newest** | most recently added first |

The choice is remembered per kind, so Prompts can be in your own order while Aliases stay
alphabetical. **Pinned entries stay on top in every sort, manual included**: pinning is how you
say "this one first", and a drag moves an entry within its own group.

Under **My order** each row grows a grip (⠿). Drag it to move that entry. Only the grip is
draggable, so text stays selectable and the inputs keep working. Dragging is off while you are
searching, because dropping a row into a relevance-ranked list would look like it worked and
then undo itself on the next keystroke. On the Aliases and Snippets pages, grouping by tag also
steps aside while you drag, since a row dragged across a tag boundary would jump back into its
own group and look broken. A newly added entry has no position yet, so it appears at the top
until you move it.

The **sidebar is draggable too**. Put the kinds in whatever order suits you, and whichever
you put first is the one that opens when you start Ramz.

## Export and import a file

Settings > Your data writes everything, or only the kinds you tick, to one JSON file. It is
plain text on purpose: a full library is around 100 KB and gzips to 16, so compressing it
would buy nothing worth losing a file you can read, diff, or fix a line of by hand. Import
accepts a gzipped file anyway.

Import never writes before showing you what it would do:

| | |
|---|---|
| **New** | not here yet, so it is simply added |
| **Already here** | matched by id, which is the same entry from another machine, or by kind and title, which is the same idea written twice |
| **Identical** | matched and the content agrees, so there is nothing to decide |

Every collision gets a choice, and the default is the safe one:

| | |
|---|---|
| **Keep mine** | the default. Changes nothing |
| **Take theirs** | their content replaces yours, but your id, creation date and usage counts stay. A file from another machine does not know how often you copied it |
| **Keep both** | adds theirs alongside as "title (imported)" |

Set one answer for everything with the **all** dropdown, or answer a row at a time. A file
that is not ours, or written by a newer Ramz, is refused whole rather than imported in part:
a partial import you cannot see is worse than a clear refusal.

## Scan shell files

Point **Scan shell files** at a file **or a directory** of shell files (`~/.aliases`, a folder of shell
scripts, an rc file). Scanning is read-only: the source is never written to. Per definition it picks
up:

- `alias` lines and simple functions, with `$1` / `${2:-x}` turned back into
  `{{arg1}}` / `{{arg2}}` placeholders
- the comment block directly above as the title (a lone word reads as a section header and
  is ignored)
- the form it was defined with, so a function stays a function on re-export
- the source file name as a tag, so imported groups stay filterable

`export` and `source` lines are reported as skipped rather than silently dropped, as is
anything the schema rejects.

### Form matters

An entry exports as a function when it takes arguments, spans multiple lines, or has
`asFunction` set; otherwise as an alias. Preserving the original form is not cosmetic: in
zsh, defining a function whose name is already an alias is a **parse error**, so a file
that turned someone's function into an alias would break the original file if both were
loaded. Aliases are also emitted before functions, because a function body only picks up
an alias it calls if that alias is already defined when the function is parsed.

---

<sub>Part of [Ramz](../README.md). Written by Claude, directed and reviewed by the owner.</sub>
