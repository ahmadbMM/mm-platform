// Where the site's links go today. Pages that are not built yet are simply not linked; the
// booking system (Experiences) and the Salla shop (/store) live elsewhere for now.
export const BOOKING_URL = "https://micromobilityrentals.pages.dev/";
export const PRIVACY_URL = "https://micromobilityrentals.pages.dev/?privacy";

export type NavLink = { key: string; href: string; en: string; ar: string; external?: boolean };

export const NAV_LINKS: NavLink[] = [
  { key: "store", href: "/store", en: "Store", ar: "المتجر", external: true },
  { key: "experiences", href: BOOKING_URL, en: "Experiences", ar: "التجارب", external: true },
];

export const pick = (l: { en: string; ar: string }, locale: string) => (locale === "ar" ? l.ar : l.en);
