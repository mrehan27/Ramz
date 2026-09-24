/**
 * A diagnostic log for the one bug that cannot be reproduced on demand: the
 * panel that sometimes does not appear. The menubar block shows the state now;
 * this keeps the state at the moment it went wrong, for as long as it takes to
 * look at it.
 *
 * Written only while the debug pref is on. Window state only: never an entry,
 * a search, or anything typed. One JSON object per line, so it can be read by
 * eye or parsed. Capped at 1 MB with one rotated file, so leaving it on costs
 * nothing worth noticing.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync } from "node:fs";
import path from "node:path";

const LIMIT = 1024 * 1024;

export function makeLog(dir: string) {
  const file = path.join(dir, "panel.log");
  const old = path.join(dir, "panel.1.log");
  let on = false;
  let writes = 0;

  const rotate = () => {
    try {
      if (existsSync(file) && statSync(file).size > LIMIT) renameSync(file, old);
    } catch { /* a log must never be the thing that breaks the app */ }
  };

  return {
    file,
    get on() { return on; },
    set on(next: boolean) { on = next; },

    write(event: string, fields: Record<string, unknown> = {}) {
      if (!on) return;
      try {
        mkdirSync(dir, { recursive: true });
        // Checking the size on every write is wasteful; every 50 is plenty.
        if (writes++ % 50 === 0) rotate();
        appendFileSync(file, `${JSON.stringify({ t: new Date().toISOString(), e: event, ...fields })}\n`);
      } catch { /* same: swallow, never throw from here */ }
    },

    /** The last `lines` entries, across the rotation boundary if need be. */
    tail(lines = 200) {
      const read = (f: string) => (existsSync(f) ? readFileSync(f, "utf8").split("\n").filter(Boolean) : []);
      try {
        return [...read(old), ...read(file)].slice(-lines).join("\n");
      } catch {
        return "";
      }
    },
  };
}
