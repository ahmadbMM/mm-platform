import { phrase } from "@/i18n/tx";

// Where the site's links go today. Pages that are not built yet are simply not linked; the
// booking app (every Book button on /experiences) and the Salla shop (/store) live elsewhere.
export const BOOKING_URL = "https://micromobilityrentals.pages.dev/";
/** The Salla shop (micromobility.sa/store opens it; proxy.ts) and its cart, for the header's cart
 *  icon. Staff change all three in Website > Whole site > Other addresses; these are the defaults. */
export const STORE_URL = "https://stepdragon.com.sa";
export const STORE_CART_URL = "https://stepdragon.com.sa/cart";

/** Every page a visitor can open from the header or the search, in the header's order. */
export type NavLink = { key: string; href: string; en: string; ar: string; external?: boolean };

export const NAV_LINKS: NavLink[] = [
  { key: "store", href: "/store", ...phrase("Store", "المتجر"), external: true },
  { key: "bikes", href: "/bikes", ...phrase("Bikes", "الدراجات") },
  { key: "experiences", href: "/experiences", ...phrase("Experiences", "التجارب") },
  { key: "workshop", href: "/workshop", ...phrase("Workshop", "الورشة") },
  { key: "club", href: "/club", ...phrase("Club", "النادي") },
  { key: "ambassadors", href: "/ambassadors", ...phrase("Ambassadors", "السفراء") },
  { key: "events", href: "/events", ...phrase("Events", "الفعاليات") },
  { key: "routes", href: "/routes", ...phrase("Routes", "المسارات") },
  { key: "gallery", href: "/gallery", ...phrase("Gallery", "المعرض") },
  { key: "journal", href: "/journal", ...phrase("Journal", "المدونة") },
  { key: "business", href: "/business", ...phrase("Business", "للشركات") },
  { key: "about", href: "/about", ...phrase("About", "من نحن") },
  { key: "help", href: "/help", ...phrase("Help", "المساعدة") },
];

/** The header (owner, 2026-09-25): the sections, with Community holding the pages its riders
 *  use, and every page reachable from it. Bikes (the catalogue, 2026-09-27) sits next to the
 *  store it sells for. Help is not a header section - the footer and the search reach it. */
export const COMMUNITY = { key: "community", ...phrase("Community", "المجتمع"), pages: ["club", "ambassadors", "events", "routes", "gallery", "journal"] };
export const HEADER: string[] = ["store", "bikes", "experiences", "workshop", "community", "business", "about"];


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
