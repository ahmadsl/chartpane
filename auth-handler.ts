// Google OAuth handler for ChartPane, adapted from Cloudflare's official example:
// https://github.com/cloudflare/ai/blob/main/demos/remote-mcp-github-oauth/src/github-handler.ts

import type { AuthRequest, OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { Hono } from "hono";
import {
  addApprovedClient,
  bindStateToSession,
  createOAuthState,
  generateCSRFProtection,
  isClientApproved,
  OAuthError,
  renderApprovalDialog,
  sanitizeText,
  sanitizeUrl,
  validateCSRFToken,
  validateOAuthState,
} from "./workers-oauth-utils.js";

export type Props = { userId: string; email: string; name: string };

type Env = {
  OAUTH_PROVIDER: OAuthHelpers;
  OAUTH_KV: KVNamespace;
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  COOKIE_ENCRYPTION_KEY: string;
};

const app = new Hono<{ Bindings: Env }>();

// --- GET /authorize ---
app.get("/authorize", async (c) => {
  const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
  const { clientId } = oauthReqInfo;
  if (!clientId) return c.text("Invalid request", 400);

  // If client already approved, skip consent dialog
  if (await isClientApproved(c.req.raw, clientId, c.env.COOKIE_ENCRYPTION_KEY)) {
    const { stateToken } = await createOAuthState(oauthReqInfo, c.env.OAUTH_KV);
    const { setCookie } = await bindStateToSession(stateToken);
    return redirectToGoogle(c.req.raw, stateToken, c.env.GOOGLE_CLIENT_ID, {
      "Set-Cookie": setCookie,
    });
  }

  const { token: csrfToken, setCookie } = generateCSRFProtection();

  return renderApprovalDialog(c.req.raw, {
    client: await c.env.OAUTH_PROVIDER.lookupClient(clientId),
    csrfToken,
    server: {
      name: "ChartPane",
      description:
        "ChartPane renders Chart.js charts inline in Claude. Sign in with Google to track your chart history.",
    },
    setCookie,
    state: { oauthReqInfo },
  });
});

// --- POST /authorize ---
app.post("/authorize", async (c) => {
  try {
    const formData = await c.req.raw.formData();
    validateCSRFToken(formData, c.req.raw);

    const encodedState = formData.get("state");
    if (!encodedState || typeof encodedState !== "string") {
      return c.text("Missing state in form data", 400);
    }

    let state: { oauthReqInfo?: AuthRequest };
    try {
      state = JSON.parse(atob(encodedState));
    } catch {
      return c.text("Invalid state data", 400);
    }

    if (!state.oauthReqInfo?.clientId) {
      return c.text("Invalid request", 400);
    }

    // Remember approved client
    const approvedCookie = await addApprovedClient(
      c.req.raw,
      state.oauthReqInfo.clientId,
      c.env.COOKIE_ENCRYPTION_KEY,
    );

    // Create state and bind to session
    const { stateToken } = await createOAuthState(state.oauthReqInfo, c.env.OAUTH_KV);
    const { setCookie: sessionCookie } = await bindStateToSession(stateToken);

    const headers = new Headers();
    headers.append("Set-Cookie", approvedCookie);
    headers.append("Set-Cookie", sessionCookie);

    return redirectToGoogle(
      c.req.raw,
      stateToken,
      c.env.GOOGLE_CLIENT_ID,
      Object.fromEntries(headers),
    );
  } catch (error: unknown) {
    if (error instanceof OAuthError) return error.toResponse();
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("POST /authorize error:", message);
    return c.text(`Internal server error: ${message}`, 500);
  }
});

// --- GET /callback ---
app.get("/callback", async (c) => {
  // Validate state + session binding
  let oauthReqInfo: AuthRequest;
  let clearSessionCookie: string;

  try {
    const result = await validateOAuthState(c.req.raw, c.env.OAUTH_KV);
    oauthReqInfo = result.oauthReqInfo;
    clearSessionCookie = result.clearCookie;
  } catch (error: unknown) {
    if (error instanceof OAuthError) return error.toResponse();
    return c.text("Internal server error", 500);
  }

  if (!oauthReqInfo.clientId) {
    return c.text("Invalid OAuth request data", 400);
  }

  const code = c.req.query("code");
  if (!code) return c.text("Missing authorization code", 400);

  // Exchange code for Google token
  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: new URL("/callback", c.req.url).href,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResp.ok) {
    const body = await tokenResp.text();
    console.error("Google token exchange failed:", body);
    return c.text("Failed to exchange authorization code", 502);
  }

  const tokenData = (await tokenResp.json()) as { access_token: string };

  // Fetch user info from Google
  const userinfoResp = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    { headers: { Authorization: `Bearer ${tokenData.access_token}` } },
  );

  if (!userinfoResp.ok) {
    return c.text("Failed to fetch user info", 502);
  }

  const userinfo = (await userinfoResp.json()) as {
    id: string;
    email: string;
    name: string;
  };

  // Upsert user in D1
  const userId = `g-${userinfo.id}`;
  await c.env.DB.prepare(
    `INSERT INTO users (id, email, name, google_id, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(google_id) DO UPDATE SET
       email = excluded.email,
       name = excluded.name,
       updated_at = datetime('now')`,
  )
    .bind(userId, userinfo.email, userinfo.name, userinfo.id)
    .run();

  // Complete the MCP OAuth flow
  const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
    request: oauthReqInfo,
    userId,
    metadata: { label: userinfo.name },
    scope: oauthReqInfo.scope,
    props: {
      userId,
      email: userinfo.email,
      name: userinfo.name,
    } as Props,
  });

  // Look up client name for the success page
  const clientInfo = await c.env.OAUTH_PROVIDER.lookupClient(oauthReqInfo.clientId);
  const clientName = clientInfo?.clientName || "your MCP client";

  const headers = new Headers();
  if (clearSessionCookie) {
    headers.set("Set-Cookie", clearSessionCookie);
  }
  headers.set("Content-Type", "text/html; charset=utf-8");

  return new Response(
    renderSuccessPage(userinfo.name, clientName, redirectTo),
    { headers },
  );
});

function renderSuccessPage(
  userName: string,
  clientName: string,
  redirectTo: string,
): string {
  const safeName = sanitizeText(userName);
  const safeClient = sanitizeText(clientName);
  const safeRedirect = sanitizeUrl(redirectTo);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ChartPane - Signed In</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    :root{--blue:#4e79a7;--green:#59a14f;--green-light:#e8f5e4;--bg:#f8fafb;--card:#fff;--text:#1a2433;--text-2:#5a6a7e;--text-3:#8a96a6;--border:#e2e8f0;--sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
    body{font-family:var(--sans);color:var(--text);background:var(--bg);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1.5rem;position:relative;overflow:hidden}
    body::before{content:"";position:fixed;inset:0;background-image:linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px);background-size:48px 48px;opacity:.35;pointer-events:none}
    .card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:2.5rem 2rem;max-width:400px;width:100%;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.04),0 8px 24px rgba(0,0,0,.06);position:relative;z-index:1;animation:slideUp .4s ease}
    @keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    .icon{width:56px;height:56px;border-radius:50%;background:var(--green-light);display:flex;align-items:center;justify-content:center;margin:0 auto 1.25rem}
    .icon svg{width:28px;height:28px;color:var(--green);animation:check .5s ease .2s both}
    @keyframes check{from{opacity:0;transform:scale(.5)}to{opacity:1;transform:scale(1)}}
    h1{font-size:1.25rem;font-weight:700;letter-spacing:-.02em;margin-bottom:.375rem}
    .sub{color:var(--text-2);font-size:.875rem;line-height:1.6;margin-bottom:1.5rem}
    .sub strong{color:var(--text);font-weight:600}
    .status{font-size:.8125rem;color:var(--text-3)}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
    </div>
    <h1>Welcome, ${safeName}</h1>
    <p class="sub">You're signed in to <strong>ChartPane</strong>.</p>
    <p class="status">You can close this tab and return to <strong>${safeClient}</strong>.</p>
  </div>
  <script>window.location.href=${JSON.stringify(safeRedirect)};</script>
</body>
</html>`;
}

function redirectToGoogle(
  request: Request,
  stateToken: string,
  clientId: string,
  headers: Record<string, string> = {},
): Response {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: new URL("/callback", request.url).href,
    response_type: "code",
    scope: "openid email profile",
    state: stateToken,
  });

  return new Response(null, {
    status: 302,
    headers: {
      ...headers,
      Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    },
  });
}

export { app as googleHandler };
