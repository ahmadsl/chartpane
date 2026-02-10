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
    accessTokenTTL: 86400, // 24 hours — reduces re-auth on reconnect cycles
  });
}

let oauthProvider: OAuthProvider | null = null;

function isAuthEnabled(env: Env): boolean {
  return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.COOKIE_ENCRYPTION_KEY);
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { method, url } = req;
    const path = new URL(url).pathname;

    // Log MCP JSON-RPC method for POST requests
    let rpcMethod: string | undefined;
    if (method === "POST") {
      const cloned = req.clone();
      try {
        const body = await cloned.json() as { method?: string };
        rpcMethod = body.method;
      } catch { /* not JSON */ }
    }

    const sessionId = req.headers.get("mcp-session-id");
    console.log(
      `[mcp] ${method} ${path}${rpcMethod ? ` → ${rpcMethod}` : ""}${sessionId ? ` [session=${sessionId.slice(0, 8)}]` : " [no-session]"}`,
    );

    // RFC 9728: Protected Resource Metadata — lets clients skip the
    // .well-known fallback chain (eliminates ~4 x 404s per reconnect cycle)
    if (
      path === "/.well-known/oauth-protected-resource" ||
      path === "/.well-known/oauth-protected-resource/mcp"
    ) {
      const origin = new URL(url).origin;
      return Response.json({
        resource: `${origin}/mcp`,
        authorization_servers: [`${origin}/`],
        bearer_methods_supported: ["header"],
      });
    }

    if (isAuthEnabled(env)) {
      oauthProvider ??= createOAuthProvider();
      return oauthProvider.fetch(req, env, ctx);
    }
    // Unauthenticated fallback — current behavior
    return createMcpHandler_(env, ctx, "/")(req, env, ctx);
  },
};
