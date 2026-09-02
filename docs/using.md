# Using Ramz

## In the UI

- **Archive** keeps a rarely-used entry out of the lists and out of an empty ⌘K, while
  leaving it fully searchable. **Usage** is counted on every copy, so ⌘K orders by what you
  actually reach for, and Settings shows the top five plus a counter reset.
- **Notes** hold reference text rather than commands: markdown-lite, where ``` fences become
  copyable blocks, `##` is a heading and `---` a rule. Placeholders work in a note body too.
- **⌘K** opens a lookup palette: type, ↑↓, Enter copies. Commands that need arguments open
  a fill-in step first instead of copying a template with holes in it. Processes are left
  out, since there is nothing to copy.
- **Search** is fuzzy over name, title, description, command and tags; tag chips filter.
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
- **Copy** on a command with arguments opens the fill-in form and focuses the first field
  instead of copying a template full of `{{placeholders}}`. Arguments that have a default
  can be copied straight away, using the defaults. Typed values stick around after a copy,
  which helps when you copy the same command with one argument changed, and ↺ clears them.
- Actions that change the shell (export, adding or removing the rc line, uninstall) raise a
  toast with the exact command to reload an already-open shell.

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

## Export and install

Export generates two files, both owned entirely by Ramz:

```
~/.config/ramz/
  init.sh      loader - locates its own directory, sources the files beside it
  aliases.sh   the generated aliases and functions
```

Both are rewritten in full on every export (atomic tmp + rename), so there is no
managed-block splicing and no way to half-own a file. Before writing, Ramz blocks on
duplicate names and undefined placeholders, and warns when a name shadows something
already on `$PATH`.

Your shell needs exactly one line, which the app can add and remove for you:

```sh
[ -r "${XDG_CONFIG_HOME:-$HOME/.config}/ramz/init.sh" ] && . "${XDG_CONFIG_HOME:-$HOME/.config}/ramz/init.sh" # Ramz
```

The `# ramz` tag is how the line is found again for removal. The line is inert when the
directory is missing, so `rm -rf ~/.config/ramz` is a complete uninstall. Nothing else on
the system knows Ramz exists. The Uninstall button does the same, and refuses to delete any
file in there that does not carry the generated header.

Adding another generated file later (per-tag files, completions) means adding it to
`GENERATED` in `server/paths.ts`; `init.sh` picks it up and the rc line never changes.

## Import

Point Import at a file **or a directory** of shell files (`~/.aliases`, a folder of shell
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
