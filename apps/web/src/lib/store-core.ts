// The online store's products as the pages use them (lib/store.ts reads them): their types, the rules
// for prices, stock and choices, and how amounts are written. Nothing here reads anything, so the browser's
// components can use it too.
import { paySettings } from "./pay/settings";
import type { SiteContent } from "./site";

export const STORE_CATEGORIES = ["bikes", "accessories", "apparel", "parts", "nutrition", "gift"] as const;
export type StoreCategory = (typeof STORE_CATEGORIES)[number];

/** One line of a product's specifications in both languages: {en: [label, value], ar: [label, value]}. */
export type StoreSpec = { en?: [string, string]; ar?: [string, string] };

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

/** The two tables' rows as products with their variants; a row the pages could not draw is left out. */
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
    out.push({
      id, slug, category: p.category, brand: str(p.brand), name_en: name, name_ar: str(p.name_ar),
      tagline_en: str(p.tagline_en), tagline_ar: str(p.tagline_ar), description_en: str(p.description_en), description_ar: str(p.description_ar),
      specs: (Array.isArray(p.specs) ? p.specs : []).map(specOf).filter((s): s is StoreSpec => !!s),
      images: (Array.isArray(p.images) ? p.images : []).filter((u): u is string => typeof u === "string" && /^(\/(site|media)\/|https:\/\/)/.test(u)),
      price, compare_at: compare !== null && compare > price ? compare : null, ship_ksa: p.ship_ksa !== false,
      sort: Number.isFinite(num(p.sort)) ? num(p.sort) : 0, created_at: str(p.created_at) ?? "",
      variants: (byProduct.get(id) ?? []).sort((a, b) => a.sort - b.sort),
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

/** The variant a size and a colour name: each only where the product comes in them. Null until both are picked. */
export function pickVariant(p: StoreProduct, size: string | null, colour: string | null): StoreVariant | null {
  const o = optionsOf(p);
  if ((o.sizes.length && !size) || (o.colours.length && !colour)) return null;
  return p.variants.find((v) => (!o.sizes.length || v.size === size) && (!o.colours.length || v.color_en === colour)) ?? null;
}

/** Whether a size (or a colour) can still be had, with the other choice as it stands. */
export function optionOpen(p: StoreProduct, dim: "size" | "colour", value: string, other: string | null): boolean {
  return p.variants.some((v) => v.stock > 0 && (dim === "size" ? v.size === value && (!other || v.color_en === other) : v.color_en === value && (!other || v.size === other)));
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
