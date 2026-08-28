import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import * as core from "./core.ts";
import { RamzError } from "./core.ts";
import { STORE_PATH } from "./store.ts";
import { RAMZ_DIR, PROJECT_ROOT } from "./paths.ts";

const app = new Hono();

/**
 * Any page the browser has open can send requests to 127.0.0.1. This API writes
 * files and edits shell rc files, so anything that is not the local UI is refused.
 */
app.use("*", async (c, next) => {
  const origin = c.req.header("origin");
  if (origin && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) {
    return new Response("forbidden", { status: 403 });
  }
  return next();
});

/** Every route is a thin wrapper: run a core call, map RamzError to a status. */
const run = async <T>(fn: () => Promise<T>) => {
  try {
    return Response.json(await fn());
  } catch (e) {
    if (e instanceof RamzError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
};

app.get("/api/config", () => run(core.getConfig));
app.get("/api/entries", () => run(core.listEntries));
app.post("/api/entries", async (c) => run(async () => core.createEntry(await c.req.json())));
app.put("/api/entries/:id", async (c) => run(async () => core.updateEntry(c.req.param("id"), await c.req.json())));
app.delete("/api/entries/:id", (c) => run(() => core.deleteEntry(c.req.param("id"))));
app.post("/api/entries/:id/used", (c) => run(() => core.markUsed(c.req.param("id"))));
app.post("/api/usage/reset", () => run(core.resetUsage));

app.put("/api/prefs", async (c) => run(async () => core.updatePrefs(await c.req.json())));

app.get("/api/tags", () => run(core.getTags));
app.put("/api/tags/:name", async (c) => run(async () => core.setTagColor(c.req.param("name"), (await c.req.json()).color)));
app.post("/api/tags/:name/rename", async (c) => run(async () => core.renameTag(c.req.param("name"), (await c.req.json()).to)));
app.delete("/api/tags/:name", (c) => run(() => core.deleteTag(c.req.param("name"))));

app.get("/api/export/preview", () => run(core.exportPreview));
app.post("/api/export", () => run(core.runExport));
app.delete("/api/export", () => run(core.removeGenerated));
app.post("/api/rc", async (c) => {
  const { file, action } = await c.req.json();
  return run(() => core.rcAction(file, action));
});

app.get("/api/import/scan", (c) => run(() => core.importScan(c.req.query("path"))));
app.post("/api/import", async (c) => run(async () => core.runImport(await c.req.json())));

/**
 * In production one process serves both the API and the built UI, so there is
 * nothing to start but this. `npm run dev` still runs vite separately.
 */
const dist = path.join(PROJECT_ROOT, "dist");
if (existsSync(dist)) {
  app.use("/assets/*", serveStatic({ root: path.relative(process.cwd(), dist) || "." }));
  app.get("*", async (c, next) => {
    if (c.req.path.startsWith("/api")) return next();
    return c.html(await readFile(path.join(dist, "index.html"), "utf8"));
  });
}

const port = Number(process.env.RAMZ_PORT ?? 5174);
serve({ fetch: app.fetch, hostname: "127.0.0.1", port });
console.log(`RAMZ      http://127.0.0.1:${port}${existsSync(dist) ? "" : "  (api only; run npm run build for the UI)"}`);
console.log(`  store  ${STORE_PATH}`);
console.log(`  shell  ${RAMZ_DIR}`);
