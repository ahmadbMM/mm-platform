import { DEFAULT_SHARE_IMAGE, SITE_NAME, SITE_URL, langPath } from "@/lib/seo";
import type { CatalogModel } from "@/lib/catalog";

// Structured data (schema.org JSON-LD) for search engines: who the company is and where its store
// is (Home), the rides a visitor can book (Events), the Journal's articles and the bike
// catalogue's models. Everything comes from what staff set on the site; nothing here is shown to
// visitors.
type Sec = Record<string, unknown>;
const S = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const N = (v: unknown) => (typeof v === "number" ? v : NaN);
const abs = (u: string) => (/^https?:\/\//.test(u) ? u : `${SITE_URL}${u.startsWith("/") ? "" : "/"}${u}`);
const hour = (h: number) => `${String(Math.min(23, Math.max(0, Math.floor(h === 24 ? 23 : h)))).padStart(2, "0")}:${h === 24 ? "59" : "00"}`;

const DAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

/** The company, and its store in Jeddah with its hours, for Home. `site` is the resolved "site" page. */
export function companyData(site: Record<string, Sec>, locale: string): object[] {
  const c = site.contact ?? {}, legal = site.legal ?? {}, social = site.social ?? {};
  const sameAs = Object.values(social).map(S).filter((u) => /^https?:\/\//.test(u));
  const org = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    legalName: S(legal.legalName) || undefined,
    url: SITE_URL,
    logo: abs("/site/logo-dark.png"),
    email: S(c.email) || undefined,
    telephone: S(c.phone) || undefined,
    foundingDate: "2016",
    sameAs: sameAs.length ? sameAs : undefined,
  };
  const open = N(c.openHour), close = N(c.closeHour);
  const days = c.fridayClosed === true ? DAYS.filter((d) => d !== "Friday") : DAYS;
  const store = {
    "@context": "https://schema.org",
    "@type": "BicycleStore",
    "@id": `${SITE_URL}/#store`,
    name: SITE_NAME,
    url: langPath(SITE_URL + "/", locale),
    image: abs(DEFAULT_SHARE_IMAGE),
    parentOrganization: { "@id": `${SITE_URL}/#organization` },
    telephone: S(c.phone) || undefined,
    email: S(c.email) || undefined,
    hasMap: S(c.mapsHref) || undefined,
    address: S(c.address)
      ? { "@type": "PostalAddress", streetAddress: S(c.address), addressLocality: "Jeddah", addressCountry: "SA" }
      : undefined,
    openingHoursSpecification: Number.isFinite(open) && Number.isFinite(close)
      ? [{ "@type": "OpeningHoursSpecification", dayOfWeek: days.map((d) => `https://schema.org/${d}`), opens: hour(open), closes: hour(close) }]
      : undefined,
  };
  return [org, store];
}

export type EventInput = { name: string; date: string; times: [string, string] | null; gather: boolean; place: string; url: string; full: boolean };

/** The public rides on the Events page. A time that is not HH:MM is left out rather than guessed. */
export function eventsData(events: EventInput[]): object[] {
  const hm = (t: string | undefined) => (t && /^\d{1,2}:\d{2}$/.test(t) ? t.padStart(5, "0") : "");
  return events.map((e) => {
    const start = hm(e.times?.[e.gather ? 1 : 0]);
    const end = e.gather ? "" : hm(e.times?.[1]);
    return {
      "@context": "https://schema.org",
      "@type": "Event",
      name: e.name,
      startDate: start ? `${e.date}T${start}:00+03:00` : e.date,
      endDate: end && start && end > start ? `${e.date}T${end}:00+03:00` : undefined,
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      location: { "@type": "Place", name: e.place, address: { "@type": "PostalAddress", addressLocality: "Jeddah", addressCountry: "SA" } },
      organizer: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
      image: abs(DEFAULT_SHARE_IMAGE),
      url: abs(e.url),
      offers: { "@type": "Offer", url: abs(e.url), availability: e.full ? "https://schema.org/SoldOut" : "https://schema.org/InStock" },
    };
  });
}

/** One Journal article. */
export function articleData(p: { title: string; excerpt: string; date: string; cover: string; slug: string }, locale: string): object {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: p.title,
    description: p.excerpt || undefined,
    datePublished: p.date || undefined,
    image: abs(p.cover || DEFAULT_SHARE_IMAGE),
    mainEntityOfPage: langPath(`${SITE_URL}/journal/${p.slug}`, locale),
    author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    publisher: { "@type": "Organization", name: SITE_NAME, logo: { "@type": "ImageObject", url: abs("/site/logo-dark.png") } },
  };
}

/** One model of the bike catalogue (lib/catalog.ts). No offers: the catalogue states what a ride
 *  costs, not a sale price, and the store sells on its own site. */
export function productData(model: CatalogModel, locale: string, x: { path: string; image: string; category: string; description: string }): object {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: [model.brand, model.name].map(S).filter(Boolean).join(" "),
    brand: S(model.brand) ? { "@type": "Brand", name: S(model.brand) } : undefined,
    image: abs(x.image || DEFAULT_SHARE_IMAGE),
    description: S(x.description) || undefined,
    category: S(x.category) || undefined,
    url: langPath(SITE_URL + x.path, locale),
    manufacturer: S(model.brand) ? { "@type": "Organization", name: S(model.brand) } : undefined,
  };
}
