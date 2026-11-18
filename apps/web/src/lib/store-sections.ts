// The product page's sections below the buy box (store build 2026-11-15, chain w3b; CONTRACTS.md section 2) as rules the
// components draw: the specifications grouped with the rider height first and the weight's basis (F36), the add-ons
// (F30, D17-C), the comparison with the bikes staff named (F10, O09-B), the verified buyers' reviews (F42), the trade-in
// message (F52) and the product's structured data for search engines (F45). Nothing here reads anything, so the
// browser's components can use it too.
import { intlOf } from "@/i18n/locales";
import { SITE_NAME, SITE_URL, langPath } from "./seo";
import { extrasOf, waDigits, waHref } from "./store-pdp";
import {
  KEY_SPEC_ICONS, linePhotos, optionsOf, pick, priceRange, productHref, productStock, relatedOf, reviewSummary, variantLabel,
  type CmRange, type KeySpecIcon, type Store, type StoreProduct, type StoreReview, type StoreSpec, type StoreVariant,
} from "./store-core";
import { MAX_LINES, MAX_QTY, roomFor } from "./cart";
import { RETURN_DAYS, warrantyMonths } from "./store-policy";

// ── F36: the specification table ─────────────────────────────────────────────────────────────────

/** A bike's specification groups, in the order the table shows them (Specialized's Frameset, Brakes, Drivetrain). */
export const SPEC_GROUPS = ["size", "frame", "drive", "brakes", "wheels", "power", "other"] as const;
export type SpecGroupId = (typeof SPEC_GROUPS)[number];
/** One row: the rider height the sizes give, or a row staff wrote (a weight with the basis staff put in brackets). */
export type SpecRow = { kind: "rider"; range: CmRange } | { kind: "spec"; label: string; value: string; basis: string | null };
/** `id` null: a table with no group headings (one group, or not a bike). */
export type SpecGroup = { id: SpecGroupId | null; rows: SpecRow[] };

// Read from the row's English label (staff write every row in English, Arabic optional). The first match wins, so
// "Wheel size" is a wheel and "Frame size" a size.
const GROUP_WORDS: [SpecGroupId, RegExp][] = [
  ["wheels", /\b(wheels?|wheelset|tyres?|tires?|rims?|hubs?|spokes?)\b/i],
  ["drive", /\bgear(ing)? (range|ratios?)\b/i], // before "range", which alone is a battery's
  ["power", /\b(motor|battery|range|charger|charging|assist|display|torque|throttle|voltage|watts?|(top|max(imum)?) speed)\b/i],
  ["brakes", /\b(brakes?|braking|rotors?|calipers?)\b/i],
  ["drive", /\b(groupset|drivetrain|gears?|gearing|speeds?|shifters?|shifting|derailleurs?|cranks?|crankset|chain|chainrings?|cassette|freewheel|bottom bracket|pedals?)\b/i],
  ["size", /\b(rider|height|sizes?|sizing|weight|load|geometry|reach|stack)\b/i],
  ["frame", /\b(frame|frameset|fork|headset|seat ?post|saddle|handlebars?|bars?|stem|grips?|material)\b/i],
];
/** The group a specification row belongs to, by its English label. */
export const specGroupOf = (label: string): SpecGroupId => GROUP_WORDS.find(([, re]) => re.test(label))?.[0] ?? "other";

const RIDER_LABEL = /\b(rider|body) height\b/i;
const isWeight = (s: StoreSpec) => /\bweight\b/i.test(s.en?.[0] ?? "") || /وزن/.test(s.ar?.[0] ?? "");

/** A value and the basis staff gave it in brackets at its end: "10.4 kg (size M)" -> {value "10.4 kg", basis "size M"}. */
export function splitBasis(value: string): { value: string; basis: string | null } {
  const m = /^(.+?)\s*[(（]\s*([^()（）]{1,40}?)\s*[)）]$/.exec(value.trim());
  return m ? { value: m[1], basis: m[2] } : { value: value.trim(), basis: null };
}

/** The rider heights the product's sizes cover (F20's rows, of the sizes it comes in): the lowest to the highest, an
 *  open end when a size has one ("190+"); null when staff gave no heights, or the ends are both open. */
export function riderHeight(p: StoreProduct): CmRange | null {
  const sizes = optionsOf(p).sizes;
  const rows = p.sizes.filter((r) => r.height && (!sizes.length || sizes.includes(r.size))).map((r) => r.height as CmRange);
  if (!rows.length) return null;
  const min = rows.some((r) => r.min === null) ? null : Math.min(...rows.map((r) => r.min as number));
  const max = rows.some((r) => r.max === null) ? null : Math.max(...rows.map((r) => r.max as number));
  return min === null && max === null ? null : { min, max };
}

/** A height range in words: "165–195 cm", "190+ cm", "Up to 160 cm"; the numbers kept left to right on an Arabic page
 *  (a range between two numbers would otherwise read backwards there). */
export function cmText(r: CmRange, w: { cm: (s: string) => string; upToCm: (s: string) => string }): string {
  const ltr = (s: string) => `⁦${s}⁩`;
  if (r.min !== null && r.max !== null) return w.cm(ltr(r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`));
  if (r.min !== null) return w.cm(ltr(`${r.min}+`));
  return w.upToCm(ltr(`${r.max}`));
}

/** The specifications as the table shows them (F36): the rider height first, then staff's rows in the page's language;
 *  a bike's rows in groups with small headings (only when there are two groups or more), any other product's in one. */
export function specTable(p: StoreProduct, locale: string): SpecGroup[] {
  const rows: { group: SpecGroupId; first: boolean; row: SpecRow }[] = [];
  const own = p.specs.some((s) => RIDER_LABEL.test(s.en?.[0] ?? ""));
  const rider = own ? null : riderHeight(p);
  if (rider) rows.push({ group: "size", first: true, row: { kind: "rider", range: rider } });
  for (const s of p.specs) {
    const r = locale === "ar" && s.ar ? s.ar : s.en ?? s.ar;
    if (!r) continue;
    const label = s.en?.[0] ?? "";
    const { value, basis } = isWeight(s) ? splitBasis(r[1]) : { value: r[1], basis: null };
    rows.push({ group: specGroupOf(label), first: RIDER_LABEL.test(label), row: { kind: "spec", label: r[0], value, basis } });
  }
  if (!rows.length) return [];
  rows.sort((a, b) => Number(b.first) - Number(a.first)); // stable: the rider height first, the rest in staff's order
  if (p.category !== "bikes") return [{ id: null, rows: rows.map((x) => x.row) }];
  const groups = SPEC_GROUPS.map((id) => ({ id, rows: rows.filter((x) => x.group === id).map((x) => x.row) })).filter((g) => g.rows.length);
  return groups.length < 2 ? [{ id: null, rows: groups[0].rows }] : groups;
}

// ── F30, D17-C, F31: products the shopper adds from the page ────────────────────────────────────

/** The add-ons staff paired with it (goes_with), in their order: still in the store, in stock, never a gift card. The
 *  buy box's Extras step lists the same ones (lib/store-pdp.ts extrasOf), so a bike's Extras and its "Complete your
 *  ride" never disagree about what goes with it. */
export const addonsOf = (store: Store, p: StoreProduct): StoreProduct[] => extrasOf(relatedOf(store, p.goes_with, p.id));

/** A product as a card's client component needs it: its first photo and each colour's first (with what staff wrote about
 *  them, so the card's photo follows the colour picked, as the cart's line will: linePhoto) and its variants; no long
 *  texts, specifications or relations. */
export function leanProduct(p: StoreProduct): StoreProduct {
  const images = linePhotos(p);
  return {
    ...p, description_en: null, description_ar: null, tagline_en: null, tagline_ar: null, specs: [], images,
    key_specs: [], box: [], fit: null, faq: [], sizes: [], image_meta: Object.fromEntries(images.filter((src) => p.image_meta[src]).map((src) => [src, p.image_meta[src]])),
    goes_with: [], compare_with: [], bundle: null,
  };
}

/** What a card asks the shopper to choose before adding: by size, colour, both, or one of several plain variants;
 *  null when the product has a single variant (added as it is). */
export type ChoiceKind = "size" | "colour" | "both" | "one";
export function choiceKind(p: StoreProduct): ChoiceKind | null {
  if (p.variants.length <= 1) return null;
  const o = optionsOf(p);
  return o.sizes.length && o.colours.length ? "both" : o.sizes.length ? "size" : o.colours.length ? "colour" : "one";
}
/** Every variant to pick from, in staff's order: "M · Black", and whether it can still be had. */
export const choicesOf = (p: StoreProduct, locale: string): { id: string; label: string; open: boolean }[] =>
  p.variants.map((v, i) => ({ id: v.id, label: variantLabel(v, locale) || String(i + 1), open: v.stock > 0 }));

/** Whether one more of each of these variants fits the cart (an add-on's Add, the starter set's "Add the set"): "most"
 *  when one is sold out or the cart already holds the most of it that can be ordered (10, or what is left), "full" when
 *  its new lines would take the cart past its 20, else "ok". Given their products (the product-management build
 *  2026-11-19), a pre-order counts no stock and a product's limit per order counts all its lines (lib/cart.ts roomFor). */
export function cartRoom(cart: readonly { variant: string; qty: number }[], vs: readonly StoreVariant[], products: readonly StoreProduct[] = []): "ok" | "most" | "full" {
  const inCart = (v: StoreVariant) => cart.find((l) => l.variant === v.id.toLowerCase())?.qty ?? 0;
  const of = (v: StoreVariant) => products.find((p) => p.id === v.product_id);
  if (vs.some((v) => { const p = of(v); return p ? roomFor(cart, p, v) <= 0 : v.stock <= 0 || inCart(v) >= Math.min(MAX_QTY, v.stock); })) return "most";
  const fresh = new Set(vs.map((v) => v.id.toLowerCase()).filter((id) => !cart.some((l) => l.variant === id))).size;
  return cart.length + fresh > MAX_LINES ? "full" : "ok";
}

// ── F10, O09-B: the comparison ───────────────────────────────────────────────────────────────────

/** The key specifications a comparison row can carry, in the order the rows go ("other" says nothing alone). */
export const COMPARE_KEYS = KEY_SPEC_ICONS.filter((i) => i !== "other") as Exclude<KeySpecIcon, "other">[];
export type CompareRow = { key: string; label: string | null; values: (string | null)[] };
export type CompareTable = { products: StoreProduct[]; rider: (CmRange | null)[] | null; rows: CompareRow[] };

const keyValue = (p: StoreProduct, icon: KeySpecIcon, locale: string): string | null =>
  p.key_specs.filter((k) => k.icon === icon).map((k) => pick(locale, k.en, k.ar)).join(" · ") || null;
const labelOf = (s: StoreSpec) => (s.en?.[0] ?? "").trim().toLowerCase();

/** This product against the 1-3 staff named to compare with (compare_with, in their order; O09-B), this one first. Rows:
 *  the rider height, then each key specification any of them has ("—" for a bike without it). With no key
 *  specifications on any of them, the specification rows at least two of them share by label (up to 8). Null when there
 *  is nothing to compare with. */
export function compareTable(store: Store, p: StoreProduct, locale: string): CompareTable | null {
  const others = relatedOf(store, p.compare_with, p.id).filter((x) => x.kind !== "gift_card").slice(0, 3);
  if (!others.length) return null;
  const products = [p, ...others];
  const heights = products.map(riderHeight);
  const rider = heights.some(Boolean) ? heights : null;
  const keyRows = COMPARE_KEYS.map((icon) => ({ key: icon, label: null, values: products.map((x) => keyValue(x, icon, locale)) })).filter((r) => r.values.some(Boolean));
  if (keyRows.length) return { products, rider, rows: keyRows };
  const order: string[] = [];
  for (const x of products) for (const s of x.specs) { const k = labelOf(s); if (k && !order.includes(k) && !(rider && RIDER_LABEL.test(k))) order.push(k); }
  const rows = order.map((k): CompareRow => {
    const specs = products.map((x) => x.specs.find((s) => labelOf(s) === k) ?? null);
    const values = specs.map((s) => { const r = s && (locale === "ar" && s.ar ? s.ar : s.en ?? s.ar); return r ? r[1] : null; });
    const first = specs.find((s): s is StoreSpec => !!s) as StoreSpec;
    return { key: `spec:${k}`, label: (locale === "ar" && first.ar ? first.ar : first.en ?? first.ar)?.[0] ?? k, values };
  }).filter((r) => r.values.filter(Boolean).length >= 2).slice(0, 8);
  return { products, rider, rows };
}

// ── F42: reviews ─────────────────────────────────────────────────────────────────────────────────

/** The month a review's product was bought, as the page's language writes it: "Nov 2026". */
export function monthLabel(ym: string, locale: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m || +m[2] < 1 || +m[2] > 12) return ym;
  return new Intl.DateTimeFormat(intlOf(locale), { month: "short", year: "numeric", timeZone: "UTC" }).format(Date.UTC(+m[1], +m[2] - 1, 1));
}
/** Five stars, the first `rating` of them filled (a rating or an average, rounded to a whole star). */
export const starsOf = (rating: number): boolean[] => Array.from({ length: 5 }, (_, i) => i < Math.round(rating));
/** An average as the page writes it: one decimal, a point, Western digits ("4.6"). */
export const avgText = (avg: number): string => (Math.round(avg * 10) / 10).toFixed(1);

// ── F52: trade-in on WhatsApp ────────────────────────────────────────────────────────────────────

/** The store's WhatsApp number, digits only: the site's WhatsApp link when it names one (wa.me/966...), else the phone
 *  staff set under Contact; "" when neither is a number. The same number the buy box's "Ask about this bike" opens
 *  (lib/store-pdp.ts waDigits), so the two WhatsApp rows of one product page never reach two numbers. */
export function waNumber(site: { social?: Record<string, unknown>; contact?: Record<string, unknown> }): string {
  const link = typeof site.social?.whatsapp === "string" ? site.social.whatsapp : "";
  const phone = typeof site.contact?.phone === "string" ? site.contact.phone : "";
  return waDigits(link, phone);
}
/** A WhatsApp chat with the store, its first message written. */
export { waHref };

// ── F45: the product's structured data ───────────────────────────────────────────────────────────

const abs = (u: string) => (/^https?:\/\//.test(u) ? u : `${SITE_URL}${u.startsWith("/") ? "" : "/"}${u}`);

/** schema.org Product for search engines: the name, photos, brand and description in the page's language; the price
 *  with VAT in riyals (one Offer, or an AggregateOffer when its variants cost different amounts), whether it is in
 *  stock, new or used (certified pre-owned), its warranty, the return window the one sentence promises with the
 *  Returns page, and the star average only from five verified buyers' reviews, as the page shows it. Null for a gift
 *  card (its own page). */
export function productLd(p: StoreProduct, x: { locale: string; reviews: readonly StoreReview[] }): object | null {
  if (p.kind === "gift_card") return null;
  const { lo, hi } = priceRange(p);
  const url = langPath(`${SITE_URL}${productHref(p)}`, x.locale);
  const description = (pick(x.locale, p.description_en, p.description_ar) || pick(x.locale, p.tagline_en, p.tagline_ar)).slice(0, 5000);
  const common = {
    priceCurrency: "SAR",
    availability: `https://schema.org/${productStock(p).kind === "out" ? "OutOfStock" : "InStock"}`,
    itemCondition: `https://schema.org/${p.condition === "certified" ? "UsedCondition" : "NewCondition"}`,
    url,
    seller: { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: SITE_NAME },
    hasMerchantReturnPolicy: {
      "@type": "MerchantReturnPolicy",
      applicableCountry: "SA",
      returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
      merchantReturnDays: RETURN_DAYS,
      merchantReturnLink: langPath(`${SITE_URL}/returns`, x.locale),
    },
    warranty: { "@type": "WarrantyPromise", durationOfWarranty: { "@type": "QuantitativeValue", value: warrantyMonths(p), unitCode: "MON" } },
  };
  const offers = lo === hi
    ? { "@type": "Offer", price: lo, ...common, priceSpecification: { "@type": "UnitPriceSpecification", price: lo, priceCurrency: "SAR", valueAddedTaxIncluded: true } }
    : { "@type": "AggregateOffer", lowPrice: lo, highPrice: hi, offerCount: p.variants.length, ...common,
        priceSpecification: { "@type": "PriceSpecification", minPrice: lo, maxPrice: hi, priceCurrency: "SAR", valueAddedTaxIncluded: true } };
  const r = reviewSummary(x.reviews);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${SITE_URL}${productHref(p)}#product`,
    name: pick(x.locale, p.name_en, p.name_ar),
    image: p.images.length ? p.images.slice(0, 6).map(abs) : undefined,
    description: description || undefined,
    brand: p.brand ? { "@type": "Brand", name: p.brand } : undefined,
    url,
    offers,
    aggregateRating: r.avg !== null ? { "@type": "AggregateRating", ratingValue: r.avg, reviewCount: r.count, bestRating: 5, worstRating: 1 } : undefined,
  };
}
