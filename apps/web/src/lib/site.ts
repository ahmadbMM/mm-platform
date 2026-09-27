import { edgeStore, memo, resetMemo } from "./memo";

// The public website's launch state. micromobility.sa is controlled from the staff page
// (owner, 2026-09-24): its Website section writes public.site_content, and this file reads it.
//
// While the site is Coming Soon, it shows only the Coming Soon screen: every other page (the
// unfinished login included) is sent back to it, and search engines are asked to keep out. The
// NFC bike pages (/bikes/42, formerly /b/42) and the /store forward to the Salla shop keep working.
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
const KEY = "site-content:";

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

/**
 * Everything staff have set, as { key: value }. Read once per Worker instance and kept for a minute
 * (lib/memo.ts: everyone asking at once shares the read, a copy past the minute is served while it
 * is refreshed, and the last good copy - this instance's, else the edge's - stands in for a failed
 * read). With nothing ever read, null: every caller falls back to the site's own defaults, which
 * keep the site on Coming Soon. The Journal's articles are read only by the Journal's pages
 * (loadJournalContent): they are the one part of the content that grows, and every page reads this.
 */
export async function loadSiteContent(fetchImpl: typeof fetch = fetch, now: number = Date.now()): Promise<SiteContent | null> {
  return memo<SiteContent>(`${KEY}site`, { ttl: TTL_MS, now, read: () => readRows("key=not.like.journal.*", fetchImpl), keep: edgeStore("site") });
}

/** For tests: forget the cached copies. */
export function resetSiteContent(): void {
  resetMemo(KEY);
}

/** The Journal's own content (journal.* keys), read only by the Journal's pages, kept the same way. */
export async function loadJournalContent(fetchImpl: typeof fetch = fetch, now: number = Date.now()): Promise<SiteContent | null> {
  return memo<SiteContent>(`${KEY}journal`, { ttl: TTL_MS, now, read: () => readRows("key=like.journal.*", fetchImpl), keep: edgeStore("journal") });
}

/** The pages staff switch on one at a time (staff page: Website > Pages; its SITE_PAGES lists
 *  the same keys). Home is not one of them - it opens with the Coming Soon switch. */
export const SWITCHED_PAGES = ["experiences", "workshop", "business", "help", "ambassadors", "club", "about", "events", "gallery", "routes", "journal", "account", "terms", "bikes"] as const;
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
