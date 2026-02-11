# ChartPane

MCP App that renders interactive Chart.js charts inline in Claude's UI. Works with Claude Desktop, ChatGPT, VS Code, Cursor, and any client that supports MCP Apps.

**Live instance:** [mcp.chartpane.com](https://mcp.chartpane.com/mcp)

## Tools

- **`render_chart`** — Render a single chart (bar, line, area, pie, doughnut, scatter, radar, stacked)
- **`render_dashboard`** — Render a multi-chart grid layout

## Quick Start

Add ChartPane to Claude Desktop via **Settings > Connectors > Add custom connector**:

```
https://mcp.chartpane.com/mcp
```

Or use `mcp-remote` (requires Node.js):

```json
{
  "mcpServers": {
    "chartpane": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.chartpane.com/mcp"]
    }
  }
}
```

## Self-Hosting

ChartPane runs on Cloudflare Workers.

```bash
npm install
cp .dev.vars.example .dev.vars    # Configure secrets (optional)
npm run dev                        # Local dev server (port 8787 + sandbox on 3456)
npm run deploy                     # Deploy to Cloudflare Workers
```

You'll need to create your own KV namespace and D1 database — see comments in `wrangler.jsonc`.

## Development

```bash
npm run dev        # wrangler dev + sandbox dev server (localhost:3456)
npm run build      # Type-check (tsc --noEmit) + bundle UI
npm test           # Run all tests (vitest)
npm run test:watch # Watch mode
```

## Architecture

Claude tool calls flow through a thin MCP server that validates input and returns `structuredContent`. The browser-side UI transforms input into Chart.js configs and renders to canvas. All shared logic (types, validation, colors, config) lives in `shared/`.

```
Claude tool call → server.ts (validate) → structuredContent
    → mcp-app.ts (browser) → buildChartConfig() → Chart.js canvas
```

## License

MIT
