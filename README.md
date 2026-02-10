# ChartPane

MCP App that renders Chart.js charts inline in Claude's UI.

## Tools

- **`render_chart`** — Render a single chart (bar, line, pie, scatter, etc.)
- **`render_dashboard`** — Render a multi-chart grid layout

## Development

```bash
npm install
npm run dev      # Local dev server (port 8787 + sandbox on 3456)
npm test         # Run tests
npm run build    # Type-check + bundle UI
npm run deploy   # Deploy to Cloudflare Workers
```

## Architecture

Claude tool calls flow through a thin MCP server that validates input and returns `structuredContent`. The browser-side UI transforms input into Chart.js configs and renders to canvas. All shared logic (types, validation, colors, config) lives in `shared/`.

## License

Private
