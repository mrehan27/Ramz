# Working on Ramz as an agent

For Claude, Cursor, Copilot and anyone else editing this repo without having lived through
its history. Read [notes.md](notes.md) next: it lists traps that have already cost time.

## What this is

A local-only shelf of commands, run as a macOS menubar app. It is a side project, written
end to end by Claude with the owner directing and reviewing rather than typing. Assume the
conventions below were chosen deliberately, and that anything undocumented is worth asking
about rather than guessing. No account, no network, no
telemetry. Anything that would send data somewhere, phone home, or write outside the two
directories below is out of scope, not a feature request.

## Ground rules

- **No em dashes.** Anywhere: UI copy, comments, docs, commit messages. Use a colon,
  semicolon, comma, parentheses, or two sentences.
- **Comment only what is not obvious from the code.** Say why, not what. Public-facing
  comments stay short.
- **Small, focused diffs.** Do not reformat or refactor code you were not asked to touch.
- **Match the file you are editing.** Naming, comment density, and idiom are already set.
- **Do not commit or push unless asked**, and only for substantial work, never a commit per
  tweak. Work on `develop`; `main` is what people install from.

## Adding a kind of entry

Two edits: a row in `shared/kinds.ts` and a row in `src/kinds.tsx`. The sidebar, counts,
search, palette, export, editor fields and validation all read from there. If you find
yourself writing `kind === "something"` in generic code, the registry is missing a field:
add it there instead.

## Adding an operation

Every operation is a plain function in `server/core.ts`. Two adapters call it, and the
renderer picks one at runtime. Adding one means touching four places, and forgetting the
third is the usual mistake:

1. `server/core.ts`: the function itself, throwing `RamzError` for anything the caller did wrong.
2. `electron/ipc.ts`: a line in `HANDLERS`.
3. `electron/preload.ts`: the channel name in `CHANNELS`, which is a **literal list**, kept
   that way so the preload bundle carries no server code.
4. `src/lib/api.ts`: a method declaring both transports, and `server/index.ts` for the route.

`RAMZ_SELFTEST=1` reports the bridge size, so a channel missing from the preload shows up as
a number that did not go up.

## Shell output

The generated files are the part that can break someone's terminal. Rules that are not
negotiable:

- Output must be valid in **both bash and zsh**.
- **Aliases are emitted before functions.** A function body only picks up an alias it calls
  if that alias exists when the function is parsed.
- **Form is preserved on import.** A function stays a function: in zsh, defining a function
  whose name is already an alias is a parse error.
- **Substitution is quote-aware.** The same argument needs different treatment inside single
  quotes, double quotes and bare context. See the table in [using.md](using.md).
- **Unfilled placeholders stay as `{{name}}`.** Substituting an empty string produces a
  command that looks complete and is not.

Verify by executing, not by reading: point `RAMZ_DIR` and `RAMZ_STORE` at a scratch
directory, export, and source the result in real shells.

## Data you must not touch

- The store is `~/.local/share/ramz/commands.json`, **outside the repo**. Only
  `data/commands.example.json` is tracked. Never move personal entries into the repo.
- The files a user points Import at (a dotfile, a folder of shell scripts, an rc file) are
  **read-only**. Import reads them; nothing writes to them.

## Leave these to the user

Do not run, on their behalf: exporting for real, editing `~/.zshrc`, installing the launchd
agent, installing the app. Build and verify all you like, then hand over the command. The
one exception is `npm run install:app` during your own testing, and say when you have done it,
because it quits their running copy.

## Checks before you hand back

```sh
npm run typecheck
npm test
npm run build
RAMZ_SELFTEST=1 electron .     # or the packaged binary
```

State plainly what you verified and what you did not. "Typechecks" is not the same as "works",
and the suite is deliberately narrow: anything in the UI still has to be run.

Before pushing, also grep the staged diff for anything personal (paths, names, tokens, the
owner's own entries). The project has to stay empty and pluggable. **The repo is public**, so
that includes anything that hints at a workplace: a real ticket prefix, an internal service
name, a host. Examples in `data/commands.example.json`, the placeholders in `shared/kinds.ts`
and the recorded demo are all shipped content, and the demo is a picture of the app, so it is
worth watching rather than assuming.

## Keeping these documents current

Decisions and traps go in writing as they happen, not at the end:

- a decision, or the reason something is the way it is, goes in [notes.md](notes.md)
- a trap that cost time goes in notes.md too, under the traps heading
- a rule an agent must follow goes here
- anything a user needs to know goes in [using.md](using.md)

Assume the next session starts with no memory of this conversation. If a change would surprise
it, write the reason down.

---

<sub>Part of [Ramz](../README.md). Written by Claude, directed and reviewed by the owner.</sub>
