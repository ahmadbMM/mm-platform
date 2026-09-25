// Where the site's links go today. Pages that are not built yet are simply not linked; the
// booking app (every Book button on /experiences) and the Salla shop (/store) live elsewhere.
export const BOOKING_URL = "https://micromobilityrentals.pages.dev/";
/** The Salla shop's cart (the shop itself is STORE in next.config.ts), for the header's cart icon. */
export const STORE_CART_URL = "https://stepdragon.com.sa/cart";

/** footer: listed in the footer only (the header has no room for every page). */
export type NavLink = { key: string; href: string; en: string; ar: string; external?: boolean; footer?: boolean };

export const NAV_LINKS: NavLink[] = [
  { key: "store", href: "/store", en: "Store", ar: "المتجر", external: true },
  { key: "experiences", href: "/experiences", en: "Experiences", ar: "التجارب" },
  { key: "workshop", href: "/workshop", en: "Workshop", ar: "الورشة" },
  { key: "club", href: "/club", en: "Club", ar: "النادي" },
  { key: "ambassadors", href: "/ambassadors", en: "Ambassadors", ar: "السفراء" },
  { key: "business", href: "/business", en: "Business", ar: "للشركات" },
  { key: "about", href: "/about", en: "About", ar: "من نحن" },
  { key: "help", href: "/help", en: "Help", ar: "المساعدة" },
  { key: "events", href: "/events", en: "Events", ar: "الفعاليات", footer: true },
  { key: "gallery", href: "/gallery", en: "Gallery", ar: "المعرض", footer: true },
  { key: "routes", href: "/routes", en: "Routes", ar: "المسارات", footer: true },
  { key: "journal", href: "/journal", en: "Journal", ar: "المدونة", footer: true },
];

export const pick = (l: { en: string; ar: string }, locale: string) => (locale === "ar" ? l.ar : l.en);

/** The page a link on this site opens ("/business#x" → "business", an old "/ar/club" → "club");
 *  "" for anything else. Used to leave out or redirect links to pages staff have switched off. */
export const pageOf = (href: string) => (/^\/(?!\/)/.test(href) ? (href.match(/^\/(?:(?:en|ar)\/)?([a-z_-]+)/) || [])[1] || "" : "");

/** A staff-entered link, as visitors follow it. This site's addresses carry no language
 *  (i18n/routing.ts): "/business" is the same page in English and Arabic and the visitor's
 *  language travels in a cookie, so every link is used as typed. An old "/ar/business" still
 *  works and switches to Arabic. The locale is no longer needed; it stays in the signature so
 *  every page can keep passing it. */
export const localHref: (href: string, locale: string) => string = (href) => href;

/** A link to another site, opened in the visitor's language: the booking app reads ?lang= (and
 *  so keeps the language the visitor was reading in). A lang already in the link is kept; a
 *  link on this site is used as typed. */
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
