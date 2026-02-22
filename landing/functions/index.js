/**
 * Cloudflare Pages Function: functions/index.js
 * Handles GET / — auto-detects preferred locale and redirects first-time visitors.
 *
 * Logic:
 *  1. Check `lang` cookie (user's explicit choice, including "en" to stay English)
 *  2. Parse Accept-Language header → find best-matching supported locale
 *  3. Redirect to /[locale]/ if non-English match found, otherwise serve English
 */

const NON_EN_LOCALES = ['zh', 'hi', 'es', 'fr', 'ar', 'bn', 'ru', 'pt', 'id'];
const ALL_LOCALES = ['en', ...NON_EN_LOCALES];

/**
 * Parse a Cookie header string into a key→value map.
 * Handles missing/malformed cookies gracefully.
 */
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if (key) cookies[key] = val;
  }
  return cookies;
}

/**
 * Find the best matching locale from an Accept-Language header string.
 * Returns null if no supported non-English locale matches.
 *
 * Example input: "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7"
 */
function bestLocaleMatch(acceptLang, locales) {
  if (!acceptLang) return null;

  const parts = acceptLang.split(',').map((part) => {
    const [tag, qPart] = part.trim().split(';');
    const lang = (tag || '').trim().split('-')[0].toLowerCase();
    const quality = qPart ? parseFloat(qPart.replace('q=', '')) || 0 : 1;
    return { lang, quality };
  });

  // Sort by quality descending
  parts.sort((a, b) => b.quality - a.quality);

  for (const { lang } of parts) {
    if (locales.includes(lang)) return lang;
  }
  return null;
}

export async function onRequest(ctx) {
  const { request, next } = ctx;

  // Only intercept GET requests to /
  if (request.method !== 'GET') return next();

  const cookies = parseCookies(request.headers.get('Cookie'));

  // 1. Honour explicit lang cookie (including 'en' which means "stay on English")
  if (cookies.lang && ALL_LOCALES.includes(cookies.lang)) {
    if (cookies.lang === 'en') {
      return next(); // User explicitly chose English
    }
    return Response.redirect(new URL(`/${cookies.lang}/`, request.url).href, 302);
  }

  // 2. Auto-detect from Accept-Language
  const acceptLang = request.headers.get('Accept-Language') || '';
  const match = bestLocaleMatch(acceptLang, NON_EN_LOCALES);
  if (match) {
    return Response.redirect(new URL(`/${match}/`, request.url).href, 302);
  }

  // 3. Default: serve English
  return next();
}
