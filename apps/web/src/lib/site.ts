// The public website's launch state. micromobility.sa is controlled from the staff page
// (owner, 2026-09-24): its Website section writes public.site_content, and this file reads it.
//
// While the site is Coming Soon, it shows only the Coming Soon screen: every other page (the
// unfinished login included) is sent back to it, and search engines are asked to keep out. The
// NFC bike pages (/b/*) and the /store forward to the Salla shop keep working.
//
// Staff turn Coming Soon off with the switch in the staff page. Until the Home page exists the
// site stays closed whatever the switch says: there would be nothing behind it (the staff page
// locks the switch for the same reason). Set HOME_BUILT when Home ships.
export const HOME_BUILT = false;

export type SiteContent = Record<string, unknown>;

const TTL_MS = 60_000; // a staff save shows within a minute
let cache: { at: number; data: SiteContent | null } | null = null;

/**
 * Everything staff have set, as { key: value }. Read with the public key and kept for a minute
 * per Worker instance. A failed read keeps the last good copy; with none, it answers null and
 * every caller falls back to the site's own defaults - which keep the site on Coming Soon.
 */
export async function loadSiteContent(fetchImpl: typeof fetch = fetch, now: number = Date.now()): Promise<SiteContent | null> {
  if (cache && now - cache.at < TTL_MS) return cache.data;
  let data: SiteContent | null = cache?.data ?? null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    try {
      // The Journal's articles are read only by the Journal's pages (loadJournalContent): they are
      // the one part of the content that grows, and every page reads this every minute.
      const res = await fetchImpl(`${url}/rest/v1/site_content?select=key,value&key=not.like.journal.*`, {
        headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(2500),
      });
      if (res.ok) {
        const rows = (await res.json()) as { key: string; value: unknown }[];
        if (Array.isArray(rows)) data = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      }
    } catch {
      // unreachable or slow: keep what we had
    }
  }
  cache = { at: now, data };
  return data;
}

/** For tests: forget the cached copy. */
export function resetSiteContent(): void {
  cache = null;
  journalCache = null;
}

let journalCache: { at: number; data: SiteContent | null } | null = null;

/** The Journal's own content (journal.* keys), read only by the Journal's pages, kept the same way. */
export async function loadJournalContent(fetchImpl: typeof fetch = fetch, now: number = Date.now()): Promise<SiteContent | null> {
  if (journalCache && now - journalCache.at < TTL_MS) return journalCache.data;
  let data: SiteContent | null = journalCache?.data ?? null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    try {
      const res = await fetchImpl(`${url}/rest/v1/site_content?select=key,value&key=like.journal.*`, {
        headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(2500),
      });
      if (res.ok) {
        const rows = (await res.json()) as { key: string; value: unknown }[];
        if (Array.isArray(rows)) data = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      }
    } catch {
      // unreachable or slow: keep what we had
    }
  }
  journalCache = { at: now, data };
  return data;
}

/** The pages staff switch on one at a time (staff page: Website > Pages; its SITE_PAGES lists
 *  the same keys). Home is not one of them - it opens with the Coming Soon switch. */
export const SWITCHED_PAGES = ["experiences", "workshop", "business", "help", "ambassadors", "club", "about", "events", "gallery", "routes", "journal", "account"] as const;
export type SwitchedPage = (typeof SWITCHED_PAGES)[number];

/** A page is shown once staff switch it on - an explicit true, read the way the staff page reads
 *  it. Until then it is left out of the menus and its address goes to Home. */
export function pageOn(content: SiteContent | null, page: SwitchedPage): boolean {
  return content?.[`page.${page}.visible`] === true;
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
