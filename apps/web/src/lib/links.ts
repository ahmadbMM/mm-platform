// Where the site's links go today. Pages that are not built yet are simply not linked; the
// booking system (Experiences) and the Salla shop (/store) live elsewhere for now.
export const BOOKING_URL = "https://micromobilityrentals.pages.dev/";
export const PRIVACY_URL = "https://micromobilityrentals.pages.dev/?privacy";

export type NavLink = { key: string; href: string; en: string; ar: string; external?: boolean };

export const NAV_LINKS: NavLink[] = [
  { key: "store", href: "/store", en: "Store", ar: "المتجر", external: true },
  { key: "experiences", href: BOOKING_URL, en: "Experiences", ar: "التجارب", external: true },
  { key: "workshop", href: "/workshop", en: "Workshop", ar: "الورشة" },
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
