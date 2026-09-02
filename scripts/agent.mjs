#!/usr/bin/env node
/**
 * Manages the launchd agent that keeps Ramz running in the background.
 * install | uninstall | restart | status
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LABEL = process.env.RAMZ_AGENT_LABEL ?? "local.ramz";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLIST = path.join(os.homedir(), "Library", "LaunchAgents", `${LABEL}.plist`);
const LOG = path.join(os.homedir(), "Library", "Logs", "ramz.log");
const PORT = process.env.RAMZ_PORT ?? "5170";
const TSX = path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const target = `gui/${process.getuid()}`;

/** Returns null instead of throwing: launchctl failing is a state, not a crash. */
const sh = (cmd, args) => {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  } catch {
    return null;
  }
};

const loaded = () => sh("launchctl", ["print", `${target}/${LABEL}`]) !== null;

const bail = (msg) => {
  console.error(msg);
  process.exit(1);
};

function plist() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${process.execPath}</string>
    <string>${TSX}</string>
    <string>${path.join(ROOT, "server", "index.ts")}</string>
  </array>
  <key>WorkingDirectory</key><string>${ROOT}</string>
  <key>EnvironmentVariables</key>
  <dict><key>RAMZ_PORT</key><string>${PORT}</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${LOG}</string>
  <key>StandardErrorPath</key><string>${LOG}</string>
</dict>
</plist>
`;
}

const cmd = process.argv[2] ?? "status";

if (cmd === "install") {
  if (!existsSync(path.join(ROOT, "dist"))) bail("No dist/ yet; run `npm run build` first.");
  mkdirSync(path.dirname(PLIST), { recursive: true });
  writeFileSync(PLIST, plist());
  sh("launchctl", ["bootout", `${target}/${LABEL}`]);
  if (sh("launchctl", ["bootstrap", target, PLIST]) === null) bail(`launchctl refused to load ${PLIST}`);
  console.log(`installed  ${PLIST}`);
  console.log(`running    http://127.0.0.1:${PORT}`);
  console.log(`logs       ${LOG}`);
} else if (cmd === "uninstall") {
  const wasLoaded = loaded();
  sh("launchctl", ["bootout", `${target}/${LABEL}`]);
  if (existsSync(PLIST)) unlinkSync(PLIST);
  console.log(wasLoaded || existsSync(PLIST) ? "removed. Ramz no longer starts at login." : "nothing to remove.");
} else if (cmd === "restart") {
  // Nothing to restart is a normal state, so say so rather than failing a build chain.
  if (!loaded()) {
    if (!existsSync(PLIST)) {
      console.log("Ramz is not installed as a background app; `npm run agent:install` sets that up.");
      console.log("The build is done either way; `npm run dev` still works.");
      process.exit(0);
    }
    if (sh("launchctl", ["bootstrap", target, PLIST]) === null) bail(`launchctl refused to load ${PLIST}`);
    console.log(`started    http://127.0.0.1:${PORT}`);
  } else {
    if (sh("launchctl", ["kickstart", "-k", `${target}/${LABEL}`]) === null) bail("launchctl could not restart Ramz");
    console.log(`restarted  http://127.0.0.1:${PORT}`);
  }
} else {
  const out = sh("launchctl", ["print", `${target}/${LABEL}`]) ?? "";
  if (!out.trim()) {
    console.log(existsSync(PLIST)
      ? "installed but not running; `npm run agent:restart`"
      : "not installed; run `npm run agent:install`");
  }
  else {
    const pick = (k) => (out.match(new RegExp(`${k} = (.+)`)) ?? [, "?"])[1].trim();
    console.log(`state ${pick("state")}  pid ${pick("pid")}  port ${PORT}`);
  }
}
