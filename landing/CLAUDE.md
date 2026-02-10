# CLAUDE.md

Self-contained landing page for ChartPane. Deployed to Cloudflare Pages at `chartpane.com`.

## Commands

```bash
npm run dev            # Vite dev server (port 5173)
npm run build          # Build to dist/
npm run preview        # Preview production build
npm run deploy         # Build + wrangler pages deploy
```

## Stack

- Plain HTML + CSS + JS (no framework)
- Vite 6.x + Tailwind CSS v4 (`@tailwindcss/vite`)
- Chart.js 4.x for live chart demos

## File Layout

- `index.html` — 9 sections (Hero, Comparison, How It Works, Real Examples, Chart Gallery, Dashboard Demo, Get Started, FAQ, Footer)
- `src/style.css` — Tailwind v4 entry, Geist font-face, CSS custom properties for light/dark
- `src/main.js` — Chart.js init, inline palette + `buildChartConfig()`, chart fixtures, theme sync, copy button, scroll animations (IntersectionObserver)
- `public/fonts/` — Geist Sans + Geist Mono variable fonts (from `npm pack geist`)
- `public/favicon.svg` — Bar chart icon
- `public/og-image.png` — OG/Twitter card image (1200x630)
- `og-template.html` — Dev-only HTML template for generating the OG image (open at 1200x630, screenshot)

## Key Conventions

- **No imports from parent `shared/`** — the 12-color palette and `buildChartConfig()` are duplicated inline in `main.js`. If `shared/colors.ts` or `shared/config.ts` change, update the landing copy manually.
- **Tailwind v4 `@source`** — explicit paths only, no recursive globs (`@source "../index.html"`, `@source "./main.js"`)
- **Light/dark theme** — `prefers-color-scheme` media query with CSS custom properties. Charts destroy + re-render on theme change.
- **Geist fonts** — sourced via `npm pack geist` (GitHub release zips are unreliable). Variable font files: `Geist-Variable.woff2`, `GeistMono-Variable.woff2`.

## Social / OG Tags

- `og:image` and `twitter:image` point to `https://chartpane.com/og-image.png`
- To update: edit `og-template.html`, run dev server, open at 1200x630 in Chrome, screenshot to `public/og-image.png`
- X (Twitter) caches cards for ~7 days. No card validator preview anymore — check via Tweet Composer draft. Add `?v=N` param to hint re-crawl.

## Deployment

- Cloudflare Pages project: `chartpane-landing`, production branch: `main`
- Domain: `chartpane.com` (separate from MCP server at `mcp.chartpane.com`)
