import { MAX_QTY, type CartItem } from "./cart";
import type { PaySettings } from "./pay/settings";
import { deliveryOptions, deliveryRange } from "./store-delivery";
import { warrantyMonths, warrantyParts } from "./store-policy";
import {
  optionsOf, pick, priceRange, productStock, sortProducts, STORE_CATEGORIES, STORE_SORTS, variantPrice,
  type StoreCategory, type StoreProduct, type StoreSort, type StoreVariant,
} from "./store-core";

// The store's lists (store build 2026-11-15, chain w2): /store with its category tiles and every product under them
// (O01-E, F01), a category's own page (F02), Saved (F07) and Recently viewed (F08). The rules here are pure, so the
// browser's list and the server's first drawing agree: the filters (O05-C) and where they sit in the address, the
// delivery chip on a card (F05), quick add (F06), the certified pre-owned section (F53) and the tiles' photos.

// ── Filters (O05-C): price band, size, colour, brand ──────────────────────────────────────────────

export const FILTER_KEYS = ["price", "size", "colour", "brand"] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];
export type ListFilters = Record<FilterKey, string[]>;
export const noFilters = (): ListFilters => ({ price: [], size: [], colour: [], brand: [] });

/** A price band in riyals, VAT included: from `min` (null: from nothing) up to but not including `max` (null: no top). */
export type PriceBand = { id: string; min: number | null; max: number | null };
/** The bands the store's prices fall in (a cap and a light up to a superbike); a band without a product is not offered. */
export const PRICE_BANDS: readonly PriceBand[] = [
  { id: "0-500", min: null, max: 500 },
  { id: "500-2000", min: 500, max: 2000 },
  { id: "2000-5000", min: 2000, max: 5000 },
  { id: "5000-10000", min: 5000, max: 10000 },
  { id: "10000-", min: 10000, max: null },
];
const bandById = new Map(PRICE_BANDS.map((b) => [b.id, b]));
const inBand = (b: PriceBand, n: number) => (b.min === null || n >= b.min) && (b.max === null || n < b.max);
/** Every price the product is sold at (its variants', or its own without any). */
const pricesOf = (p: StoreProduct) => (p.variants.length ? p.variants.map((v) => variantPrice(p, v)) : [p.price]);
/** What can be bought now: the variants with stock. A gift card's face values are no sizes or colours. */
const buyable = (p: StoreProduct): StoreVariant[] => (p.kind === "gift_card" ? [] : p.variants.filter((v) => v.stock > 0));

/** One choice of a filter: its value in the address, and for a colour its English and Arabic names and its dot. */
export type FacetOption = { value: string; en: string; ar: string | null; hex: string | null; band: PriceBand | null };
export type Facet = { key: FilterKey; options: FacetOption[] };

const LETTER_SIZES = ["XXXS", "XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "XXXL", "3XL", "4XL"];
/** Sizes in a shopper's order: letter sizes small to large, then numbers low to high, then anything else as it came. */
export function sortSizes(sizes: readonly string[]): string[] {
  const rank = (s: string, i: number) => {
    const l = LETTER_SIZES.indexOf(s.trim().toUpperCase());
    if (l >= 0) return l;
    const n = Number.parseFloat(s);
    return Number.isFinite(n) && /^\d/.test(s.trim()) ? 100 + n : 100000 + i;
  };
  return sizes.map((s, i) => ({ s, r: rank(s, i) })).sort((a, b) => a.r - b.r).map((x) => x.s);
}

/** The filters these products can be narrowed by: a filter only when it has two choices or more (one choice narrows
 *  nothing), each choice only when a product has it (a size or a colour only in stock). */
export function facetsOf(products: readonly StoreProduct[]): Facet[] {
  const bands = PRICE_BANDS.filter((b) => products.some((p) => pricesOf(p).some((n) => inBand(b, n))));
  const sizes: string[] = [];
  const colours = new Map<string, FacetOption>();
  const brands: string[] = [];
  for (const p of products) {
    for (const v of buyable(p)) {
      if (v.size && !sizes.includes(v.size)) sizes.push(v.size);
      if (v.color_en && !colours.has(v.color_en)) colours.set(v.color_en, { value: v.color_en, en: v.color_en, ar: v.color_ar, hex: v.color_hex, band: null });
    }
    if (p.brand && !brands.includes(p.brand)) brands.push(p.brand);
  }
  const plain = (s: string): FacetOption => ({ value: s, en: s, ar: null, hex: null, band: null });
  const all: Facet[] = [
    { key: "price", options: bands.map((b) => ({ value: b.id, en: b.id, ar: null, hex: null, band: b })) },
    { key: "size", options: sortSizes(sizes).map(plain) },
    { key: "colour", options: [...colours.values()] },
    { key: "brand", options: brands.sort((a, b) => a.localeCompare(b)).map(plain) },
  ];
  return all.filter((f) => f.options.length >= 2);
}

/** Whether a product is one the filters keep: any choice of a filter (or), every filter set (and). A size and a colour
 *  are asked of the same variant in stock, so "M" and "Black" keep a product sold in M in Black. */
export function matches(p: StoreProduct, f: ListFilters): boolean {
  if (f.price.length) {
    const bands = f.price.map((id) => bandById.get(id)).filter((b): b is PriceBand => !!b);
    if (!pricesOf(p).some((n) => bands.some((b) => inBand(b, n)))) return false;
  }
  if (f.brand.length && !(p.brand && f.brand.includes(p.brand))) return false;
  if (f.size.length || f.colour.length) {
    const ok = buyable(p).some((v) => (!f.size.length || (!!v.size && f.size.includes(v.size))) && (!f.colour.length || (!!v.color_en && f.colour.includes(v.color_en))));
    if (!ok) return false;
  }
  return true;
}

export const filterCount = (f: ListFilters) => FILTER_KEYS.reduce((n, k) => n + f[k].length, 0);

/** The filters with only the choices these filters offer (an old link's stale choice is dropped). */
export function cleanFilters(f: ListFilters, facets: readonly Facet[]): ListFilters {
  const out = noFilters();
  for (const fc of facets) out[fc.key] = [...new Set(f[fc.key])].filter((v) => fc.options.some((o) => o.value === v));
  return out;
}

/** The filters and the order a list's address asks for: ?price=500-2000&size=M&size=L&colour=Black&brand=Alvas&sort=price-asc. */
export function listQueryOf(q: Record<string, string | string[] | undefined> | URLSearchParams): { filters: ListFilters; sort: StoreSort } {
  const all = (k: string): string[] => {
    const v = q instanceof URLSearchParams ? q.getAll(k) : q[k];
    return (Array.isArray(v) ? v : typeof v === "string" ? [v] : []).map((s) => s.trim().slice(0, 40)).filter(Boolean).slice(0, 12);
  };
  const filters = noFilters();
  for (const k of FILTER_KEYS) filters[k] = [...new Set(all(k))];
  const s = all("sort")[0] ?? "";
  return { filters, sort: (STORE_SORTS as readonly string[]).includes(s) ? (s as StoreSort) : "featured" };
}

/** The address's query with these filters and this order in it (the defaults left out), other keys kept. */
export function listQueryText(base: string, f: ListFilters, sort: StoreSort): string {
  const q = new URLSearchParams(base);
  for (const k of [...FILTER_KEYS, "sort", "cat"]) q.delete(k);
  for (const k of FILTER_KEYS) for (const v of f[k]) q.append(k, v);
  if (sort !== "featured") q.set("sort", sort);
  // the query as text, not q.size: Safari before 17 has no URLSearchParams.size
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** The list as it is drawn: filtered, in the order asked for, the certified pre-owned products apart (F53). */
export function listOf(products: readonly StoreProduct[], f: ListFilters, sort: StoreSort): { fresh: StoreProduct[]; certified: StoreProduct[] } {
  const shown = sortProducts(products.filter((p) => matches(p, f)), sort);
  return { fresh: shown.filter((p) => p.condition !== "certified"), certified: shown.filter((p) => p.condition === "certified") };
}

// ── A card ───────────────────────────────────────────────────────────────────────────────────────

/** The one variant a card can add straight to the cart (F06): gear sold in one size and one colour, in stock. A bike, a
 *  gift card or anything with a choice to make opens its page instead (a pop-up for a choice is not built). */
export function quickVariant(p: StoreProduct): StoreVariant | null {
  if (p.kind !== "item" || p.category === "bikes" || p.variants.length !== 1) return null;
  const v = p.variants[0];
  return v.stock > 0 ? v : null;
}

/** How many more of a variant the cart can take from a card's quick add: what is in stock, 10 a line at most, less what
 *  the cart already holds (the product page's Add counts the same way, BuyBox `room`). */
export function quickRoom(cart: readonly CartItem[], v: Pick<StoreVariant, "id" | "stock">): number {
  const had = cart.find((l) => l.variant === v.id.toLowerCase())?.qty ?? 0;
  return Math.max(0, Math.min(MAX_QTY, v.stock) - had);
}

/** The colours a card shows as dots (F04): every one the product comes in, in staff's order. */
export const cardColours = (p: StoreProduct) => (p.kind === "gift_card" ? [] : optionsOf(p).colours);

/** The day a card says the product can be had (F05), from the delivery staff set: Jeddah delivery first (the store's
 *  own city), then the courier for what may be shipped, then the showroom's ready day. `by`: the days are a range, so
 *  the card names its last day. Null when no way names its days. */
export type CardWhen = { way: "jeddah" | "ksa" | "pickup"; day: string; by: boolean };
export function cardWhen(s: PaySettings, shipKsa: boolean, today: string): CardWhen | null {
  const ways = deliveryOptions(s, { subtotal: 0, shipKsa });
  for (const id of ["jeddah", "ksa", "pickup"] as const) {
    const o = ways.find((w) => w.id === id);
    const r = o ? deliveryRange(o.days, today) : null;
    if (r) return { way: id, day: r.to, by: r.from !== r.to };
  }
  return null;
}

export type WhenWords = {
  today: string; tomorrow: string; byTomorrow: string; by: (d: string) => string; inJeddah: (d: string) => string;
  readyToday: string; readyTomorrow: string; ready: (d: string) => string;
};
const nextDay = (iso: string) => new Date(Date.parse(`${iso}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
/** The card's chip in the page's language: "Tomorrow in Jeddah", "By Thu 19 Nov in Jeddah", "By Mon 23 Nov" (the courier),
 *  "Ready tomorrow" (the showroom). Written by the server, which has every language's dates. */
export function whenText(w: CardWhen, today: string, intl: string, t: WhenWords): string {
  const rel = w.day === today ? "today" : w.day === nextDay(today) ? "tomorrow" : null;
  const date = new Intl.DateTimeFormat(intl, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${w.day}T12:00:00Z`));
  if (w.way === "pickup") return rel === "today" ? t.readyToday : rel === "tomorrow" ? t.readyTomorrow : t.ready(date);
  const day = w.by ? (rel === "tomorrow" ? t.byTomorrow : t.by(date)) : rel === "today" ? t.today : rel === "tomorrow" ? t.tomorrow : date;
  return w.way === "jeddah" ? t.inJeddah(day) : day;
}

/** The chip a card shows, for the products that may be shipped and for those that may not (bikes): every card of a kind
 *  says the same, so the server writes the two once. */
export type CardWhens = { ship: { text: string; way: CardWhen["way"] } | null; local: { text: string; way: CardWhen["way"] } | null };
export function cardWhens(s: PaySettings, today: string, intl: string, t: WhenWords): CardWhens {
  const of = (ship: boolean) => { const w = cardWhen(s, ship, today); return w ? { text: whenText(w, today, intl, t), way: w.way } : null; };
  return { ship: of(true), local: of(false) };
}
/** A card's chip: none for what is sold out or a gift card (nothing is delivered). */
export const whenFor = (p: StoreProduct, w: CardWhens) =>
  p.kind === "gift_card" || productStock(p).kind === "out" ? null : p.ship_ksa ? w.ship : w.local;

export type WarrantyWords = { year1: string; year2: string; years: (n: string) => string; months: (n: string) => string };
/** A certified pre-owned product's warranty on its card (F53, L09): "1-year warranty", or staff's longer term. */
export function warrantyText(p: Pick<StoreProduct, "condition" | "warranty_months">, t: WarrantyWords): string {
  const m = warrantyMonths(p);
  const { years, months } = warrantyParts(m);
  if (months) return t.months(String(m));
  return years === 1 ? t.year1 : years === 2 ? t.year2 : t.years(String(years));
}

// ── The store page's tiles and the browser-kept rows ────────────────────────────────────────────

/** A tile per category that has a product (O01-E), with the photo of its first product in staff's order that has one
 *  (one in stock first). */
export function categoryTiles(products: readonly StoreProduct[]): { cat: StoreCategory; image: string | null }[] {
  const featured = sortProducts([...products], "featured");
  return STORE_CATEGORIES.flatMap((cat) => {
    const of = featured.filter((p) => p.category === cat);
    if (!of.length) return [];
    const withPhoto = of.filter((p) => p.images.length);
    const p = withPhoto.find((x) => productStock(x).kind !== "out") ?? withPhoto[0];
    return [{ cat, image: p?.images[0] ?? null }];
  });
}

/** The products a kept list names, in its order: a slug no longer in the store is left out; `max` at most. */
export function bySlugs<P extends { slug: string }>(products: readonly P[], slugs: readonly string[], max: number): P[] {
  const by = new Map(products.map((p) => [p.slug, p]));
  return slugs.map((s) => by.get(s)).filter((p): p is P => !!p).slice(0, max);
}

/** A product as the Recently viewed row draws it (F08): its link, name and first photo. */
export type RecentItem = { slug: string; kind: StoreProduct["kind"]; name: string; image: string | null };
export const recentItems = (products: readonly StoreProduct[], locale: string): RecentItem[] =>
  products.map((p) => ({ slug: p.slug, kind: p.kind, name: pick(locale, p.name_en, p.name_ar), image: p.images[0] ?? null }));

/** The most photos a card's strip holds (D06-C). */
export const CARD_PHOTOS = 5;
/** The products as the lists need them: no long texts, the card's photos and their descriptions only. */
export function listProducts(products: readonly StoreProduct[]): StoreProduct[] {
  return products.map((p) => {
    const images = p.images.slice(0, CARD_PHOTOS);
    const image_meta = Object.fromEntries(images.filter((src) => p.image_meta[src]).map((src) => [src, p.image_meta[src]]));
    return { ...p, description_en: null, description_ar: null, tagline_en: null, tagline_ar: null, specs: [], key_specs: [], box: [], fit: null, faq: [], sizes: [],
      goes_with: [], compare_with: [], bundle: null, images, image_meta };
  });
}

/** A product's name in pieces for a right-to-left page (O11-B): each run of Latin letters and numbers ("DA54 MAX", "X1") apart,
 *  for the page to set in a <bdi>, so a model name keeps its own order inside Arabic. A name with no Latin letter is one
 *  plain piece. */
const LATIN_RUN = /[A-Za-z0-9](?:[A-Za-z0-9.\-+/&'×]|\s(?=[A-Za-z0-9]))*/g;
export function latinRuns(text: string): { text: string; latin: boolean }[] {
  const out: { text: string; latin: boolean }[] = [];
  let at = 0;
  for (const m of text.matchAll(LATIN_RUN)) {
    if (!/[A-Za-z]/.test(m[0])) continue;
    if (m.index > at) out.push({ text: text.slice(at, m.index), latin: false });
    out.push({ text: m[0], latin: true });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at), latin: false });
  return out;
}

/** The lowest price a card shows and whether it is a "From" price. */
export const cardPrice = (p: StoreProduct) => { const { lo, hi } = priceRange(p); return { lo, from: lo !== hi }; };
