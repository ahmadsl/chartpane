import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { createServer as createViteServer } from "vite";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

let latestConfig: unknown = null;

async function start() {
  const vite = await createViteServer({
    root: rootDir,
    server: { middlewareMode: true },
    appType: "custom",
  });

  const app = new Hono();
  app.use(cors());

  // API routes
  app.get("/api/latest-config", (c) => {
    if (!latestConfig) return c.body(null, 204);
    return c.json(latestConfig);
  });

  app.post("/api/config", async (c) => {
    latestConfig = await c.req.json();
    return c.json({ ok: true });
  });

  app.get("/sandbox/fixture/:name", (c) => {
    const name = c.req.param("name");
    const fixturePath = join(rootDir, "tests", "fixtures", `${name}.json`);
    try {
      const data = JSON.parse(readFileSync(fixturePath, "utf-8"));
      latestConfig = data;
      return c.json(data);
    } catch {
      return c.json({ error: `Fixture "${name}" not found` }, 404);
    }
  });

  app.get("/api/fixtures", (c) => {
    const fixtureDir = join(rootDir, "tests", "fixtures");
    const files = readdirSync(fixtureDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
    return c.json(files);
  });

  // Sandbox page — after Vite so html-proxy requests are handled first
  app.get("/sandbox", async (c) => {
    const html = readFileSync(join(__dirname, "sandbox.html"), "utf-8");
    const transformed = await vite.transformIndexHtml(
      "/sandbox/sandbox.html",
      html,
    );
    return c.html(transformed);
  });

  const PORT = 3456;
  const server = serve(
    { fetch: app.fetch, port: PORT },
    () => {
      console.log(
        `Sandbox dev server running at http://localhost:${PORT}/sandbox`,
      );
    },
  );

  // Inject Vite's Connect middleware into the Node server so it handles
  // TS/JS module transforms and html-proxy requests before Hono routes
  const listeners = server.listeners("request");
  const honoListener = listeners[0] as Function;
  server.removeAllListeners("request");
  server.on("request", (req, res) => {
    vite.middlewares(req, res, () => {
      honoListener(req, res);
    });
  });
}

start();
