import express from "express";
import cors from "cors";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

async function start() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  let latestConfig: unknown = null;

  // API routes — must be registered before Vite middleware
  app.get("/api/latest-config", (_req, res) => {
    if (!latestConfig) {
      res.status(204).send();
      return;
    }
    res.json(latestConfig);
  });

  app.post("/api/config", (req, res) => {
    latestConfig = req.body;
    res.json({ ok: true });
  });

  app.get("/sandbox/fixture/:name", (req, res) => {
    const name = req.params.name;
    const fixturePath = join(rootDir, "tests", "fixtures", `${name}.json`);
    try {
      const data = JSON.parse(readFileSync(fixturePath, "utf-8"));
      latestConfig = data;
      res.json(data);
    } catch {
      res.status(404).json({ error: `Fixture "${name}" not found` });
    }
  });

  app.get("/api/fixtures", (_req, res) => {
    const fixtureDir = join(rootDir, "tests", "fixtures");
    const files = readdirSync(fixtureDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
    res.json(files);
  });

  // Create Vite dev server in middleware mode
  const vite = await createViteServer({
    root: rootDir,
    server: { middlewareMode: true },
    appType: "custom",
  });

  // Vite middleware — handles TS/JS modules and html-proxy requests
  app.use(vite.middlewares);

  // Sandbox page — after Vite so html-proxy requests are handled first
  app.get("/sandbox", async (_req, res) => {
    const html = readFileSync(join(__dirname, "sandbox.html"), "utf-8");
    const transformed = await vite.transformIndexHtml("/sandbox/sandbox.html", html);
    res.set("Content-Type", "text/html");
    res.send(transformed);
  });

  const PORT = 3456;
  app.listen(PORT, () => {
    console.log(`Sandbox dev server running at http://localhost:${PORT}/sandbox`);
  });
}

start();
