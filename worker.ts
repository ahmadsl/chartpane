/// <reference types="@cloudflare/workers-types" />
import { createMcpHandler } from "agents/mcp";
import { createServer } from "./server.js";

type Env = { ASSETS: Fetcher; DB: D1Database };

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const server = createServer({
      htmlLoader: async () => {
        const r = await env.ASSETS.fetch("https://assets.local/mcp-app.html");
        return r.text();
      },
      onLog: (entry) => {
        const { tool, status, timestamp, ...rest } = entry;
        ctx.waitUntil(
          env.DB.prepare(
            "INSERT INTO requests (ts, tool, status, meta) VALUES (?, ?, ?, ?)",
          )
            .bind(timestamp, tool, status, JSON.stringify(rest))
            .run(),
        );
      },
    });
    return createMcpHandler(server, { route: "/" })(req, env, ctx);
  },
};
