/// <reference types="@cloudflare/workers-types" />
import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { createMcpHandler, getMcpAuthContext } from "agents/mcp";
import { createServer } from "./server.js";
import { googleHandler } from "./auth-handler.js";

type Env = {
  ASSETS: Fetcher;
  DB: D1Database;
  OAUTH_KV: KVNamespace;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  COOKIE_ENCRYPTION_KEY: string;
};

function createMcpHandler_(env: Env, ctx: ExecutionContext, route: string) {
  const userId = getMcpAuthContext()?.props?.userId as string | undefined;
  const server = createServer({
    htmlLoader: async () => {
      const r = await env.ASSETS.fetch("https://assets.local/mcp-app.html");
      return r.text();
    },
    onLog: (entry) => {
      const { tool, status, timestamp, ...rest } = entry;
      ctx.waitUntil(
        env.DB.prepare(
          "INSERT INTO requests (ts, tool, status, meta, user_id) VALUES (?, ?, ?, ?, ?)",
        )
          .bind(timestamp, tool, status, JSON.stringify(rest), userId ?? null)
          .run(),
      );
    },
    userId,
  });
  return createMcpHandler(server, { route });
}

const authApiHandler = {
  fetch(req: Request, env: Env, ctx: ExecutionContext) {
    return createMcpHandler_(env, ctx, "/mcp")(req, env, ctx);
  },
} as ExportedHandler & Required<Pick<ExportedHandler, "fetch">>;

function createOAuthProvider() {
  return new OAuthProvider({
    apiHandler: authApiHandler,
    apiRoute: "/mcp",
    defaultHandler: googleHandler as unknown as ExportedHandler,
    authorizeEndpoint: "/authorize",
    tokenEndpoint: "/token",
    clientRegistrationEndpoint: "/register",
  });
}

let oauthProvider: OAuthProvider | null = null;

function isAuthEnabled(env: Env): boolean {
  return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.COOKIE_ENCRYPTION_KEY);
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (isAuthEnabled(env)) {
      oauthProvider ??= createOAuthProvider();
      return oauthProvider.fetch(req, env, ctx);
    }
    // Unauthenticated fallback — current behavior
    return createMcpHandler_(env, ctx, "/")(req, env, ctx);
  },
};
