import { SITE_URL, langPath } from "@/lib/seo";
import { listingHref, mkCityName, mkPhotoSrc, shopHref, type MkListing, type MkShop } from "./core";
import { w1Cut, w1Facts, w1Stage } from "./w1";

// What search engines read about a listing and a shop (schema.org JSON-LD, drawn by components/site/JsonLd.tsx).
// The rule this file exists for: the site shows a listing, it does not sell it. So an offer always names its seller,
// and the seller is never the site unless the listing is MicroMobility's own:
//   a private seller   a Person named by the label the page shows ("Private seller") - never the name the seller
//                      chose for the listing, which is for the page's readers and not for an index of people;
//   a shop             an Organization: its trade name and its own page;
//   MicroMobility      the company, for the used items it sells itself.
// Nothing here is shown to a visitor, and nothing is said that the page does not say: no rating, no review, no count.

const abs = (path: string) => `${SITE_URL}${path}`;

/** A listing's condition in schema.org's words: new, or used (every other condition, "for parts" included). */
export const w1ItemCondition = (c: string): string => `https://schema.org/${c === "new" ? "NewCondition" : "UsedCondition"}`;
/** Whether it can still be bought: on sale, reserved for someone (it may come back), or sold. */
export function w1Availability(status: string): string {
  return `https://schema.org/${status === "live" ? "InStock" : status === "reserved" ? "LimitedAvailability" : "SoldOut"}`;
}

/** The Product and its one Offer for a listing everybody can see; null for a state only its seller is shown.
 *  `privateLabel`: the page's "Private seller"; `category`: the product type's name in the page's language. */
export function w1ProductData(l: MkListing, x: { locale: string; category: string; privateLabel: string; company: string }): object | null {
  if (w1Stage(l.status) === "private") return null;
  const url = langPath(abs(listingHref(l.id)), x.locale);
  const facts = Object.fromEntries(w1Facts(l.facts).map((f) => [f.key, f.value]));
  const images = (Array.isArray(l.photos) ? l.photos : []).map((p) => mkPhotoSrc(p)).filter((p): p is string => !!p).map(abs);
  const shop = l.seller?.kind === "shop" ? l.seller.shop : null;
  const seller = l.seller?.kind === "company"
    ? { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: x.company, url: SITE_URL }
    : shop
      ? { "@type": "Organization", name: shop.name_en, url: abs(shopHref(shop.slug)) }
      : { "@type": "Person", name: x.privateLabel };
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: l.title,
    description: w1Cut(l.description, 500) || undefined,
    image: images.length ? images : undefined,
    sku: String(l.id),
    category: x.category || undefined,
    brand: facts.brand ? { "@type": "Brand", name: facts.brand } : undefined,
    model: facts.model || undefined,
    url,
    offers: {
      "@type": "Offer",
      url,
      price: l.price,
      priceCurrency: "SAR",
      itemCondition: w1ItemCondition(l.condition),
      availability: w1Availability(l.status),
      availableAtOrFrom: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: mkCityName(l.city, "en"), addressCountry: "SA" } },
      seller,
    },
  };
}

/** A shop's page: the business as it registered itself (its trade name, its city and address, its VAT number). */
export function w1ShopData(s: MkShop, locale: string): object {
  const logo = mkPhotoSrc(s.logo);
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    name: s.name_en,
    alternateName: s.name_ar || undefined,
    url: langPath(abs(shopHref(s.slug)), locale),
    image: logo ? abs(logo) : undefined,
    description: w1Cut(s.about_en || s.about_ar, 300) || undefined,
    vatID: s.vat_no || undefined,
    identifier: s.cr_no ? { "@type": "PropertyValue", name: "CR", value: s.cr_no } : undefined,
    address: { "@type": "PostalAddress", streetAddress: s.address || undefined, addressLocality: mkCityName(s.city, "en"), addressCountry: "SA" },
  };
}
