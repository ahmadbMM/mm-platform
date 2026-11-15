// The online store's products as the pages use them (lib/store.ts reads them): their types, the rules
// for prices, stock and choices, and how amounts are written. Nothing here reads anything, so the browser's
// components can use it too.
import { paySettings } from "./pay/settings";
import type { SiteContent } from "./site";

export const STORE_CATEGORIES = ["bikes", "accessories", "apparel", "parts", "nutrition", "gift"] as const;
export type StoreCategory = (typeof STORE_CATEGORIES)[number];

/** One line of a product's specifications in both languages: {en: [label, value], ar: [label, value]}. */
export type StoreSpec = { en?: [string, string]; ar?: [string, string] };

// ── The product's richer fields (store build 2026-11-15, rentals migration 20261115200100; CONTRACTS.md section 2) ──

/** A text staff write in English, and in Arabic when they have it. */
export type StoreBi = { en: string; ar: string | null };
export type ProductKind = "item" | "gift_card";
export type ProductCondition = "new" | "certified";
/** The drawn icons a key-spec chip can carry (F24): components/store/icons.tsx draws each. */
export const KEY_SPEC_ICONS = ["weight", "gears", "brakes", "wheel", "frame", "fork", "tyre", "battery", "motor", "range", "material", "other"] as const;
export type KeySpecIcon = (typeof KEY_SPEC_ICONS)[number];
/** The drawn icons a "What's in the box" row can carry (F37). */
export const BOX_ICONS = ["bike", "pedals", "tools", "manual", "charger", "battery", "lights", "bell", "reflectors", "bag", "bottle", "other"] as const;
export type BoxIcon = (typeof BOX_ICONS)[number];
export type KeySpec = { icon: KeySpecIcon; en: string; ar: string | null };
export type BoxItem = { icon: BoxIcon; en: string; ar: string | null };
/** The apparel fit panel (F38): three rows, each optional. */
export type FitPanel = { fit: StoreBi | null; size: StoreBi | null; best: StoreBi | null };
export type FaqItem = { q: StoreBi; a: StoreBi };
/** Centimetres; an open end ("190+") is null. */
export type CmRange = { min: number | null; max: number | null };
/** One size's fit (F20-F22): a bike's rider height, a jersey's chest and waist. `size` is a variant's size. */
export type SizeRow = { size: string; height: CmRange | null; chest: CmRange | null; waist: CmRange | null };
/** What staff wrote about one photo (X10, F104) and the colour it shows (F18), keyed by the images[] entry. */
export type PhotoMeta = { alt_en: string | null; alt_ar: string | null; colour: string | null };
/** One price for this product with 1-3 others (F31); shown and charged only beside a discount licence. */
export type Bundle = { items: string[]; price: number };
/** A verified buyer's review staff chose to show (F42): no name, only the month it was bought. */
export type StoreReview = { id: string; product_id: string; rating: number; body: string | null; lang: string | null; bought: string };

export type StoreVariant = {
  id: string;
  product_id: string;
  size: string | null;
  color_en: string | null;
  color_ar: string | null;
  /** "#rrggbb" or null. */
  color_hex: string | null;
  /** null: the product's price. */
  price: number | null;
  /** What can still be sold. */
  stock: number;
  sort: number;
};

export type StoreProduct = {
  id: string;
  slug: string;
  category: StoreCategory;
  brand: string | null;
  name_en: string;
  name_ar: string | null;
  tagline_en: string | null;
  tagline_ar: string | null;
  description_en: string | null;
  description_ar: string | null;
  specs: StoreSpec[];
  /** /site/... or /media/... paths, or https addresses. */
  images: string[];
  price: number;
  /** A real former price. Shown only beside a Ministry of Commerce discount licence (discountLicence). */
  compare_at: number | null;
  /** false: showroom pickup or Jeddah delivery only (bikes). */
  ship_ksa: boolean;
  sort: number;
  created_at: string;
  variants: StoreVariant[];
  /** "gift_card": each variant is one face value; its page is /store/gift-card (F57). */
  kind: ProductKind;
  /** "certified": a certified pre-owned (ex-rental) bike, with its 1-year warranty (F53). */
  condition: ProductCondition;
  /** null: the legal minimum (warrantyMonths). */
  warranty_months: number | null;
  key_specs: KeySpec[];
  box: BoxItem[];
  fit: FitPanel | null;
  faq: FaqItem[];
  sizes: SizeRow[];
  image_meta: Record<string, PhotoMeta>;
  /** Product ids: the add-ons (F30, F60, F66), the bikes to compare with (F10), in staff's order. */
  goes_with: string[];
  compare_with: string[];
  bundle: Bundle | null;
  /** YYYY-MM-DD: the discount licence's dates; the former price shows only between them (F107). */
  sale_from: string | null;
  sale_to: string | null;
  /** The /bikes catalogue's model this product sells (F12). */
  catalog_model: string | null;
};

export type Store = { products: StoreProduct[] };

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN);
const isCat = (v: unknown): v is StoreCategory => typeof v === "string" && (STORE_CATEGORIES as readonly string[]).includes(v);

function specOf(v: unknown): StoreSpec | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const pair = (x: unknown): [string, string] | undefined =>
    Array.isArray(x) && x.length === 2 && typeof x[0] === "string" && typeof x[1] === "string" && x[0].trim() && x[1].trim() ? [x[0].trim(), x[1].trim()] : undefined;
  const en = pair(o.en), ar = pair(o.ar);
  return en || ar ? { en, ar } : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const list = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);
const txt = (v: unknown, max: number) => { const t = str(v); return t ? t.slice(0, max) : null; };
const keep = <T,>(xs: (T | null)[]): T[] => xs.filter((x): x is T => x !== null);

/** {en, ar} with an English text (Arabic optional), or null. */
export function biOf(v: unknown, max = 400): StoreBi | null {
  const o = obj(v);
  const en = o && txt(o.en, max);
  return o && en ? { en, ar: txt(o.ar, max) } : null;
}
const iconRow = <I extends string>(icons: readonly I[], max: number) => (v: unknown): { icon: I; en: string; ar: string | null } | null => {
  const o = obj(v);
  const en = o && txt(o.en, max);
  if (!o || !en) return null;
  return { icon: (icons as readonly string[]).includes(String(o.icon)) ? (o.icon as I) : ("other" as I), en, ar: txt(o.ar, max) };
};
function cmOf(v: unknown): CmRange | null {
  const o = obj(v);
  if (!o) return null;
  const cm = (x: unknown) => (typeof x === "number" && Number.isInteger(x) && x >= 50 && x <= 230 ? x : null);
  const min = cm(o.min), max = cm(o.max);
  if (min === null && max === null) return null;
  return min !== null && max !== null && max < min ? null : { min, max };
}
function sizeRowOf(v: unknown): SizeRow | null {
  const o = obj(v);
  const size = o && txt(o.size, 20);
  if (!o || !size) return null;
  const r = { size, height: cmOf(o.height), chest: cmOf(o.chest), waist: cmOf(o.waist) };
  return r.height || r.chest || r.waist ? r : null;
}
function fitOf(v: unknown): FitPanel | null {
  const o = obj(v);
  if (!o) return null;
  const f = { fit: biOf(o.fit, 80), size: biOf(o.size, 120), best: biOf(o.best, 120) };
  return f.fit || f.size || f.best ? f : null;
}
function faqOf(v: unknown): FaqItem | null {
  const o = obj(v);
  const q = o && biOf(o.q, 200), a = o && biOf(o.a, 1500);
  return q && a ? { q, a } : null;
}
function metaOf(v: unknown, images: string[]): Record<string, PhotoMeta> {
  const o = obj(v) ?? {};
  const out: Record<string, PhotoMeta> = {};
  for (const src of images) {
    const m = obj(o[src]);
    if (!m) continue;
    const meta = { alt_en: txt(m.alt_en, 200), alt_ar: txt(m.alt_ar, 200), colour: txt(m.colour, 30) };
    if (meta.alt_en || meta.alt_ar || meta.colour) out[src] = meta;
  }
  return out;
}
const idsOf = (v: unknown, max: number, self: string): string[] =>
  [...new Set(list(v, 20).filter((x): x is string => typeof x === "string" && UUID.test(x)).map((x) => x.toLowerCase()))].filter((x) => x !== self.toLowerCase()).slice(0, max);
function bundleOf_(v: unknown, self: string): Bundle | null {
  const o = obj(v);
  if (!o) return null;
  const items = idsOf(o.items, 3, self), price = num(o.price);
  return items.length && price > 0 && price <= 100000 ? { items, price } : null;
}

/** The two tables' rows as products with their variants; a row the pages could not draw is left out. Every field the
 *  store build added (CONTRACTS.md section 2) is read here; a malformed element is dropped, never the product, and a
 *  database without those columns yet reads as a product without them. */
export function storeOf(products: Record<string, unknown>[], variants: Record<string, unknown>[]): Store {
  const byProduct = new Map<string, StoreVariant[]>();
  for (const v of variants) {
    const id = str(v.id), pid = str(v.product_id), price = v.price == null ? null : num(v.price), stock = num(v.stock);
    if (!id || !pid || (price !== null && !(price > 0)) || !Number.isFinite(stock)) continue;
    const hex = str(v.color_hex);
    const list = byProduct.get(pid) ?? [];
    list.push({ id, product_id: pid, size: str(v.size), color_en: str(v.color_en), color_ar: str(v.color_ar), color_hex: hex && /^#[0-9a-f]{6}$/i.test(hex) ? hex : null,
      price, stock: Math.max(0, Math.floor(stock)), sort: Number.isFinite(num(v.sort)) ? num(v.sort) : 0 });
    byProduct.set(pid, list);
  }
  const out: StoreProduct[] = [];
  for (const p of products) {
    const id = str(p.id), slug = str(p.slug), name = str(p.name_en), price = num(p.price);
    if (!id || !slug || !name || !isCat(p.category) || !(price > 0)) continue;
    const compare = p.compare_at == null ? null : num(p.compare_at);
    const images = (Array.isArray(p.images) ? p.images : []).filter((u): u is string => typeof u === "string" && /^(\/(site|media)\/|https:\/\/)/.test(u));
    const condition: ProductCondition = p.condition === "certified" ? "certified" : "new";
    const wm = num(p.warranty_months);
    const day = (v: unknown) => (typeof v === "string" && DAY.test(v.slice(0, 10)) ? v.slice(0, 10) : null);
    out.push({
      id, slug, category: p.category, brand: str(p.brand), name_en: name, name_ar: str(p.name_ar),
      tagline_en: str(p.tagline_en), tagline_ar: str(p.tagline_ar), description_en: str(p.description_en), description_ar: str(p.description_ar),
      specs: (Array.isArray(p.specs) ? p.specs : []).map(specOf).filter((s): s is StoreSpec => !!s),
      images,
      price, compare_at: compare !== null && compare > price ? compare : null, ship_ksa: p.ship_ksa !== false,
      sort: Number.isFinite(num(p.sort)) ? num(p.sort) : 0, created_at: str(p.created_at) ?? "",
      variants: (byProduct.get(id) ?? []).sort((a, b) => a.sort - b.sort),
      kind: p.kind === "gift_card" && p.category === "gift" ? "gift_card" : "item",
      condition,
      warranty_months: Number.isInteger(wm) && wm >= 12 && wm <= 120 ? wm : null,
      key_specs: keep(list(p.key_specs, 6).map(iconRow(KEY_SPEC_ICONS, 40))),
      box: keep(list(p.box, 12).map(iconRow(BOX_ICONS, 80))),
      fit: fitOf(p.fit),
      faq: keep(list(p.faq, 8).map(faqOf)),
      sizes: keep(list(p.sizes, 12).map(sizeRowOf)),
      image_meta: metaOf(p.image_meta, images),
      goes_with: idsOf(p.goes_with, 8, id),
      compare_with: idsOf(p.compare_with, 3, id),
      bundle: bundleOf_(p.bundle, id),
      sale_from: day(p.sale_from), sale_to: day(p.sale_to),
      catalog_model: typeof p.catalog_model === "string" && UUID.test(p.catalog_model) ? p.catalog_model.toLowerCase() : null,
    });
  }
  return { products: out };
}

// ── The store's switch ────────────────────────────────────────────────────────────────────────────

/** The website's own store is open when staff opened it (store.open) and payments are on (pay.enabled);
 *  until then /store forwards to the Salla shop (proxy.ts). */
export function storeOpen(content: SiteContent | null | undefined): boolean {
  const s = paySettings(content);
  return s.enabled && s.storeOpen;
}

/** The Ministry of Commerce licence a shown discount needs (store.discountLicence); null: no former price is shown. */
export function discountLicence(content: SiteContent | null | undefined): string | null {
  const v = content?.["store.discountLicence"];
  return typeof v === "string" && v.trim() ? v.trim().slice(0, 40) : null;
}

// ── A product ─────────────────────────────────────────────────────────────────────────────────────

/** Arabic on an Arabic page when it is written; English everywhere else (product names, brands and
 *  specifications are not translated, as in the bike catalogue). */
export function pick(locale: string, en: string | null | undefined, ar: string | null | undefined): string {
  if (locale === "ar" && ar && ar.trim()) return ar.trim();
  return (en ?? "").trim();
}

export const findProduct = (store: Store, slug: string): StoreProduct | null => store.products.find((p) => p.slug === slug) ?? null;
export const findVariant = (store: Store, id: string): { product: StoreProduct; variant: StoreVariant } | null => {
  for (const product of store.products) {
    const variant = product.variants.find((v) => v.id === id);
    if (variant) return { product, variant };
  }
  return null;
};

export const variantPrice = (p: StoreProduct, v: StoreVariant): number => v.price ?? p.price;

/** The lowest and highest price of the product's variants (the product's own when it has none). */
export function priceRange(p: StoreProduct): { lo: number; hi: number } {
  const prices = p.variants.length ? p.variants.map((v) => variantPrice(p, v)) : [p.price];
  return { lo: Math.min(...prices), hi: Math.max(...prices) };
}

export type StockState = { kind: "out" } | { kind: "low"; left: number } | { kind: "in" };
/** Sold out at 0, "Only N left" at 1 to 3. */
export function stockState(stock: number): StockState {
  if (stock <= 0) return { kind: "out" };
  if (stock <= 3) return { kind: "low", left: stock };
  return { kind: "in" };
}
/** The product as a whole: sold out when no variant can be sold; low when all it has left is 1 to 3. */
export const productStock = (p: StoreProduct): StockState => stockState(p.variants.reduce((n, v) => n + v.stock, 0));

/** "M · Black": the variant's size and colour in the page's language, or "" when it has neither. */
export const variantLabel = (v: StoreVariant, locale: string) => [v.size, pick(locale, v.color_en, v.color_ar)].filter(Boolean).join(" · ");

/** What a customer picks from: the sizes and the colours the product's variants come in, in staff's order. */
export type Colour = { key: string; en: string; ar: string | null; hex: string | null };
export function optionsOf(p: StoreProduct): { sizes: string[]; colours: Colour[] } {
  const sizes: string[] = [], colours: Colour[] = [];
  for (const v of p.variants) {
    if (v.size && !sizes.includes(v.size)) sizes.push(v.size);
    if (v.color_en && !colours.some((c) => c.key === v.color_en)) colours.push({ key: v.color_en, en: v.color_en, ar: v.color_ar, hex: v.color_hex });
  }
  return { sizes, colours };
}

/** The variant a size and a colour name: each only where the product comes in them. Null until both are picked. A
 *  variant without a size (or a colour) where others of the product have one fits any pick of it (bug hunt 2026-11-11:
 *  it could never be bought), after one that names the pick exactly. */
export function pickVariant(p: StoreProduct, size: string | null, colour: string | null): StoreVariant | null {
  const o = optionsOf(p);
  if ((o.sizes.length && !size) || (o.colours.length && !colour)) return null;
  return p.variants.find((v) => (!o.sizes.length || v.size === size) && (!o.colours.length || v.color_en === colour))
    ?? p.variants.find((v) => (!o.sizes.length || !v.size || v.size === size) && (!o.colours.length || !v.color_en || v.color_en === colour)) ?? null;
}

/** Whether a size (or a colour) can still be had, with the other choice as it stands; a variant without the size (or
 *  the colour) has every one of it, as pickVariant reads it. */
export function optionOpen(p: StoreProduct, dim: "size" | "colour", value: string, other: string | null): boolean {
  return p.variants.some((v) => v.stock > 0 && (dim === "size"
    ? (!v.size || v.size === value) && (!other || !v.color_en || v.color_en === other)
    : (!v.color_en || v.color_en === value) && (!other || !v.size || v.size === other)));
}

/** The product's specifications in the page's language: Arabic rows on an Arabic page where written, else English. */
export const specRows = (p: StoreProduct, locale: string): [string, string][] =>
  p.specs.map((s) => (locale === "ar" && s.ar ? s.ar : s.en ?? s.ar)).filter((r): r is [string, string] => !!r);

/** A description as paragraphs (blank lines between them). */
export const paragraphs = (text: string) => text.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);

export type StoreSort = "featured" | "price-asc" | "price-desc" | "new";
export const STORE_SORTS: readonly StoreSort[] = ["featured", "price-asc", "price-desc", "new"];

/** The list in the order asked for; sold-out products go last in every order but staff's own. */
export function sortProducts(list: StoreProduct[], sort: StoreSort): StoreProduct[] {
  const out = [...list];
  const lo = (p: StoreProduct) => priceRange(p).lo;
  const by: Record<StoreSort, (a: StoreProduct, b: StoreProduct) => number> = {
    featured: (a, b) => a.sort - b.sort || a.name_en.localeCompare(b.name_en),
    "price-asc": (a, b) => lo(a) - lo(b),
    "price-desc": (a, b) => lo(b) - lo(a),
    new: (a, b) => b.created_at.localeCompare(a.created_at),
  };
  out.sort(by[sort]);
  if (sort !== "featured") out.sort((a, b) => Number(productStock(a).kind === "out") - Number(productStock(b).kind === "out"));
  return out;
}

/** The categories that have a product, in the store's order. */
export const categoriesIn = (store: Store): StoreCategory[] => STORE_CATEGORIES.filter((c) => store.products.some((p) => p.category === c));

/** A riyal amount as the booking app writes it (_sar): the riyal sign (U+20C1, the MM Riyal font of
 *  store.css .tk-amt) left of the number, the whole isolated left-to-right; grouped, cents only when there are any. */
export function sar(n: number): string {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  const s = v.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
  return `\u2066\u20c1 ${s}\u2069`;
}

/** The VAT inside a VAT-inclusive amount (15%), as the database writes it on the order (_store_order_json). */
export const vatIn = (total: number) => Math.round(total * 15 / 115 * 100) / 100;

// ── The store build's rules (2026-11-15, CONTRACTS.md section 2) ─────────────────────────────────

/** A staff text in the page's language: the Arabic on an Arabic page when written, the English everywhere else. */
export const pickBi = (locale: string, b: StoreBi | null | undefined): string => (b ? pick(locale, b.en, b.ar) : "");

/** Where a product's page is: a gift card's is the gift card page (F57). */
export const productHref = (p: Pick<StoreProduct, "slug" | "kind">): string => (p.kind === "gift_card" ? "/store/gift-card" : `/store/${p.slug}`);
/** A category's own list page (O01-E). */
export const categoryHref = (cat: StoreCategory): string => `/store/category/${cat}`;
export const isStoreCategory = isCat;

/** What staff wrote about a photo, in the page's language (Arabic falls back to the English); "" when nothing (X10). */
export function photoAlt(p: StoreProduct, src: string, locale: string): string {
  const m = p.image_meta[src];
  return m ? pick(locale, m.alt_en, m.alt_ar) : "";
}

/** The photos to show while a colour is picked (F18): those of that colour first, then those of no colour; another
 *  colour's photos are left out. With no colour picked, or none tagged with it, every photo in staff's order. */
export function photosFor(p: StoreProduct, colour: string | null): string[] {
  if (!colour || !p.images.some((src) => p.image_meta[src]?.colour === colour)) return p.images;
  const of = (src: string) => p.image_meta[src]?.colour ?? null;
  return [...p.images.filter((src) => of(src) === colour), ...p.images.filter((src) => of(src) === null)];
}

/** The photo a colour chip shows (D15-B): the first photo of that colour, or null. */
export const colourPhoto = (p: StoreProduct, colour: string): string | null => p.images.find((src) => p.image_meta[src]?.colour === colour) ?? null;

/** The photo a line of the cart, checkout or an add-on card shows for its variant: the first photo of the variant's
 *  colour, else the product's first photo. The database snapshots the same photo on the order's line (store_checkout,
 *  X08), so the cart, checkout and the order page show one picture of what was bought. */
export const linePhoto = (p: StoreProduct, v: Pick<StoreVariant, "color_en"> | null | undefined): string | null =>
  (v?.color_en ? colourPhoto(p, v.color_en) : null) ?? p.images[0] ?? null;
/** The photos linePhoto can answer for one of the product's variants (its first photo, then each colour's first), in the
 *  product's order: what a small card's product keeps when the rest of its photos are left out. */
export function linePhotos(p: StoreProduct): string[] {
  const keep = new Set([p.images[0], ...p.variants.map((v) => linePhoto(p, v))].filter((x): x is string => !!x));
  return p.images.filter((src) => keep.has(src));
}

/** The former price to strike through (F107, R8): only beside a discount licence and, when staff set the licence's dates,
 *  between them (today a YYYY-MM-DD in Riyadh); null otherwise. */
export function wasPrice(p: Pick<StoreProduct, "compare_at" | "sale_from" | "sale_to">, licence: string | boolean | null, today: string): number | null {
  if (!licence || p.compare_at === null) return null;
  if (p.sale_from && today < p.sale_from) return null;
  if (p.sale_to && today > p.sale_to) return null;
  return p.compare_at;
}

/** The fit staff gave a size (F20), or null. */
export const sizeRow = (p: StoreProduct, size: string): SizeRow | null => p.sizes.find((r) => r.size === size) ?? null;
const inCm = (r: CmRange | null, cm: number) => !!r && (r.min === null || cm >= r.min) && (r.max === null || cm <= r.max);
/** The size a rider of this height fits (F22): the first row whose height range holds it, among the sizes the product
 *  comes in; null when none does or the height is not 50-230 cm. */
export function sizeForHeight(p: StoreProduct, cm: number): string | null {
  if (!Number.isFinite(cm) || cm < 50 || cm > 230) return null;
  const sizes = optionsOf(p).sizes;
  return p.sizes.find((r) => inCm(r.height, cm) && (!sizes.length || sizes.includes(r.size)))?.size ?? null;
}

/** The products these ids name, in their order: published ones only (the store holds no other), never `self`. */
export function relatedOf(store: Store, ids: readonly string[], self?: string): StoreProduct[] {
  const by = new Map(store.products.map((p) => [p.id.toLowerCase(), p]));
  return ids.map((id) => by.get(id.toLowerCase())).filter((p): p is StoreProduct => !!p && p.id !== self);
}

/** The starter bundle (F31): this product and its bundle's items at one price, only beside a discount licence, with
 *  every item still in the store and in stock, and a price under what they cost one by one (`save`, the difference,
 *  counted at each product's lowest price). Null otherwise. */
export function bundleOf(store: Store, p: StoreProduct, licence: string | boolean | null):
  { products: StoreProduct[]; price: number; sum: number; save: number } | null {
  if (!licence || !p.bundle || p.kind === "gift_card") return null;
  const items = relatedOf(store, p.bundle.items, p.id);
  if (items.length !== p.bundle.items.length || items.some((x) => x.kind === "gift_card")) return null;
  const all = [p, ...items];
  if (all.some((x) => productStock(x).kind === "out")) return null;
  const sum = Math.round(all.reduce((n, x) => n + priceRange(x).lo, 0) * 100) / 100;
  const save = Math.round((sum - p.bundle.price) * 100) / 100;
  return save > 0 ? { products: all, price: p.bundle.price, sum, save } : null;
}

/** How many reviews a product has and their average: the average only from five reviews on (F42), to one decimal. */
export function reviewSummary(reviews: readonly StoreReview[]): { count: number; avg: number | null } {
  const count = reviews.length;
  if (count < 5) return { count, avg: null };
  return { count, avg: Math.round((reviews.reduce((n, r) => n + r.rating, 0) / count) * 10) / 10 };
}

/** The review rows as read (store_reviews, status shown); a row the page could not draw is left out. */
export function reviewsOf(rows: Record<string, unknown>[]): StoreReview[] {
  const out: StoreReview[] = [];
  for (const r of rows) {
    const id = str(r.id), pid = str(r.product_id), rating = num(r.rating), bought = str(r.bought_month);
    if (!id || !pid || !Number.isInteger(rating) || rating < 1 || rating > 5 || !bought || !/^\d{4}-\d{2}$/.test(bought)) continue;
    out.push({ id, product_id: pid, rating, body: txt(r.body, 1000), lang: str(r.lang), bought });
  }
  return out;
}
