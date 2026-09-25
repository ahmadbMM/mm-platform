// The public website's launch state. micromobility.sa is controlled from the staff page
// (owner, 2026-09-24): its Website section writes public.site_content, and this file reads it.
//
// While the site is Coming Soon, it shows only the Coming Soon screen: every other page (the
// unfinished login included) is sent back to it, and search engines are asked to keep out. The
// NFC bike pages (/b/*) and the /store forward to the Salla shop keep working.
//
// Staff turn Coming Soon off with the switch in the staff page (Website). Home exists, so that
// switch is now the one thing that opens the site (released 2026-09-25; the staff page's
// SITE_PAGES marks Home built to match). Setting this back to false closes the site whatever the
// switch says.
export const HOME_BUILT = true;

// Tests only: MM_TEST_SITE_OPEN=1 (CI's page checks, local audits) treats the site as open and
// every page as switched on, whatever staff have set, so pages can be checked while the real site
// is Coming Soon. It is a server setting that is never set on the Worker.
export const TEST_OPEN = process.env.MM_TEST_SITE_OPEN === "1";

/** Whether the site's state has to be read at all: not while it is closed whatever staff say. */
export const siteCanOpen = () => HOME_BUILT || TEST_OPEN;

export type SiteContent = Record<string, unknown>;

const TTL_MS = 60_000; // a staff save shows within a minute
let cache: { at: number; data: SiteContent | null } | null = null;
let journalCache: { at: number; data: SiteContent | null } | null = null;

// The last good copy is also kept in Cloudflare's cache at the edge (a week), so a Worker instance
// that has only just started - and so has nothing in memory - still has the site as staff set it
// when the database cannot be reached. Without it, "nothing read" meant Coming Soon on and every
// page off: a database outage would have closed the whole site. Local runs have no edge cache and
// skip this.
const EDGE_TTL = 7 * 24 * 60 * 60;
const edgeKey = (kind: string) => `https://micromobility.sa/__site-content/${kind}/v1`;
type EdgeCache = { match(k: string): Promise<Response | undefined>; put(k: string, r: Response): Promise<void> };
const edgeCache = (): EdgeCache | null => {
  try { return ((globalThis as { caches?: { default?: EdgeCache } }).caches?.default) ?? null; } catch { return null; }
};
async function edgeRead(kind: string): Promise<SiteContent | null> {
  try {
    const hit = await edgeCache()?.match(edgeKey(kind));
    const data = hit ? await hit.json() : null;
    return data && typeof data === "object" ? (data as SiteContent) : null;
  } catch { return null; }
}
async function edgeWrite(kind: string, data: SiteContent): Promise<void> {
  try {
    await edgeCache()?.put(edgeKey(kind), new Response(JSON.stringify(data), { headers: { "content-type": "application/json", "cache-control": `public, max-age=${EDGE_TTL}` } }));
  } catch { /* the edge copy is a convenience */ }
}

/** One read of site_content with the public key; null when it could not be read. */
async function readRows(filter: string, fetchImpl: typeof fetch): Promise<SiteContent | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetchImpl(`${url}/rest/v1/site_content?select=key,value&${filter}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { key: string; value: unknown }[];
    return Array.isArray(rows) ? Object.fromEntries(rows.map((r) => [r.key, r.value])) : null;
  } catch {
    return null; // unreachable or slow
  }
}

/** Read, kept for a minute per Worker instance. A failed read keeps the last good copy: this
 *  instance's, else the edge's; with neither, null - and every caller falls back to the site's
 *  own defaults, which keep the site on Coming Soon. */
async function loadKind(kind: string, filter: string, held: { at: number; data: SiteContent | null } | null, fetchImpl: typeof fetch, now: number) {
  if (held && now - held.at < TTL_MS) return held;
  const fresh = await readRows(filter, fetchImpl);
  if (fresh) { void edgeWrite(kind, fresh); return { at: now, data: fresh }; }
  return { at: now, data: held?.data ?? (await edgeRead(kind)) };
}

/**
 * Everything staff have set, as { key: value }. The Journal's articles are read only by the
 * Journal's pages (loadJournalContent): they are the one part of the content that grows, and every
 * page reads this every minute.
 */
export async function loadSiteContent(fetchImpl: typeof fetch = fetch, now: number = Date.now()): Promise<SiteContent | null> {
  cache = await loadKind("site", "key=not.like.journal.*", cache, fetchImpl, now);
  return cache.data;
}

/** For tests: forget the cached copy. */
export function resetSiteContent(): void {
  cache = null;
  journalCache = null;
}

/** The Journal's own content (journal.* keys), read only by the Journal's pages, kept the same way. */
export async function loadJournalContent(fetchImpl: typeof fetch = fetch, now: number = Date.now()): Promise<SiteContent | null> {
  journalCache = await loadKind("journal", "key=like.journal.*", journalCache, fetchImpl, now);
  return journalCache.data;
}

/** The pages staff switch on one at a time (staff page: Website > Pages; its SITE_PAGES lists
 *  the same keys). Home is not one of them - it opens with the Coming Soon switch. */
export const SWITCHED_PAGES = ["experiences", "workshop", "business", "help", "ambassadors", "club", "about", "events", "gallery", "routes", "journal", "account", "terms"] as const;
export type SwitchedPage = (typeof SWITCHED_PAGES)[number];

/** A page is shown once staff switch it on - an explicit true, read the way the staff page reads
 *  it. Until then it is left out of the menus and its address goes to Home. */
export function pageOn(content: SiteContent | null, page: SwitchedPage): boolean {
  return TEST_OPEN || content?.[`page.${page}.visible`] === true;
}

/** The switched page an address belongs to (/club, /help/..., and the old /en/club), or null. */
export function switchedPageOf(pathname: string): SwitchedPage | null {
  const m = pathname.match(/^(?:\/(?:en|ar))?\/([a-z_]+)(?:\/|$)/);
  return m && (SWITCHED_PAGES as readonly string[]).includes(m[1]) ? (m[1] as SwitchedPage) : null;
}

/** Where a request for a page staff have not switched on goes: Home. An old /en/... or /ar/...
 *  address goes to /en or /ar, which next-intl sends on to Home in that language. */
export function hiddenPageTarget(pathname: string, content: SiteContent | null): string | null {
  const page = switchedPageOf(pathname);
  if (!page || pageOn(content, page)) return null;
  return pathname.match(/^\/(?:en|ar)(?=\/)/)?.[0] ?? "/";
}

/** The switched pages a visitor does not see, for the menus. */
export function hiddenPages(content: SiteContent | null): SwitchedPage[] {
  return SWITCHED_PAGES.filter((p) => !pageOn(content, p));
}

/** Closed unless Home exists AND staff have explicitly switched Coming Soon off. */
export function isComingSoon(content: SiteContent | null, homeBuilt: boolean = HOME_BUILT): boolean {
  if (TEST_OPEN) return false;
  return !(homeBuilt && content?.["site.coming_soon"] === false);
}

/** A text staff set for this language, else the site's own wording. */
export function siteText(content: SiteContent | null, key: string, locale: string, fallback: string): string {
  const v = content?.[key];
  if (v && typeof v === "object") {
    const s = (v as Record<string, unknown>)[locale];
    if (typeof s === "string" && s.trim()) return s;
  }
  return fallback;
}
