import { LOCALE_CODES } from "../i18n/locales";

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

export const PAGE_TTL = 60;
const LANGS = new Set<string>(LOCALE_CODES);
const SKIP = /^\/(?:api|_next|media|b|petromin|community|account|preview|login|en|ar|bikes\/\d{1,6})(?:\/|$)/;
const PRIVATE = ["mm_acct", "mm_preview"];
const LANG_COOKIE = "NEXT_LOCALE";
// Tracking parameters (utm_*, fbclid...) change nothing on the page: a link from Instagram or a
// newsletter is the same page, so they neither stop the copy being used nor give it a key of its own.
const TRACKING = /^(?:utm_[a-z]+|fbclid|gclid|igshid|mc_cid|mc_eid)$/i;

type Cache = { match(k: string): Promise<Response | undefined>; put(k: string, r: Response): Promise<void> };
type Ctx = { waitUntil(p: Promise<unknown>): void };
type Env = { PAGE_CACHE?: string; CF_VERSION_METADATA?: { id?: string } };
type Handler = { fetch(req: Request, env: never, ctx: never): Promise<Response> };

/** One cookie's value from a Cookie header, or null. */
export function cookieOf(header: string | null, name: string): string | null {
  for (const part of (header || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
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

const storable = (r: Response) => r.status === 200 && (r.headers.get("content-type") || "").startsWith("text/html");

function toStore(r: Response): Response {
  const h = new Headers(r.headers);
  h.delete("set-cookie");
  h.set("cache-control", `public, max-age=${PAGE_TTL}`);
  return new Response(r.body, { status: r.status, headers: h });
}

function fromStore(r: Response, req: Request): Response {
  const h = new Headers(r.headers);
  h.set("cache-control", "private, no-store"); // browsers ask again; the edge answers
  h.set("x-mm-page-cache", "hit");
  // ?lang= also makes that language the visitor's (proxy.ts sets the cookie on a rendered page).
  const asked = new URL(req.url).searchParams.get("lang");
  if (asked && LANGS.has(asked)) h.append("set-cookie", `${LANG_COOKIE}=${asked}; Path=/; Max-Age=31536000; SameSite=lax`);
  return new Response(r.body, { status: r.status, headers: h });
}

/** Answers a request from the edge's copy when it may, else renders it (and keeps a copy). */
export async function servePage(req: Request, env: Env, ctx: Ctx, handler: Handler, cache: Cache | null = edgeCache()): Promise<Response> {
  const key = env.PAGE_CACHE !== "off" && cache ? pageCacheKey(req, env.CF_VERSION_METADATA?.id || "local") : null;
  if (!key || !cache) return handler.fetch(req, env as never, ctx as never);
  try {
    const hit = await cache.match(key);
    if (hit) return fromStore(hit, req);
  } catch { /* the edge's copy is a convenience: render */ }
  const res = await handler.fetch(req, env as never, ctx as never);
  if (storable(res)) ctx.waitUntil(cache.put(key, toStore(res.clone())).catch(() => {}));
  return res;
}

function edgeCache(): Cache | null {
  try { return ((globalThis as { caches?: { default?: Cache } }).caches?.default) ?? null; } catch { return null; }
}
