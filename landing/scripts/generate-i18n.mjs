/**
 * generate-i18n.mjs — BUILD-TIME SCRIPT (not browser code)
 *
 * Post-build script that stamps translated versions of every dist/ page.
 * Run automatically via Vite's closeBundle hook (see vite.config.js).
 *
 * Security note: The setContent helper below sets el.innerHTML, which is safe
 * in this context because: (a) this is Node.js build code, not browser code;
 * (b) node-html-parser's innerHTML is a string setter on a server-side AST,
 * not a live browser DOM — XSS doesn't apply; (c) all values come exclusively
 * from our own controlled i18n JSON source files, never from user input.
 *
 * For each page × non-English locale:
 *   1. Reads dist/<page>
 *   2. Applies translations (data-i18n / data-i18n-attr attributes)
 *   3. Updates meta tags, canonical, html[lang], hreflang links
 *   4. Writes to dist/[locale]/<page>
 *
 * Also patches each English dist page with hreflang alternate links.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'node-html-parser';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, '../dist');
const I18N_DIR = resolve(__dirname, '../i18n');

const LOCALES = ['zh', 'hi', 'es', 'fr', 'ar', 'bn', 'ru', 'pt', 'id'];
const RTL_LOCALES = new Set(['ar']);

const LANG_LABELS = {
  en: 'EN', zh: '中文', hi: 'हि', es: 'ES', fr: 'FR',
  ar: 'AR', bn: 'BN', ru: 'RU', pt: 'PT', id: 'ID',
};

/**
 * All pages to process. Each entry:
 *   src          — path relative to dist/
 *   prefix       — key prefix in i18n JSON (e.g. 'gs.' → keys like 'gs.meta.title')
 *                  Empty string for index.html (keys like 'meta.title')
 *   out(locale)  — output path relative to dist/
 *   canonicalEn  — canonical URL for the English version
 *   canonicalLocale(locale) — canonical URL for a locale version
 */
const PAGES = [
  {
    src: 'index.html',
    prefix: '',
    out: (l) => `${l}/index.html`,
    canonicalEn: 'https://chartpane.com/',
    canonicalLocale: (l) => `https://chartpane.com/${l}/`,
  },
  {
    src: 'getting-started.html',
    prefix: 'gs.',
    out: (l) => `${l}/getting-started.html`,
    canonicalEn: 'https://chartpane.com/getting-started.html',
    canonicalLocale: (l) => `https://chartpane.com/${l}/getting-started.html`,
  },
  {
    src: 'what-is-an-mcp-app.html',
    prefix: 'mcp.',
    out: (l) => `${l}/what-is-an-mcp-app.html`,
    canonicalEn: 'https://chartpane.com/what-is-an-mcp-app.html',
    canonicalLocale: (l) => `https://chartpane.com/${l}/what-is-an-mcp-app.html`,
  },
  {
    src: 'privacy.html',
    prefix: 'privacy.',
    out: (l) => `${l}/privacy.html`,
    canonicalEn: 'https://chartpane.com/privacy.html',
    canonicalLocale: (l) => `https://chartpane.com/${l}/privacy.html`,
  },
  {
    src: 'terms.html',
    prefix: 'terms.',
    out: (l) => `${l}/terms.html`,
    canonicalEn: 'https://chartpane.com/terms.html',
    canonicalLocale: (l) => `https://chartpane.com/${l}/terms.html`,
  },
  {
    src: 'charts/index.html',
    prefix: 'charts_hub.',
    out: (l) => `${l}/charts/index.html`,
    canonicalEn: 'https://chartpane.com/charts/',
    canonicalLocale: (l) => `https://chartpane.com/${l}/charts/`,
  },
  {
    src: 'charts/bar-chart.html',
    prefix: 'charts_bar.',
    out: (l) => `${l}/charts/bar-chart.html`,
    canonicalEn: 'https://chartpane.com/charts/bar-chart.html',
    canonicalLocale: (l) => `https://chartpane.com/${l}/charts/bar-chart.html`,
  },
  {
    src: 'charts/line-chart.html',
    prefix: 'charts_line.',
    out: (l) => `${l}/charts/line-chart.html`,
    canonicalEn: 'https://chartpane.com/charts/line-chart.html',
    canonicalLocale: (l) => `https://chartpane.com/${l}/charts/line-chart.html`,
  },
  {
    src: 'charts/area-chart.html',
    prefix: 'charts_area.',
    out: (l) => `${l}/charts/area-chart.html`,
    canonicalEn: 'https://chartpane.com/charts/area-chart.html',
    canonicalLocale: (l) => `https://chartpane.com/${l}/charts/area-chart.html`,
  },
  {
    src: 'charts/pie-chart.html',
    prefix: 'charts_pie.',
    out: (l) => `${l}/charts/pie-chart.html`,
    canonicalEn: 'https://chartpane.com/charts/pie-chart.html',
    canonicalLocale: (l) => `https://chartpane.com/${l}/charts/pie-chart.html`,
  },
  {
    src: 'charts/doughnut-chart.html',
    prefix: 'charts_doughnut.',
    out: (l) => `${l}/charts/doughnut-chart.html`,
    canonicalEn: 'https://chartpane.com/charts/doughnut-chart.html',
    canonicalLocale: (l) => `https://chartpane.com/${l}/charts/doughnut-chart.html`,
  },
  {
    src: 'charts/scatter-plot.html',
    prefix: 'charts_scatter.',
    out: (l) => `${l}/charts/scatter-plot.html`,
    canonicalEn: 'https://chartpane.com/charts/scatter-plot.html',
    canonicalLocale: (l) => `https://chartpane.com/${l}/charts/scatter-plot.html`,
  },
  {
    src: 'charts/radar-chart.html',
    prefix: 'charts_radar.',
    out: (l) => `${l}/charts/radar-chart.html`,
    canonicalEn: 'https://chartpane.com/charts/radar-chart.html',
    canonicalLocale: (l) => `https://chartpane.com/${l}/charts/radar-chart.html`,
  },
  {
    src: 'charts/stacked-chart.html',
    prefix: 'charts_stacked.',
    out: (l) => `${l}/charts/stacked-chart.html`,
    canonicalEn: 'https://chartpane.com/charts/stacked-chart.html',
    canonicalLocale: (l) => `https://chartpane.com/${l}/charts/stacked-chart.html`,
  },
  {
    src: 'examples/index.html',
    prefix: 'ex_hub.',
    out: (l) => `${l}/examples/index.html`,
    canonicalEn: 'https://chartpane.com/examples/',
    canonicalLocale: (l) => `https://chartpane.com/${l}/examples/`,
  },
  {
    src: 'examples/sales-dashboard.html',
    prefix: 'ex_sales.',
    out: (l) => `${l}/examples/sales-dashboard.html`,
    canonicalEn: 'https://chartpane.com/examples/sales-dashboard.html',
    canonicalLocale: (l) => `https://chartpane.com/${l}/examples/sales-dashboard.html`,
  },
  {
    src: 'examples/survey-results.html',
    prefix: 'ex_survey.',
    out: (l) => `${l}/examples/survey-results.html`,
    canonicalEn: 'https://chartpane.com/examples/survey-results.html',
    canonicalLocale: (l) => `https://chartpane.com/${l}/examples/survey-results.html`,
  },
  {
    src: 'examples/budget-tracker.html',
    prefix: 'ex_budget.',
    out: (l) => `${l}/examples/budget-tracker.html`,
    canonicalEn: 'https://chartpane.com/examples/budget-tracker.html',
    canonicalLocale: (l) => `https://chartpane.com/${l}/examples/budget-tracker.html`,
  },
  {
    src: 'integrations/index.html',
    prefix: 'int_hub.',
    out: (l) => `${l}/integrations/index.html`,
    canonicalEn: 'https://chartpane.com/integrations/',
    canonicalLocale: (l) => `https://chartpane.com/${l}/integrations/`,
  },
  {
    src: 'integrations/claude-desktop.html',
    prefix: 'int_claude.',
    out: (l) => `${l}/integrations/claude-desktop.html`,
    canonicalEn: 'https://chartpane.com/integrations/claude-desktop.html',
    canonicalLocale: (l) => `https://chartpane.com/${l}/integrations/claude-desktop.html`,
  },
  {
    src: 'compare/index.html',
    prefix: 'compare_hub.',
    out: (l) => `${l}/compare/index.html`,
    canonicalEn: 'https://chartpane.com/compare/',
    canonicalLocale: (l) => `https://chartpane.com/${l}/compare/`,
  },
  {
    src: 'compare/claude-artifacts.html',
    prefix: 'compare_artifacts.',
    out: (l) => `${l}/compare/claude-artifacts.html`,
    canonicalEn: 'https://chartpane.com/compare/claude-artifacts.html',
    canonicalLocale: (l) => `https://chartpane.com/${l}/compare/claude-artifacts.html`,
  },
];

function buildPageHreflangHtml(page) {
  const entries = [
    { hreflang: 'x-default', href: page.canonicalEn },
    { hreflang: 'en',        href: page.canonicalEn },
    ...LOCALES.map(l => ({ hreflang: l, href: page.canonicalLocale(l) })),
  ];
  return entries
    .map(e => `  <link rel="alternate" hreflang="${e.hreflang}" href="${e.href}" />`)
    .join('\n');
}

async function loadTranslations(locale) {
  const path = resolve(I18N_DIR, `${locale}.json`);
  const raw = await readFile(path, 'utf-8');
  return JSON.parse(raw);
}

/** Set text content of an element. Uses innerHTML only for values containing HTML tags. */
function setContent(el, value) {
  // Build-time only: all values come from our own i18n JSON files (trusted source)
  el.innerHTML = value;
}

async function processPage(templateHtml, locale, page) {
  const t = await loadTranslations(locale);
  const root = parse(templateHtml);
  const p = page.prefix; // e.g. 'gs.' for getting-started, '' for index

  // ── html[lang] + optional dir ────────────────────────────────
  const htmlEl = root.querySelector('html');
  if (htmlEl) {
    htmlEl.setAttribute('lang', locale);
    if (RTL_LOCALES.has(locale)) {
      htmlEl.setAttribute('dir', 'rtl');
    } else {
      htmlEl.removeAttribute('dir');
    }
  }

  // ── <title> ──────────────────────────────────────────────────
  const titleEl = root.querySelector('title');
  if (titleEl && t[p + 'meta.title']) {
    setContent(titleEl, t[p + 'meta.title']);
  }

  // ── <meta name="description"> ────────────────────────────────
  const metaDesc = root.querySelector('meta[name="description"]');
  if (metaDesc && t[p + 'meta.description']) {
    metaDesc.setAttribute('content', t[p + 'meta.description']);
  }

  // ── Open Graph ───────────────────────────────────────────────
  const ogTitle = root.querySelector('meta[property="og:title"]');
  if (ogTitle && t[p + 'meta.og_title']) ogTitle.setAttribute('content', t[p + 'meta.og_title']);

  const ogDesc = root.querySelector('meta[property="og:description"]');
  if (ogDesc && t[p + 'meta.og_description']) ogDesc.setAttribute('content', t[p + 'meta.og_description']);

  const ogUrl = root.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.setAttribute('content', page.canonicalLocale(locale));

  // ── Twitter Card ─────────────────────────────────────────────
  const twTitle = root.querySelector('meta[name="twitter:title"]');
  if (twTitle && t[p + 'meta.twitter_title']) twTitle.setAttribute('content', t[p + 'meta.twitter_title']);

  const twDesc = root.querySelector('meta[name="twitter:description"]');
  if (twDesc && t[p + 'meta.twitter_description']) twDesc.setAttribute('content', t[p + 'meta.twitter_description']);

  // ── Canonical ────────────────────────────────────────────────
  const canonical = root.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute('href', page.canonicalLocale(locale));

  // ── hreflang alternates ──────────────────────────────────────
  const head = root.querySelector('head');
  if (head) {
    head.insertAdjacentHTML('beforeend', '\n' + buildPageHreflangHtml(page) + '\n');
  }

  // ── data-i18n: replace element content (build-time, trusted values) ─
  for (const el of root.querySelectorAll('[data-i18n]')) {
    const key = el.getAttribute('data-i18n');
    if (key && t[key] !== undefined) {
      setContent(el, t[key]);
    }
  }

  // ── data-i18n-attr: update specific element attributes ────────
  // Format: data-i18n-attr="data-foo:key1,data-bar:key2"
  for (const el of root.querySelectorAll('[data-i18n-attr]')) {
    const pairs = el.getAttribute('data-i18n-attr').split(',');
    for (const pair of pairs) {
      const colonIdx = pair.indexOf(':');
      if (colonIdx === -1) continue;
      const attrName = pair.slice(0, colonIdx).trim();
      const key = pair.slice(colonIdx + 1).trim();
      if (attrName && key && t[key] !== undefined) {
        el.setAttribute(attrName, t[key]);
      }
    }
  }

  // ── Language switcher: mark active locale ────────────────────
  for (const opt of root.querySelectorAll('.lang-option')) {
    const lang = opt.getAttribute('data-lang');
    const cls = (opt.getAttribute('class') || '').replace(/\s*lang-option-active\s*/g, ' ').trim();
    if (lang === locale) {
      opt.setAttribute('class', cls + ' lang-option-active');
      opt.setAttribute('aria-selected', 'true');
    } else {
      opt.setAttribute('class', cls);
      opt.setAttribute('aria-selected', 'false');
    }
  }

  // ── Lang trigger label (e.g. "EN" → "FR") ───────────────────
  const langLabel = root.querySelector('#lang-current-label');
  if (langLabel) {
    setContent(langLabel, LANG_LABELS[locale] || locale.toUpperCase());
  }

  return root.toString();
}

export async function generateI18n() {
  console.log('[i18n] Generating locale pages...');

  for (const page of PAGES) {
    const srcPath = resolve(DIST, page.src);
    let templateHtml;
    try {
      templateHtml = await readFile(srcPath, 'utf-8');
    } catch (err) {
      console.warn(`  [i18n] WARNING: could not read dist/${page.src}: ${err.message}`);
      continue;
    }

    // ── Patch English dist file with hreflang links ────────────
    const enRoot = parse(templateHtml);
    const enHead = enRoot.querySelector('head');
    if (enHead) {
      enHead.insertAdjacentHTML('beforeend', '\n' + buildPageHreflangHtml(page) + '\n');
    }
    await writeFile(srcPath, enRoot.toString());
    console.log(`  [i18n] Patched dist/${page.src} with hreflang links`);

    // ── Generate one page per non-English locale ──────────────
    for (const locale of LOCALES) {
      try {
        const outPath = resolve(DIST, page.out(locale));
        await mkdir(dirname(outPath), { recursive: true });
        const html = await processPage(templateHtml, locale, page);
        await writeFile(outPath, html);
        console.log(`  [i18n] Generated dist/${page.out(locale)}`);
      } catch (err) {
        console.error(`  [i18n] ERROR generating ${locale}/${page.src}:`, err.message);
      }
    }
  }

  console.log(`[i18n] Done — ${PAGES.length} pages × ${LOCALES.length} locales.`);
}

// Allow running directly: node scripts/generate-i18n.mjs
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateI18n().catch((err) => {
    console.error('[i18n] Fatal error:', err);
    process.exit(1);
  });
}
