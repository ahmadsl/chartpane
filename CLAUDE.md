# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build          # Type-check (tsc --noEmit) + bundle UI into dist/mcp-app.html
npm start              # Watch-build UI + run MCP server (stdio mode)
npm run dev            # Watch-build UI + run MCP server + sandbox dev server (localhost:3456)
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
Claude tool call → server.ts (validate + build Chart.js config) → structuredContent
    → mcp-app.ts (ontoolresult handler) → Chart.js renders to canvas in iframe
```

### Module Layout

- **`server.ts`** — MCP server: tool registration via `registerAppTool`/`registerAppResource`, validation, config building. Returns `structuredContent` with chart config.
- **`main.ts`** — Entry point: stdio mode (Claude Desktop) or HTTP mode (port 3001, `/mcp` endpoint).
- **`src/mcp-app.ts`** — Browser-side UI: `App` from `@modelcontextprotocol/ext-apps`, `ontoolresult`/`ontoolinput`/`onhostcontextchanged` handlers, Chart.js rendering.
- **`shared/`** — Pure modules imported by both server and UI:
  - `types.ts` — Zod schemas (ChartInput, DashboardInput, RenderResult)
  - `validation.ts` — Schema parsing + business rules (scatter needs `{x,y}`, pie max 1 dataset, etc.)
  - `config.ts` — `buildChartConfig()` transforms ChartInput → Chart.js ChartConfiguration
  - `colors.ts` — 12-color palette; per-slice for pie/doughnut, per-dataset for others
  - `grid.ts` — `calculateColumns()` for dashboard layout

### Build Pipeline

`mcp-app.html` → Vite + `vite-plugin-singlefile` → `dist/mcp-app.html` (single bundled file). The `INPUT` env var tells Vite which HTML file to use as Rollup entry. The server reads `dist/mcp-app.html` at runtime and serves it as the UI resource.

### Sandbox Dev Server

`sandbox/dev-server.ts` runs on port 3456 with Vite middleware mode. **Critical ordering:** API routes (`/api/*`, `/sandbox/fixture/*`) must be registered BEFORE `vite.middlewares`, but the HTML route (`/sandbox`) must be registered AFTER, to avoid html-proxy MIME type conflicts. `transformIndexHtml` path must include `.html` suffix.

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
