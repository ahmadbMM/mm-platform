import { LOCALES, LOCALE_CODES } from "../i18n/locales";

// Pages kept at Cloudflare's edge for a minute (worker.js wraps the site's Worker with this).
// Every page used to be rendered afresh for every visitor - 0.3 to 0.9 s before the first byte.
// A copy is kept only when it cannot differ between two visitors:
//   - a plain GET of a site page, with no query but ?lang;
//   - in a language the request names (?lang=, or the NEXT_LOCALE cookie a first visit sets), so
//     a visitor's language is never guessed - a first visit with neither is rendered as before;
//   - not signed in and not a staff preview (their cookies bring their own pages: the Club card,
//     the preview bar), and never the account page, the API, media, the NFC bike pages (a bike's
//     status is live: /bikes/42, and its old address /b/42) or the forms;
//   - for this deploy only: a new deploy's pages name new build files, so the key carries its id.
// Staff edits already show within a minute (lib/site.ts reads them once a minute), so a minute's
// copy changes nothing staff see. PAGE_CACHE = "off" (a Worker variable) turns it off at once.
//
// After the minute (the user, 2026-11-09: the first visit after a quiet spell took up to 2.5 s): the copy still answers,
// at once, while a fresh one is drawn behind it for the next visitor - for up to six hours, and never past midnight in
// Jeddah, so a page that says "tonight" or names the coming ride is never a day old. A quiet spell used to mean the copy
// was gone and the Worker cold, so that visitor waited for the whole page to be drawn (the database in Frankfurt, the
// server's code readied on first use). A staff edit shows from the second visit after it, or within the minute on a
// busy page; staff previewing see their pages drawn every time, as before.
//
// A first visit (no ?lang, no language cookie) is answered from the copy too, in the language the site draws for that
// browser's languages - learned from the site itself: each first visit drawn notes which language next-intl chose for
// its Accept-Language, and the next visit with the same header is answered in that one. A header never seen yet is
// drawn as before, so a visitor's language is never guessed.

export const PAGE_TTL = 60;
export const PAGE_STALE = 6 * 60 * 60;
const STORED = "x-mm-stored";
const JEDDAH = 3 * 60 * 60 * 1000; // UTC+3 all year
const jeddahDay = (ms: number) => Math.floor((ms + JEDDAH) / 86_400_000);
const HTML_LANG = new Map<string, string>(LOCALES.map((l) => [l.html.toLowerCase(), l.code]));
const LANGS = new Set<string>(LOCALE_CODES);
// Payment pages (/pay/<id>) and the store's cart, checkout, order and tracking pages change with every payment: never kept (2026-11-10).
const SKIP = /^\/(?:api|_next|media|b|petromin|community|account|preview|login|en|ar|bikes\/\d{1,6}|pay|store\/(?:cart|checkout|order|track))(?:\/|$)/;
const PRIVATE = ["mm_acct", "mm_preview"];
const LANG_COOKIE = "NEXT_LOCALE";
// Tracking parameters (utm_*, fbclid...) change nothing on the page: a link from Instagram or a
// newsletter is the same page, so they neither stop the copy being used nor give it a key of its own.
const TRACKING = /^(?:utm_[a-z]+|fbclid|gclid|igshid|mc_cid|mc_eid)$/i;

type Cache = { match(k: string): Promise<Response | undefined>; put(k: string, r: Response): Promise<void>; delete(k: string): Promise<boolean> };
type Ctx = { waitUntil(p: Promise<unknown>): void };
type Env = { PAGE_CACHE?: string; CF_VERSION_METADATA?: { id?: string } };
type Handler = { fetch(req: Request, env: never, ctx: never): Promise<Response> };

/** One cookie's value from a Cookie header, or null. */
export function cookieOf(header: string | null, name: string): string | null {
  for (const part of (header || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) {
      const raw = part.slice(i + 1).trim();
      // A malformed value (a lone "%" from a hand-edited or truncated cookie) threw here, outside
      // servePage's try, and that browser got a 500 on every page; it is read as written instead.
      try { return decodeURIComponent(raw); } catch { return raw; }
    }
  }
  return null;
}

/** The copy a request may be answered from, or null when it must be rendered. */
export function pageCacheKey(req: Request, version: string): string | null {
  if (req.method !== "GET") return null;
  const url = new URL(req.url);
  if (SKIP.test(url.pathname) || /\.[a-z0-9]+$/i.test(url.pathname)) return null;
  for (const k of url.searchParams.keys()) if (k !== "lang" && !TRACKING.test(k)) return null;
  const cookie = req.headers.get("cookie");
  if (PRIVATE.some((n) => cookieOf(cookie, n) !== null)) return null;
  const asked = url.searchParams.get("lang");
  if (asked !== null && !LANGS.has(asked)) return null;
  const saved = cookieOf(cookie, LANG_COOKIE);
  const lang = asked ?? (saved && LANGS.has(saved) ? saved : null);
  if (!lang) return null;
  return `https://page-cache.micromobility.sa${url.pathname}?lang=${lang}&v=${encodeURIComponent(version)}`;
}

/** Where a first visit (no ?lang, no language cookie, nothing private) learns its language: the copy of what the site
 *  drew for the same Accept-Language, or null when the request is not a first visit to a page that may be kept. */
export function firstVisitKey(req: Request, version: string): string | null {
  if (req.method !== "GET") return null;
  const url = new URL(req.url);
  if (SKIP.test(url.pathname) || /\.[a-z0-9]+$/i.test(url.pathname)) return null;
  for (const k of url.searchParams.keys()) if (!TRACKING.test(k)) return null;
  const cookie = req.headers.get("cookie");
  if (PRIVATE.some((n) => cookieOf(cookie, n) !== null) || cookieOf(cookie, LANG_COOKIE) !== null) return null;
  const al = (req.headers.get("accept-language") || "").trim().toLowerCase().slice(0, 200);
  return `https://page-cache.micromobility.sa/__first-lang?al=${encodeURIComponent(al)}&v=${encodeURIComponent(version)}`;
}

/** The language a drawn page is in (<html lang="...">), as a site language code, or null. */
export function pageLang(htmlText: string): string | null {
  const m = htmlText.slice(0, 4000).match(/<html\b[^>]*\blang="([^"]+)"/i);
  return (m && HTML_LANG.get(m[1].toLowerCase())) || null;
}

/** Set by the proxy on a page drawn without the site's state (the database unreachable and no copy
 *  of it anywhere yet): such a page reads as Coming Soon, and must not be kept for everyone. */
export const NO_PAGE_CACHE = "x-mm-no-page-cache";

/** What a browser is told about a page anyone may see: ask again every time (no-cache), but keep it
 *  for the Back button. "no-store" - Next's default for a page drawn on request - kept every page out of
 *  the browser's back/forward cache, so Back drew it again from the network. Signed-in pages (the
 *  account, a staff preview) never come through here and keep no-store. */
export const BROWSER_CACHE = "private, no-cache, max-age=0, must-revalidate";

const storable = (r: Response) => r.status === 200 && (r.headers.get("content-type") || "").startsWith("text/html") && !r.headers.has(NO_PAGE_CACHE);
/** The page is no longer there: a page staff switched off or Coming Soon turned on (the proxy's 307 to Home), a journal
 *  article hidden or deleted (404). Not a database blip: an error (5xx) or a page drawn without the site's state
 *  (NO_PAGE_CACHE) leaves the copy as it is. */
const gone = (r: Response) => !r.headers.has(NO_PAGE_CACHE) && ((r.status >= 300 && r.status < 400) || r.status === 404 || r.status === 410);

function toStore(r: Response, now: number, body: BodyInit | null = r.body): Response {
  const h = new Headers(r.headers);
  h.delete("set-cookie");
  h.set("cache-control", `public, max-age=${PAGE_STALE}`);
  h.set(STORED, String(now));
  return new Response(body, { status: r.status, headers: h });
}

function fromStore(r: Response, req: Request, state: "hit" | "stale"): Response {
  const h = new Headers(r.headers);
  h.delete(STORED);
  h.set("cache-control", BROWSER_CACHE); // browsers ask again; the edge answers
  h.set("x-mm-page-cache", state);
  // ?lang= also makes that language the visitor's (proxy.ts sets the cookie on a rendered page).
  const asked = new URL(req.url).searchParams.get("lang");
  if (asked && LANGS.has(asked)) h.append("set-cookie", `${LANG_COOKIE}=${asked}; Path=/; Max-Age=31536000; SameSite=lax`);
  return new Response(r.body, { status: r.status, headers: h });
}

// The copies being drawn again behind a stale answer, in this Worker: one at a time each.
const refreshing = new Set<string>();

const withLang = (u: string, lang: string) => new Request(u + (u.includes("?") ? "&" : "?") + "lang=" + lang);

/** Answers a request from the edge's copy when it may, else renders it (and keeps a copy). */
export async function servePage(req: Request, env: Env, ctx: Ctx, handler: Handler, cache: Cache | null = edgeCache(), now: number = Date.now()): Promise<Response> {
  if (env.PAGE_CACHE === "off" || !cache) return handler.fetch(req, env as never, ctx as never);
  const version = env.CF_VERSION_METADATA?.id || "local";
  let key = pageCacheKey(req, version);
  const first = key ? null : firstVisitKey(req, version);
  if (!key && !first) return handler.fetch(req, env as never, ctx as never);
  try {
    if (first) {
      const learnt = await cache.match(first);
      const lang = learnt ? (await learnt.text()).trim() : "";
      if (LANGS.has(lang)) key = pageCacheKey(withLang(req.url, lang), version);
    }
    const hit = key ? await cache.match(key) : undefined;
    if (hit) {
      const stored = Number(hit.headers.get(STORED)) || 0;
      if (now - stored <= PAGE_TTL * 1000) return fromStore(hit, req, "hit");
      if (now - stored <= PAGE_STALE * 1000 && jeddahDay(stored) === jeddahDay(now)) {
        const k = key as string;
        if (!refreshing.has(k)) {
          refreshing.add(k);
          ctx.waitUntil((async () => {
            try {
              const res = await handler.fetch(new Request(req), env as never, ctx as never);
              if (storable(res)) await cache.put(k, toStore(res, Date.now()));
              // a page taken down goes from the edge too: kept, the old page was answered for the rest of the six hours
              else if (gone(res)) await cache.delete(k);
            } catch { /* the next visitor draws it */ } finally { refreshing.delete(k); }
          })());
        }
        return fromStore(hit, req, "stale");
      }
    }
  } catch { /* the edge's copy is a convenience: render */ }
  const res = await handler.fetch(req, env as never, ctx as never);
  if (!storable(res)) return res;
  if (key) {
    ctx.waitUntil(cache.put(key, toStore(res.clone(), now)).catch(() => {}));
  } else if (first) {
    // A first visit whose Accept-Language is new here: the page is kept under the language it turns out to be in (read
    // from the page itself), and that language noted for the header, so the two always agree.
    const copy = res.clone();
    ctx.waitUntil((async () => {
      const text = await copy.text();
      const lang = pageLang(text);
      const k = lang ? pageCacheKey(withLang(req.url, lang), version) : null;
      if (!lang || !k) return;
      await cache.put(first, new Response(lang, { headers: { "content-type": "text/plain", "cache-control": `public, max-age=${PAGE_STALE}` } }));
      await cache.put(k, toStore(copy, now, text));
    })().catch(() => {}));
  }
  const h = new Headers(res.headers);
  h.set("cache-control", BROWSER_CACHE);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

const SITE = "https://micromobility.sa";

/** The canonical address of a page asked for at its plain address (no ?lang=): the plain address
 *  itself, the "x-default" its language links name (lib/seo.ts). The page names the address of the
 *  language it was drawn in, which is right for /club?lang=ar - but at /club it pointed search engines
 *  from the x-default to one of its own alternates (Lighthouse: "points to another hreflang location").
 *  worker.js rewrites it on the way out, after the edge's copy (kept per language) is stored or read.
 *  Null when the address names a language, or is not a site page (the account, the API, a file). */
export function plainCanonical(req: Request): string | null {
  if (req.method !== "GET") return null;
  const url = new URL(req.url);
  if (url.searchParams.has("lang") || SKIP.test(url.pathname) || /\.[a-z0-9]+$/i.test(url.pathname)) return null;
  return SITE + (url.pathname === "/" ? "/" : url.pathname.replace(/\/+$/, ""));
}

function edgeCache(): Cache | null {
  try { return ((globalThis as { caches?: { default?: Cache } }).caches?.default) ?? null; } catch { return null; }
}
