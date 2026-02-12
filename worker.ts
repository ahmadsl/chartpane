/// <reference types="@cloudflare/workers-types" />
import OAuthProvider from "@cloudflare/workers-oauth-provider";
import * as Sentry from "@sentry/cloudflare";
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
  SENTRY_DSN: string;
  CF_VERSION_METADATA: { id: string; tag: string };
};

function createMcpHandler_(env: Env, ctx: ExecutionContext, route: string) {
  const userId = getMcpAuthContext()?.props?.userId as string | undefined;
  if (userId) Sentry.setUser({ id: userId });

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

  const instrumentedServer = Sentry.wrapMcpServerWithSentry(server, {
    recordInputs: true,
    recordOutputs: true,
  });
  return createMcpHandler(instrumentedServer, { route });
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

/**
 * Normalize the `resource` param to origin-only (no trailing slash).
 * mcp-remote sends "http://host:8787/" (trailing slash from URL.href),
 * but OAuthProvider validates audience against protocol://host (no slash).
 * Handles both query params (GET /authorize) and form body (POST /token).
 */
async function normalizeResourceParam(req: Request): Promise<Request> {
  // Query parameter (GET /authorize)
  const reqUrl = new URL(req.url);
  const qResource = reqUrl.searchParams.get("resource");
  if (qResource) {
    reqUrl.searchParams.set("resource", new URL(qResource).origin);
    return new Request(reqUrl, req);
  }
  // Form body (POST /token)
  if (req.method === "POST" && req.headers.get("content-type")?.includes("form-urlencoded")) {
    const body = new URLSearchParams(await req.clone().text());
    const bResource = body.get("resource");
    if (bResource) {
      body.set("resource", new URL(bResource).origin);
      return new Request(req.url, {
        method: req.method,
        headers: req.headers,
        body: body.toString(),
      });
    }
  }
  return req;
}

export default Sentry.withSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN,
    release: env.CF_VERSION_METADATA?.id,
    tracesSampleRate: 1.0,
    enableLogs: true,
    sendDefaultPii: true,
    initialScope: { tags: { surface: "worker" } },
    integrations: [
      Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
    ],
  }),
  {
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

      // Favicon — served for Google's favicon fetcher and browser tabs
      if (path === "/favicon.ico" || path === "/favicon.svg") {
        return new Response(
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="6" fill="#4F46E5"/><rect x="6" y="18" width="4" height="8" rx="1" fill="#fff"/><rect x="12" y="12" width="4" height="14" rx="1" fill="#fff"/><rect x="18" y="8" width="4" height="18" rx="1" fill="#fff"/><rect x="24" y="14" width="4" height="12" rx="1" fill="#fff" opacity="0.7"/></svg>`,
          { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" } },
        );
      }

      // RFC 9728: Protected Resource Metadata — override OAuthProvider's built-in
      // response because it includes the apiRoute path in `resource`, but its own
      // token validation checks audience against origin-only (protocol://host).
      if (
        path === "/.well-known/oauth-protected-resource" ||
        path === "/.well-known/oauth-protected-resource/mcp"
      ) {
        const origin = new URL(url).origin;
        return Response.json({
          resource: origin,
          authorization_servers: [`${origin}/`],
          bearer_methods_supported: ["header"],
        });
      }

      if (isAuthEnabled(env)) {
        oauthProvider ??= createOAuthProvider();
        req = await normalizeResourceParam(req);
        return oauthProvider.fetch(req, env, ctx);
      }
      // Unauthenticated fallback
      return createMcpHandler_(env, ctx, "/mcp")(req, env, ctx);
    },
  },
);
