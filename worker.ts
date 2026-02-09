/// <reference types="@cloudflare/workers-types" />
import { createMcpHandler } from "agents/mcp";
import { createServer } from "./server.js";

type Env = { ASSETS: Fetcher };

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const server = createServer({
      htmlLoader: async () => {
        const r = await env.ASSETS.fetch("https://assets.local/mcp-app.html");
        return r.text();
      },
    });
    return createMcpHandler(server, { route: "/" })(req, env, ctx);
  },
};
