# Architecture

## The kind registry

A kind of entry (alias, snippet, prompt, runbook, note) declares itself in one place:
`shared/kinds.ts` for everything data-level, `src/kinds.tsx` for the page that renders it.

```ts
{ id, plural, singular, icon, blurb,
  exportable,   // reaches the shell
  inPalette,    // has one thing to copy, so it belongs in the palette
  copyText,     // what that one thing is: a command, or a whole prompt body
  fields,       // which editor fields to show
  bodyField,    // wording for the free-text field, since a note is not a prompt
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

One entry type covers every page:

| kind | page | exported |
|---|---|---|
| `alias` | Aliases | yes, when `exported: true` |
| `snippet` | Snippets | never |
| `prompt` | Prompts | never |
| `runbook` | Runbooks | never |
| `note` | Notes | never |

A new page is a new filter over the same store, so add a row to `KINDS` and one to `PAGES`.
Analytics is the exception that proves it: a view rather than a kind, so it sits outside the
registry and is switched on directly in `src/App.tsx`.

## Order

`shared/sort.ts` holds the sorts, the sidebar order and the one-item move, all pure. Two prefs
back it (`sort` per kind and `kindOrder`), and one field on the entry (`order`). `orderedKinds`
repairs a stale stored order rather than obeying it, so a kind that was added or removed can
never leave a page unreachable.

`reorderEntries` in the core takes the ids in their new order and writes `order` as the index.
It deliberately leaves `updatedAt` alone: where an entry sits is not a change to what it says,
and bumping it would reshuffle the Newest and Recently used views on every drag. The client
applies the move locally first, because a drag that waited for a round trip snaps back under
the pointer.

`src/lib/useOrdering.ts` is the one place the pages share: it hands back the sorted list, the
props for the grip, the props for the row it would drop onto, and the classes that show both.

## Moving a library

`shared/transfer.ts` is the portable file and the merge, and it is pure: no fs, no crypto, no
clock. Ids and timestamps arrive as arguments, so the same code runs in the server, in the
browser and in a test. `server/core.ts` is the only part that touches disk, which is also
where gzip is unwrapped and where a bad file becomes a `RamzError`.

The merge is three functions, in the order the UI calls them: `planImport` sorts the incoming
entries into new and colliding, `applyImport` takes a plan plus one `choose` callback per
conflict, and `buildTransfer` writes. A collision is an id match, meaning the same entry from
another machine, or a kind and title match, meaning the same idea written twice. Overwrite
keeps the local id, creation date and usage counts, so what is local about an entry survives
someone else's copy of it.

## Search filters

`shared/query.ts` splits what you typed into kind filters, tag filters and the text to match.
The kind words come from the registry (`id`, plural, singular, first letter, plus `keywords`),
so a new kind is filterable the moment it exists, with nothing to add here. One word may name
two kinds: `cmd:` is both aliases and snippets.

## Variants

A prompt is usually 90% the same wherever it lands, so the body is written once with
`{{placeholders}}` and each variant supplies a named set of values for them:

```ts
variants: [{ name: "Android", description: "", values: { platform: "Android", test_cmd: "./gradlew test" } }]
```

Nothing about this is prompt-specific: variants are a field on `Entry`, and any kind can opt
in with `fields.variants`. Picking one fills the form, and you can still overwrite anything
before you copy, which is what keeps a variant from becoming a second copy of the prompt.

They are a dropdown rather than chips because the set is small, fixed and named (Android,
iOS), which is what a dropdown is for. "Custom" is always the first option, so a prompt whose
values are different every time is a first-class case rather than an empty preset.

## Config

| env | default |
|---|---|
| `RAMZ_DIR` | `$XDG_CONFIG_HOME/ramz`, else `~/.config/ramz` |
| `RAMZ_STORE` | `data/commands.json` |
| `RAMZ_PORT` | `5174` |

---

<sub>Part of [Ramz](../README.md). Written by Claude, directed and reviewed by the owner.</sub>
