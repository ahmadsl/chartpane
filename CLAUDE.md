# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build          # Type-check (tsc --noEmit) + bundle UI into dist/mcp-app.html
npm start              # wrangler dev + vite build --watch (port 8787)
npm run dev            # wrangler dev + sandbox dev server (localhost:3456)
npm run deploy         # Deploy to Cloudflare Workers
npm test               # Run all tests (vitest)
npm run test:watch     # Run tests in watch mode

# Run a single test file
npx vitest run tests/unit/config.test.ts

# Run tests matching a name pattern
npx vitest run -t "scatter"
```

## Architecture

MCP App that renders Chart.js charts inline in Claude's UI. Two tools: `render_chart` (single chart) and `render_dashboard` (multi-chart grid).

### Data Flow

```
Claude tool call → server.ts (validate, pass through ChartInput as structuredContent)
    → mcp-app.ts (ontoolresult) → buildChartConfig() → Chart.js renders to canvas
```

The server is intentionally thin — it validates input and returns the raw `ChartInput` as `structuredContent`. All Chart.js config transformation happens browser-side in `shared/config.ts`.

### Module Layout

- **`server.ts`** — MCP server factory: `createServer(options: ServerOptions)` with `htmlLoader` and `onLog` params. Platform-agnostic (no `fs`/`path`/`url`). Tool registration via `registerAppTool`/`registerAppResource`.
- **`worker.ts`** — Cloudflare Workers entry point: `createMcpHandler` from `agents/mcp` with `apiRoute: "/mcp"`, `ASSETS` binding for static HTML, `DB` binding for D1 request logging, and `normalizeResourceParam()` workaround for OAuthProvider audience bug.
- **`auth-handler.ts`** — Hono app with `/authorize` (GET/POST) and `/callback` routes for Google OAuth via `@cloudflare/workers-oauth-provider`. Uses `workers-oauth-utils.ts` for CSRF, state management, consent dialog.
- **`workers-oauth-utils.ts`** — OAuth utilities: CSRF protection, KV-backed state, cookie signing, consent dialog HTML. Workers-only (uses `crypto.subtle.timingSafeEqual`).
- **`src/mcp-app.ts`** — Browser-side UI: `App` from `@modelcontextprotocol/ext-apps`, `ontoolresult`/`ontoolinput`/`onhostcontextchanged` handlers, Chart.js rendering.
- **`shared/`** — Pure modules imported by both server and UI:
  - `types.ts` — Zod schemas (ChartInput, DashboardInput, RenderResult)
  - `validation.ts` — Schema parsing + business rules (scatter needs `{x,y}`, pie max 1 dataset, etc.)
  - `config.ts` — `buildChartConfig()` transforms ChartInput → Chart.js ChartConfiguration
  - `colors.ts` — 12-color palette; per-slice for pie/doughnut, per-dataset for others
  - `grid.ts` — `calculateColumns()` for dashboard layout

### Build Pipeline

`mcp-app.html` → Vite + `vite-plugin-singlefile` → `dist/mcp-app.html` (single bundled file with Chart.js + all CSS/JS inlined). The `INPUT` env var sets the Rollup entry in `vite.config.ts` (`rollupOptions.input: process.env.INPUT`). The Worker reads `dist/mcp-app.html` via `env.ASSETS.fetch()` (static assets binding) and passes it through `htmlLoader` to the server.

**Note:** `INPUT=` is a Unix-only env var syntax. The `cross-env` devDependency exists but npm scripts don't use it, so builds won't work on Windows as-is.

### Sandbox Dev Server

`sandbox/dev-server.ts` runs on port 3456 with Hono + `@hono/node-server` + Vite middleware mode. `sandbox/sandbox.html` is the page served at `/sandbox` — it imports shared modules directly (TS), which Vite transforms on the fly. **Critical ordering:** API routes (`/api/*`, `/sandbox/fixture/*`) must be registered BEFORE `vite.middlewares`, but the HTML route (`/sandbox`) must be registered AFTER, to avoid html-proxy MIME type conflicts. `transformIndexHtml` path must include `.html` suffix.

## Testing

- **Unit tests** (`tests/unit/`) — colors, config, validation, grid, server-userid logic
- **Integration tests** (`tests/integration/server.test.ts`) — MCP protocol using `InMemoryTransport.createLinkedPair()` from SDK (includes userId tests)
- **Fixtures** (`tests/fixtures/`) — 19 JSON configs covering all chart types and edge cases
- **75 tests across 6 test files** as of Feb 2026

## Key Conventions

- **Workers-only APIs** — `crypto.subtle.timingSafeEqual` exists at runtime but not in standard TS types. Use `/// <reference types="@cloudflare/workers-types" />` or a typed cast in files that need it.
- **Zod v4** — Use `.enum()` not `.Enum()`. No `.strict()` or `.passthrough()`.
- **Validation pattern** — `.safeParse()` for schema, then separate business rule function. Returns `{ success, data/error }`.
- **`area` chart type** — Not a real Chart.js type. `config.ts` maps it to `line` with `fill: true`.
- **Chart cleanup** — Always `chart.destroy()` before rendering new charts.
- **Color assignment** — Pie/doughnut/polarArea get per-slice color arrays; all other types get one color per dataset.

## Package Versions

- `@modelcontextprotocol/ext-apps`: 1.0.1 / `@modelcontextprotocol/sdk`: 1.26.0 / `@cloudflare/workers-oauth-provider`: 0.2.x
- `zod`: 4.x / `chart.js`: 4.5.1 / `agents`: 0.3.x / `hono`: 4.x (dev only, sandbox + auth-handler)
- `vite`: 7.x / `vitest`: 4.x / `typescript`: 5.9.x

## Deployment (Cloudflare Workers)

- **D1 database** — `DB` binding in `wrangler.jsonc`, database `chartpane-db`. `onLog` in `worker.ts` writes to `requests` table via `ctx.waitUntil()`.
- **D1 migrations** — `wrangler d1 migrations create` requires the D1 binding in `wrangler.jsonc` first (will error otherwise).
- **Local D1 state** — stored in `.wrangler/state/v3/d1/`. Query with `npx wrangler d1 execute chartpane-db --local --command "SELECT * FROM requests"`.
- **`createMcpHandler` default route is `/mcp`** — matches `apiRoute: "/mcp"` in OAuthProvider config. Cannot use `"/"` when auth is enabled (prefix matching conflict).
- **`agents` pins `@modelcontextprotocol/sdk` 1.25.2** — causes duplicate McpServer types. `worker-types.d.ts` bridges the mismatch with a widened declaration.
- **Workers types** — `@cloudflare/workers-types` via triple-slash in `worker.ts` only. No `types` field in tsconfig (would break Node type auto-discovery for sandbox/tests).
- **Authentication** — Optional Google OAuth via `@cloudflare/workers-oauth-provider`. Enabled when all three secrets are set: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `COOKIE_ENCRYPTION_KEY`. Without them, Worker falls back to unauthenticated mode. `OAuthProvider` is lazy-initialized (not at module level). See `docs/adr/004-authentication.md`.
- **OAUTH_KV** — KV namespace binding required for auth (tokens, clients, grants). Local state in `.wrangler/state/v3/kv/`.
- **Custom domain** — `mcp.chartpane.com` routes to this Worker. Configured via Cloudflare dashboard; `custom_domains` in `wrangler.jsonc` is documentation-only (wrangler doesn't use it).
- **Relogin** — `./scripts/relogin.sh` clears `~/.mcp-auth/mcp-remote-*/` to force re-authentication. Restart Claude Desktop after running.
- **OAuthProvider audience bug** — `@cloudflare/workers-oauth-provider` validates token audience against `protocol://host` (no trailing slash/path), but its own metadata includes the apiRoute path, and `mcp-remote` normalizes URLs via `new URL().href` (adds trailing slash). `normalizeResourceParam()` in `worker.ts` fixes both by stripping to `.origin`. Our well-known handler overrides the library's metadata for the same reason.
- **`apiRoute` cannot be `"/"`** — OAuthProvider uses prefix matching, so `"/"` catches all paths including `/authorize`, `/token`, `/register`. Must use a sub-path like `"/mcp"`.
- **Request body in Workers** — Use `req.clone().text()` when reading POST body before passing `req` to another handler; body can only be consumed once.
- **Debug local KV** — Blobs in `.wrangler/state/v3/kv/{namespace-id}/blobs/`, index in `miniflare-KVNamespaceObject/*.sqlite` (`SELECT key, blob_id FROM _mf_entries`).
- **Claude Desktop custom connectors** — Now supports native remote MCP via "Add custom connector" UI (no `mcp-remote` needed for production). All MCP clients use URLs exactly as given — no auto-appending of `/mcp` or `/.well-known` discovery.
- See `docs/adr/002-deployment-architecture.md` and `docs/adr/003-mcp-http-handler.md`

## MCP Registry (`server.json`)

- **Published** to `registry.modelcontextprotocol.io` as `io.github.ahmadsl/chartpane` (remote-only, no npm package).
- **`server.json`** at repo root — describes the server for registry discovery. `version` is stamped from git tag at publish time.
- **`$schema` URL must use `https://static.modelcontextprotocol.io/schemas/YYYY-MM-DD/server.schema.json`** — raw GitHub URLs are rejected by `mcp-publisher`.
- **CI workflow** (`.github/workflows/publish-mcp.yml`) — triggers on `v*` tags, uses GitHub OIDC auth (no secrets needed), publishes via `mcp-publisher`.
- **To publish a new version:** `git tag v1.x.x && git push origin v1.x.x`
- **Validate locally:** `npx ajv-cli validate -s <schema-url> -d server.json --spec=draft7 --strict=false`

## Landing Page (`landing/`)

Self-contained Vite project (own `package.json`) for `chartpane.com` on Cloudflare Pages. Has its own `CLAUDE.md` with full details. Key thing: palette + `buildChartConfig()` are duplicated from `shared/` — update both if either changes.
