/**
 * generate-i18n.mjs — BUILD-TIME SCRIPT (not browser code)
 *
 * Post-build script that stamps translated versions of dist/index.html.
 * Run automatically via Vite's closeBundle hook (see vite.config.js).
 *
 * Security note: innerHTML usage here is safe — this is Node.js build code
 * that only processes our own controlled i18n JSON files, not user input.
 * node-html-parser's .innerHTML is a string setter on a server-side DOM object,
 * not a browser DOM. No XSS risk applies to build-time HTML generation.
 *
 * For each non-English locale:
 *   1. Reads dist/index.html
 *   2. Applies translations (data-i18n / data-i18n-attr attributes)
 *   3. Updates meta tags, canonical, html[lang], hreflang links
 *   4. Writes to dist/[locale]/index.html
 *
 * Also patches dist/index.html (English) with hreflang alternate links.
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

const ALL_LOCALE_HREFS = [
  { hreflang: 'x-default', href: 'https://chartpane.com/' },
  { hreflang: 'en',        href: 'https://chartpane.com/' },
  { hreflang: 'zh',        href: 'https://chartpane.com/zh/' },
  { hreflang: 'hi',        href: 'https://chartpane.com/hi/' },
  { hreflang: 'es',        href: 'https://chartpane.com/es/' },
  { hreflang: 'fr',        href: 'https://chartpane.com/fr/' },
  { hreflang: 'ar',        href: 'https://chartpane.com/ar/' },
  { hreflang: 'bn',        href: 'https://chartpane.com/bn/' },
  { hreflang: 'ru',        href: 'https://chartpane.com/ru/' },
  { hreflang: 'pt',        href: 'https://chartpane.com/pt/' },
  { hreflang: 'id',        href: 'https://chartpane.com/id/' },
];

function buildHreflangHtml() {
  return ALL_LOCALE_HREFS
    .map(l => `  <link rel="alternate" hreflang="${l.hreflang}" href="${l.href}" />`)
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

async function processLocale(templateHtml, locale) {
  const t = await loadTranslations(locale);
  const root = parse(templateHtml);

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
  if (titleEl && t['meta.title']) {
    setContent(titleEl, t['meta.title']);
  }

  // ── <meta name="description"> ────────────────────────────────
  const metaDesc = root.querySelector('meta[name="description"]');
  if (metaDesc && t['meta.description']) {
    metaDesc.setAttribute('content', t['meta.description']);
  }

  // ── Open Graph ───────────────────────────────────────────────
  const ogTitle = root.querySelector('meta[property="og:title"]');
  if (ogTitle && t['meta.og_title']) ogTitle.setAttribute('content', t['meta.og_title']);

  const ogDesc = root.querySelector('meta[property="og:description"]');
  if (ogDesc && t['meta.og_description']) ogDesc.setAttribute('content', t['meta.og_description']);

  const ogUrl = root.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.setAttribute('content', `https://chartpane.com/${locale}/`);

  // ── Twitter Card ─────────────────────────────────────────────
  const twTitle = root.querySelector('meta[name="twitter:title"]');
  if (twTitle && t['meta.twitter_title']) twTitle.setAttribute('content', t['meta.twitter_title']);

  const twDesc = root.querySelector('meta[name="twitter:description"]');
  if (twDesc && t['meta.twitter_description']) twDesc.setAttribute('content', t['meta.twitter_description']);

  // ── Canonical ────────────────────────────────────────────────
  const canonical = root.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute('href', `https://chartpane.com/${locale}/`);

  // ── hreflang alternates ──────────────────────────────────────
  const head = root.querySelector('head');
  if (head) {
    head.insertAdjacentHTML('beforeend', '\n' + buildHreflangHtml() + '\n');
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

  const templateHtml = await readFile(resolve(DIST, 'index.html'), 'utf-8');

  // ── Patch dist/index.html (English) with hreflang ─────────────
  const enRoot = parse(templateHtml);
  const enHead = enRoot.querySelector('head');
  if (enHead) {
    enHead.insertAdjacentHTML('beforeend', '\n' + buildHreflangHtml() + '\n');
  }
  await writeFile(resolve(DIST, 'index.html'), enRoot.toString());
  console.log('  [i18n] Patched dist/index.html with hreflang links');

  // ── Generate one page per non-English locale ─────────────────
  for (const locale of LOCALES) {
    try {
      const outDir = resolve(DIST, locale);
      await mkdir(outDir, { recursive: true });
      const html = await processLocale(templateHtml, locale);
      await writeFile(resolve(outDir, 'index.html'), html);
      console.log(`  [i18n] Generated dist/${locale}/index.html`);
    } catch (err) {
      console.error(`  [i18n] ERROR generating ${locale}:`, err.message);
    }
  }

  console.log(`[i18n] Done — ${LOCALES.length} locale pages generated.`);
}

// Allow running directly: node scripts/generate-i18n.mjs
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateI18n().catch((err) => {
    console.error('[i18n] Fatal error:', err);
    process.exit(1);
  });
}
