/// <reference types="@cloudflare/workers-types" />
// OAuth utility functions adapted from Cloudflare's official example:
// https://github.com/cloudflare/ai/blob/main/demos/remote-mcp-github-oauth/src/workers-oauth-utils.ts
// Includes CSRF protection, state management, and consent dialog rendering.

import type {
  AuthRequest,
  ClientInfo,
} from "@cloudflare/workers-oauth-provider";

// Workers runtime provides timingSafeEqual on crypto.subtle
const subtle = crypto.subtle as SubtleCrypto & {
  timingSafeEqual(a: ArrayBufferView, b: ArrayBufferView): boolean;
};

export class OAuthError extends Error {
  constructor(
    public code: string,
    public description: string,
    public statusCode = 400,
  ) {
    super(description);
    this.name = "OAuthError";
  }

  toResponse(): Response {
    return new Response(
      JSON.stringify({
        error: this.code,
        error_description: this.description,
      }),
      {
        status: this.statusCode,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

// --- Sanitization ---

export function sanitizeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function sanitizeUrl(url: string): string {
  const normalized = url.trim();
  if (normalized.length === 0) return "";

  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    if ((code >= 0x00 && code <= 0x1f) || (code >= 0x7f && code <= 0x9f)) {
      return "";
    }
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalized);
  } catch {
    return "";
  }

  const scheme = parsedUrl.protocol.slice(0, -1).toLowerCase();
  if (!["https", "http"].includes(scheme)) return "";

  return normalized;
}

// --- CSRF Protection ---

const CSRF_COOKIE = "__Host-CSRF_TOKEN";

export function generateCSRFProtection(): {
  token: string;
  setCookie: string;
} {
  const token = crypto.randomUUID();
  const setCookie = `${CSRF_COOKIE}=${token}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=600`;
  return { token, setCookie };
}

export function validateCSRFToken(
  formData: FormData,
  request: Request,
): { clearCookie: string } {
  const tokenFromForm = formData.get("csrf_token");
  if (!tokenFromForm || typeof tokenFromForm !== "string") {
    throw new OAuthError("invalid_request", "Missing CSRF token in form data");
  }

  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const csrfCookie = cookies.find((c) => c.startsWith(`${CSRF_COOKIE}=`));
  const tokenFromCookie = csrfCookie
    ? csrfCookie.substring(CSRF_COOKIE.length + 1)
    : null;

  if (!tokenFromCookie) {
    throw new OAuthError("invalid_request", "Missing CSRF token cookie");
  }
  const formBytes = new TextEncoder().encode(tokenFromForm);
  const cookieBytes = new TextEncoder().encode(tokenFromCookie);
  if (
    formBytes.byteLength !== cookieBytes.byteLength ||
    !subtle.timingSafeEqual(formBytes, cookieBytes)
  ) {
    throw new OAuthError("invalid_request", "CSRF token mismatch");
  }

  return {
    clearCookie: `${CSRF_COOKIE}=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`,
  };
}

// --- OAuth State (KV-backed) ---

export async function createOAuthState(
  oauthReqInfo: AuthRequest,
  kv: KVNamespace,
  stateTTL = 600,
): Promise<{ stateToken: string }> {
  const stateToken = crypto.randomUUID();
  await kv.put(
    `oauth:state:${stateToken}`,
    JSON.stringify(oauthReqInfo),
    { expirationTtl: stateTTL },
  );
  return { stateToken };
}

async function hashStateToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const SESSION_COOKIE = "__Host-CONSENTED_STATE";

export async function bindStateToSession(
  stateToken: string,
): Promise<{ setCookie: string }> {
  const hashHex = await hashStateToken(stateToken);
  return {
    setCookie: `${SESSION_COOKIE}=${hashHex}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=600`,
  };
}

export async function validateOAuthState(
  request: Request,
  kv: KVNamespace,
): Promise<{ oauthReqInfo: AuthRequest; clearCookie: string }> {
  const url = new URL(request.url);
  const stateFromQuery = url.searchParams.get("state");
  if (!stateFromQuery) {
    throw new OAuthError("invalid_request", "Missing state parameter");
  }

  const storedDataJson = await kv.get(`oauth:state:${stateFromQuery}`);
  if (!storedDataJson) {
    throw new OAuthError("invalid_request", "Invalid or expired state");
  }

  // Validate session binding cookie
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const consentedCookie = cookies.find((c) =>
    c.startsWith(`${SESSION_COOKIE}=`),
  );
  const consentedHash = consentedCookie
    ? consentedCookie.substring(SESSION_COOKIE.length + 1)
    : null;

  if (!consentedHash) {
    throw new OAuthError(
      "invalid_request",
      "Missing session binding cookie - authorization flow must be restarted",
    );
  }

  const stateHash = await hashStateToken(stateFromQuery);
  const stateBytes = new TextEncoder().encode(stateHash);
  const consentedBytes = new TextEncoder().encode(consentedHash);
  if (
    stateBytes.byteLength !== consentedBytes.byteLength ||
    !subtle.timingSafeEqual(stateBytes, consentedBytes)
  ) {
    throw new OAuthError(
      "invalid_request",
      "State token does not match session - possible CSRF attack detected",
    );
  }

  let oauthReqInfo: AuthRequest;
  try {
    oauthReqInfo = JSON.parse(storedDataJson) as AuthRequest;
  } catch {
    throw new OAuthError("server_error", "Invalid state data", 500);
  }

  // Delete state from KV (one-time use)
  await kv.delete(`oauth:state:${stateFromQuery}`);

  return {
    oauthReqInfo,
    clearCookie: `${SESSION_COOKIE}=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`,
  };
}

// --- Approved Clients (cookie-backed) ---

const APPROVED_COOKIE = "__Host-APPROVED_CLIENTS";
const THIRTY_DAYS = 2592000;

async function importKey(secret: string): Promise<CryptoKey> {
  if (!secret) throw new Error("cookieSecret is required for signing cookies");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign", "verify"],
  );
}

async function signData(data: string, secret: string): Promise<string> {
  const key = await importKey(secret);
  const buf = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifySignature(
  signatureHex: string,
  data: string,
  secret: string,
): Promise<boolean> {
  const key = await importKey(secret);
  try {
    const matches = signatureHex.match(/.{1,2}/g);
    if (!matches) return false;
    const sigBytes = new Uint8Array(
      matches.map((byte) => Number.parseInt(byte, 16)),
    );
    return crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes.buffer,
      new TextEncoder().encode(data),
    );
  } catch {
    return false;
  }
}

async function getApprovedClientsFromCookie(
  request: Request,
  cookieSecret: string,
): Promise<string[] | null> {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const target = cookies.find((c) => c.startsWith(`${APPROVED_COOKIE}=`));
  if (!target) return null;

  const cookieValue = target.substring(APPROVED_COOKIE.length + 1);
  const parts = cookieValue.split(".");
  if (parts.length !== 2) return null;

  const [signatureHex, base64Payload] = parts;
  const payload = atob(base64Payload);
  if (!(await verifySignature(signatureHex, payload, cookieSecret)))
    return null;

  try {
    const parsed = JSON.parse(payload);
    if (
      !Array.isArray(parsed) ||
      !parsed.every((item) => typeof item === "string")
    )
      return null;
    return parsed as string[];
  } catch {
    return null;
  }
}

export async function isClientApproved(
  request: Request,
  clientId: string,
  cookieSecret: string,
): Promise<boolean> {
  const approved = await getApprovedClientsFromCookie(request, cookieSecret);
  return approved?.includes(clientId) ?? false;
}

export async function addApprovedClient(
  request: Request,
  clientId: string,
  cookieSecret: string,
): Promise<string> {
  const existing =
    (await getApprovedClientsFromCookie(request, cookieSecret)) || [];
  const updated = Array.from(new Set([...existing, clientId]));
  const payload = JSON.stringify(updated);
  const signature = await signData(payload, cookieSecret);
  const cookieValue = `${signature}.${btoa(payload)}`;
  return `${APPROVED_COOKIE}=${cookieValue}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${THIRTY_DAYS}`;
}

// --- Approval Dialog ---

export interface ApprovalDialogOptions {
  client: ClientInfo | null;
  server: { name: string; logo?: string; description?: string };
  state: Record<string, unknown>;
  csrfToken: string;
  setCookie: string;
}

export function renderApprovalDialog(
  request: Request,
  options: ApprovalDialogOptions,
): Response {
  const { client, server, state, csrfToken, setCookie } = options;
  const encodedState = btoa(JSON.stringify(state));

  const serverName = sanitizeText(server.name);
  const clientName = client?.clientName
    ? sanitizeText(client.clientName)
    : "Unknown MCP Client";
  const serverDescription = server.description
    ? sanitizeText(server.description)
    : "";

  const logoUrl = server.logo
    ? sanitizeText(sanitizeUrl(server.logo))
    : "";
  const clientUri = client?.clientUri
    ? sanitizeText(sanitizeUrl(client.clientUri))
    : "";

  const redirectUris =
    client?.redirectUris && client.redirectUris.length > 0
      ? client.redirectUris
          .map((uri) => sanitizeText(sanitizeUrl(uri)))
          .filter((uri) => uri !== "")
      : [];

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${clientName} | ChartPane Authorization</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    :root{--blue:#4e79a7;--blue-light:#6a9bc3;--orange:#f28e2b;--bg:#f8fafb;--card:#fff;--text:#1a2433;--text-2:#5a6a7e;--text-3:#8a96a6;--border:#e2e8f0;--mono:"SF Mono",Monaco,"Cascadia Code","Fira Code",monospace;--sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
    body{font-family:var(--sans);color:var(--text);background:var(--bg);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1.5rem;line-height:1.55;position:relative;overflow:hidden}
    body::before{content:"";position:fixed;inset:0;background-image:linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px);background-size:48px 48px;opacity:.35;pointer-events:none}
    .wrap{width:100%;max-width:480px;position:relative;z-index:1}
    .brand{display:flex;align-items:center;gap:.625rem;margin-bottom:.5rem}
    .brand-icon{width:36px;height:36px;flex-shrink:0}
    .brand h1{font-size:1.25rem;font-weight:700;letter-spacing:-.02em;color:var(--text)}
    .desc{color:var(--text-2);font-size:.875rem;margin-bottom:1.5rem;line-height:1.6}
    .card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:1.75rem;box-shadow:0 1px 3px rgba(0,0,0,.04),0 8px 24px rgba(0,0,0,.06)}
    .card-header{font-size:1rem;font-weight:600;color:var(--text);margin-bottom:1.25rem;display:flex;align-items:center;gap:.5rem}
    .card-header .dot{width:8px;height:8px;border-radius:50%;background:var(--orange);flex-shrink:0}
    .client-box{background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:1rem;margin-bottom:1.25rem}
    .client-row{display:flex;align-items:baseline;gap:.5rem;margin-bottom:.375rem;font-size:.8125rem}
    .client-row:last-child{margin-bottom:0}
    .client-label{color:var(--text-3);min-width:70px;flex-shrink:0;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;font-weight:500}
    .client-val{font-family:var(--mono);font-size:.8125rem;color:var(--text);word-break:break-all}
    .client-val a{color:var(--blue);text-decoration:none}
    .client-val a:hover{text-decoration:underline}
    .note{font-size:.8125rem;color:var(--text-2);margin-bottom:1.5rem;line-height:1.6}
    .note .g{color:var(--text-3)}
    .actions{display:flex;gap:.75rem;justify-content:flex-end}
    .btn{padding:.625rem 1.25rem;border-radius:8px;font-size:.875rem;font-weight:500;cursor:pointer;border:none;font-family:var(--sans);transition:all .15s ease}
    .btn-approve{background:var(--blue);color:#fff}
    .btn-approve:hover{background:var(--blue-light)}
    .btn-cancel{background:transparent;border:1px solid var(--border);color:var(--text-2)}
    .btn-cancel:hover{background:var(--bg);color:var(--text)}
    @media(max-width:540px){
      .wrap{max-width:100%}
      .card{padding:1.25rem}
      .actions{flex-direction:column}
      .btn{width:100%;text-align:center}
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="brand">
      ${logoUrl ? `<img src="${logoUrl}" alt="" class="brand-icon">` : `<svg class="brand-icon" viewBox="0 0 36 36" fill="none"><rect width="36" height="36" rx="8" fill="var(--blue)"/><rect x="8" y="18" width="5" height="10" rx="1" fill="#fff" opacity=".9"/><rect x="15.5" y="12" width="5" height="16" rx="1" fill="#fff"/><rect x="23" y="8" width="5" height="20" rx="1" fill="#fff" opacity=".9"/></svg>`}
      <h1>${serverName}</h1>
    </div>
    ${serverDescription ? `<p class="desc">${serverDescription}</p>` : ""}
    <div class="card">
      <div class="card-header"><span class="dot"></span> ${clientName} is requesting access</div>
      <div class="client-box">
        <div class="client-row"><span class="client-label">Client</span><span class="client-val">${clientName}</span></div>
        ${clientUri ? `<div class="client-row"><span class="client-label">Website</span><span class="client-val"><a href="${clientUri}" target="_blank" rel="noopener noreferrer">${clientUri}</a></span></div>` : ""}
        ${redirectUris.length > 0 ? `<div class="client-row"><span class="client-label">Redirect</span><span class="client-val">${redirectUris.map((uri) => `<div>${uri}</div>`).join("")}</span></div>` : ""}
      </div>
      <p class="note">Approving will redirect you to <strong>Google Sign-In</strong>. <span class="g">ChartPane uses your Google account to identify you.</span></p>
      <form method="post" action="${new URL(request.url).pathname}">
        <input type="hidden" name="state" value="${encodedState}">
        <input type="hidden" name="csrf_token" value="${csrfToken}">
        <div class="actions">
          <button type="button" class="btn btn-cancel" onclick="window.history.back()">Cancel</button>
          <button type="submit" class="btn btn-approve">Approve</button>
        </div>
      </form>
    </div>
  </div>
</body>
</html>`;

  return new Response(htmlContent, {
    headers: {
      "Content-Security-Policy": "frame-ancestors 'none'",
      "Content-Type": "text/html; charset=utf-8",
      "Set-Cookie": setCookie,
      "X-Frame-Options": "DENY",
    },
  });
}
