# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build          # Type-check (tsc --noEmit) + bundle UI into dist/mcp-app.html
npm start              # Watch-build UI + run MCP server (HTTP mode, port 3001)
npm run dev            # Watch-build UI + run MCP server + sandbox dev server (localhost:3456)
npm test               # Run all tests (vitest)
npm run test:watch     # Run tests in watch mode

# Run a single test file
npx vitest run tests/unit/config.test.ts

# Run tests matching a name pattern
npx vitest run -t "scatter"

# Run MCP server in stdio mode (for Claude Desktop)
npx tsx main.ts --stdio
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

- **`server.ts`** — MCP server: tool registration via `registerAppTool`/`registerAppResource`, validation. Returns validated `ChartInput` as `structuredContent`.
- **`main.ts`** — Entry point: HTTP mode by default (port 3001, `/` endpoint), or `--stdio` flag for Claude Desktop.
- **`src/mcp-app.ts`** — Browser-side UI: `App` from `@modelcontextprotocol/ext-apps`, `ontoolresult`/`ontoolinput`/`onhostcontextchanged` handlers, Chart.js rendering.
- **`shared/`** — Pure modules imported by both server and UI:
  - `types.ts` — Zod schemas (ChartInput, DashboardInput, RenderResult)
  - `validation.ts` — Schema parsing + business rules (scatter needs `{x,y}`, pie max 1 dataset, etc.)
  - `config.ts` — `buildChartConfig()` transforms ChartInput → Chart.js ChartConfiguration
  - `colors.ts` — 12-color palette; per-slice for pie/doughnut, per-dataset for others
  - `grid.ts` — `calculateColumns()` for dashboard layout

### Build Pipeline

`mcp-app.html` → Vite + `vite-plugin-singlefile` → `dist/mcp-app.html` (single bundled file with Chart.js + all CSS/JS inlined). The `INPUT` env var sets the Rollup entry in `vite.config.ts` (`rollupOptions.input: process.env.INPUT`). The server reads `dist/mcp-app.html` at runtime and serves it as the UI resource via `registerAppResource`.

**Note:** `INPUT=` is a Unix-only env var syntax. The `cross-env` devDependency exists but npm scripts don't use it, so builds won't work on Windows as-is.

### Sandbox Dev Server

`sandbox/dev-server.ts` runs on port 3456 with Vite middleware mode. `sandbox/sandbox.html` is the page served at `/sandbox` — it imports shared modules directly (TS), which Vite transforms on the fly. **Critical ordering:** API routes (`/api/*`, `/sandbox/fixture/*`) must be registered BEFORE `vite.middlewares`, but the HTML route (`/sandbox`) must be registered AFTER, to avoid html-proxy MIME type conflicts. `transformIndexHtml` path must include `.html` suffix.

## Testing

- **Unit tests** (`tests/unit/`) — colors, config, validation, grid logic
- **Integration tests** (`tests/integration/server.test.ts`) — MCP protocol using `InMemoryTransport.createLinkedPair()` from SDK
- **Fixtures** (`tests/fixtures/`) — 18 JSON configs covering all chart types and edge cases

## Key Conventions

- **Zod v4** — Use `.enum()` not `.Enum()`. No `.strict()` or `.passthrough()`.
- **Validation pattern** — `.safeParse()` for schema, then separate business rule function. Returns `{ success, data/error }`.
- **`area` chart type** — Not a real Chart.js type. `config.ts` maps it to `line` with `fill: true`.
- **Chart cleanup** — Always `chart.destroy()` before rendering new charts.
- **Color assignment** — Pie/doughnut get per-slice color arrays; all other types get one color per dataset.

## Package Versions

- `@modelcontextprotocol/ext-apps`: 1.0.1 / `@modelcontextprotocol/sdk`: 1.26.0
- `zod`: 4.x / `chart.js`: 4.5.1 / `express`: 5.x
- `vite`: 7.x / `vitest`: 4.x / `typescript`: 5.9.x
