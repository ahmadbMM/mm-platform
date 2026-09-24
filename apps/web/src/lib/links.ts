// Where the site's links go today. Pages that are not built yet are simply not linked; the
// booking app (every Book button on /experiences) and the Salla shop (/store) live elsewhere.
export const BOOKING_URL = "https://micromobilityrentals.pages.dev/";
export const PRIVACY_URL = "https://micromobilityrentals.pages.dev/?privacy";

export type NavLink = { key: string; href: string; en: string; ar: string; external?: boolean };

export const NAV_LINKS: NavLink[] = [
  { key: "store", href: "/store", en: "Store", ar: "المتجر", external: true },
  { key: "experiences", href: "/experiences", en: "Experiences", ar: "التجارب" },
  { key: "workshop", href: "/workshop", en: "Workshop", ar: "الورشة" },
  { key: "club", href: "/club", en: "Club", ar: "النادي" },
  { key: "ambassadors", href: "/ambassadors", en: "Ambassadors", ar: "السفراء" },
  { key: "business", href: "/business", en: "Business", ar: "للشركات" },
  { key: "help", href: "/help", en: "Help", ar: "المساعدة" },
];

export const pick = (l: { en: string; ar: string }, locale: string) => (locale === "ar" ? l.ar : l.en);

/** A staff-entered link, in the visitor's language when it is one of this site's pages:
 *  "/business" on the Arabic site is "/ar/business". Other sites, #anchors, mailto:, tel:, and
 *  paths that are not language pages (/store, /b/…, /media/…, /site/…) are left as they are. */
export function localHref(href: string, locale: string): string {
  if (!/^\/(?!\/)/.test(href) || /^\/(en|ar)(\/|$|[?#])/.test(href) || /^\/(store|b|media|site|api)(\/|$|[?#])/.test(href)) return href;
  return `/${locale}${href === "/" ? "" : href}`;
}

/** A link to another site, opened in the visitor's language: the booking app reads ?lang= (and
 *  so keeps the language the visitor was reading in). A lang already in the link is kept; a
 *  link on this site goes through localHref. */
export function bookingLink(href: string, locale: string): string {
  if (!/^https?:\/\//i.test(href)) return localHref(href, locale);
  try {
    const u = new URL(href);
    if (!u.searchParams.has("lang")) u.searchParams.set("lang", locale);
    return u.toString();
  } catch {
    return href;
  }
}
