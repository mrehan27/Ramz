import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { isFunction, renderAliases, renderEntry, validateForExport } from "../server/shell.ts";
import { entry, param } from "./helpers.ts";

test("a plain command becomes an alias, with quotes closed and reopened", () => {
  const out = renderEntry(entry({ name: "gcm", command: "git commit -m 'wip'" }));
  assert.equal(out, `alias gcm='git commit -m '\\''wip'\\'''`);
});

test("placeholders are substituted according to the quoting around them", () => {
  const out = renderEntry(entry({
    name: "f",
    command: `run {{a}} "and {{b}}" 'or {{c}}'`,
    params: [param("a"), param("b"), param("c")],
  }));
  // bare text needs its own quotes; inside double quotes it must add none; inside
  // single quotes it has to break out or the shell takes it literally.
  assert.match(out, /run "\$1" "and \$\{?2\}?" 'or '"\$3"''/);
});

test("a default becomes a shell default, escaped for the expansion", () => {
  const out = renderEntry(entry({ name: "ports", command: "lsof -i:{{port}}", params: [param("port", "3000")] }));
  assert.match(out, /\$\{1:-3000\}/);
  const quoted = renderEntry(entry({ name: "q", command: "echo {{x}}", params: [param("x", 'a"b$c')] }));
  assert.match(quoted, /\$\{1:-a\\"b\\\$c\}/);
});

test("arguments, a forced function, or several lines all mean a function", () => {
  assert.equal(isFunction(entry({ command: "one line" })), false);
  assert.equal(isFunction(entry({ command: "one line", params: [param("a")] })), true);
  assert.equal(isFunction(entry({ command: "one line", asFunction: true })), true);
  assert.equal(isFunction(entry({ command: "two\nlines" })), true);
});

test("export refuses what the shell cannot run", () => {
  const problems = validateForExport([
    entry({ id: "1", name: "a", command: "echo {{nope}}" }),
    entry({ id: "2", name: "dup", command: "x" }),
    entry({ id: "3", name: "dup", command: "y" }),
  ]);
  const errors = problems.filter((p) => p.level === "error").map((p) => p.message);
  assert.equal(errors.length, 2);
  assert.match(errors.join(" "), /no such argument is defined/);
  assert.match(errors.join(" "), /share the name "dup"/);
});

test("export warns about argument order and names sh rejects", () => {
  const problems = validateForExport([
    entry({
      id: "1",
      name: "my-fn",
      command: "run {{opt}} {{needed}}",
      params: [param("opt", "x"), param("needed")],
    }),
  ]);
  const warnings = problems.filter((p) => p.level === "warn").map((p) => p.message).join(" ");
  assert.match(warnings, /callers have to pass an empty string/);
  assert.match(warnings, /not in \/bin\/sh/);
});

// The check that has caught real bugs: the file has to load and run in both shells.
for (const shell of ["bash", "zsh"]) {
  test(`the generated file loads in ${shell} and the definitions work`, () => {
    const dir = mkdtempSync(join(tmpdir(), "ramz-"));
    const file = join(dir, "aliases.sh");
    // Every command here is an echo: the test sources this file and calls the
    // definitions, so anything real would actually run.
    writeFileSync(file, renderAliases([
      entry({ id: "1", name: "gcm", command: "echo checkout main" }),
      entry({ id: "2", name: "gbr", command: "echo branch {{type}}/{{name}}", params: [param("type"), param("name")] }),
      entry({ id: "3", name: "ports", command: "echo :{{port}}", params: [param("port", "3000")] }),
      entry({ id: "4", name: "skipped", command: "echo no", exported: false }),
    ]));
    const script = `
      set -e
      . ${JSON.stringify(file)}
      alias gcm >/dev/null && echo alias-ok
      echo "$(gbr feat login)"
      echo "$(ports)"
      echo "$(ports 8080)"
      type skipped >/dev/null 2>&1 && echo LEAKED || echo not-exported
      set | grep -c '^_ramz' || true
    `;
    // Run it well away from the repo, so a mistake in a fixture cannot reach it.
    const out = execFileSync(shell, ["-c", script], { encoding: "utf8", cwd: dir });
    assert.match(out, /alias-ok/);
    assert.match(out, /branch feat\/login/, "arguments reach the function in order");
    assert.match(out, /not-exported/);
    assert.doesNotMatch(out, /LEAKED/);
    assert.match(out, /:3000/, "a default fills in when no argument is given");
    assert.match(out, /:8080/, "an argument overrides the default");
  });
}
