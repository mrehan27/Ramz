# Architecture

## The kind registry

A kind of entry (alias, snippet, runbook, note) declares itself in one place:
`shared/kinds.ts` for everything data-level, `src/kinds.tsx` for the page that renders it.

```ts
{ id, plural, singular, icon, blurb,
  exportable,   // reaches the shell
  inPalette,    // has one thing to copy, so it belongs in the palette
  fields,       // which editor fields to show
  defaults,     // what a new one starts as
  search,       // the strings search should index, in three weights
  validate }    // kind-specific rules, run by the schema
```

Generic code asks the registry instead of testing `kind === "alias"`: the sidebar and its
counts, the page router, search, the palette, export, the editor, and validation. The server
imports the same file, which is why it holds no React.

Adding a kind is two edits, a row in each file, and nothing else changes. Removing one is
the same two lines back out.

`shared/schema.ts` derives `KindSchema` from the registry ids, so a new kind validates and
persists without a migration. Storage stays one `Entry` shape on purpose: the registry adds
behaviour, not columns.

## One core, two adapters

`server/core.ts` holds every operation as a plain function. Two thin adapters call it:
`server/index.ts` maps them to HTTP routes, `electron/ipc.ts` maps them to IPC channels.
The UI picks its transport at runtime in `src/lib/bridge.ts`: IPC when running inside the
app, `fetch` when in a browser, so nothing above that file knows the difference.

## Data

Entries live **outside the repo**, in `~/.local/share/ramz/commands.json`, validated by
`shared/schema.ts` on every read and write. Commands are personal; the project is meant to
be reusable, so nothing personal is ever inside it. A missing store is seeded from the
tracked `data/commands.example.json`. Writes are atomic (tmp + rename) with a `.bak`.

Two gitignored symlinks make both directories visible from the editor:

```
links/shell -> ~/.config/ramz          generated shell files
links/store -> ~/.local/share/ramz     the entry store
```

One entry type covers all three pages:

| kind | page | exported |
|---|---|---|
| `alias` | Aliases | yes, when `exported: true` |
| `snippet` | Snippets | never |
| `runbook` | Runbooks | never |
| `note` | Notes | never |

A new page is a new filter over the same store, so add a row to `NAV` in `src/App.tsx`.

## Config

| env | default |
|---|---|
| `RAMZ_DIR` | `$XDG_CONFIG_HOME/ramz`, else `~/.config/ramz` |
| `RAMZ_STORE` | `data/commands.json` |
| `RAMZ_PORT` | `5174` |

---

<sub>Part of [RAMZ](../README.md). Written by Claude, directed and reviewed by the owner.</sub>
