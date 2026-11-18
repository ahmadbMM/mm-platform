import type { SiteContent } from "./site";
import { pick, type BadgeKind, type ProductBadge, type StoreProduct, type StoreSeo, type StoreSort } from "./store-core";

// The store's product-management rules (the build of 2026-11-19, CONTRACT.md sections 2, 5 and 10): which products a page
// shows (live, scheduled, Preview on staging), the mark a card and a product page carry, and the store's own settings
// staff keep in the staff page's Store > Settings (store.banner, store.heading, store.seo, store.sort, store.showStock,
// store.newBadge, store.maxPerOrder, store.minOrder). A setting that is missing or malformed reads as the store was before
// it existed. Pure and browser-safe, so the server's first drawing and the browser's agree and every rule is unit-tested
// (src/lib/__tests__/store-spm.test.ts).

// ── Live, scheduled and Preview ────────────────────────────────────────────────────────────────

/** Whether a product is on sale now, as the database's _store_live decides: published, and inside its publish_at /
 *  unpublish_at window when staff set one. */
export function liveAt(p: Pick<StoreProduct, "published" | "publish_at" | "unpublish_at">, now: number): boolean {
  if (!p.published) return false;
  const from = p.publish_at ? Date.parse(p.publish_at) : NaN, to = p.unpublish_at ? Date.parse(p.unpublish_at) : NaN;
  return !(Number.isFinite(from) && from > now) && !(Number.isFinite(to) && to <= now);
}

/** The products a page shows: every live one, and on the staging site alone the ones staff mark Preview (marked so, never
 *  sold: `preview` stays true only on those). A copy kept from before a product's window opened or closed is read again
 *  at this moment, so a scheduled product comes and goes on time whatever the cache holds. */
export function visibleProducts(products: readonly StoreProduct[], now: number, staging: boolean): StoreProduct[] {
  const out: StoreProduct[] = [];
  for (const p of products) {
    if (liveAt(p, now)) out.push(p.preview ? { ...p, preview: false } : p);
    else if (staging && p.preview) out.push(p);
  }
  return out;
}

/** Whether a product can be put in the cart: never a Preview. */
export const sellable = (p: Pick<StoreProduct, "preview">): boolean => !p.preview;

// ── The store's settings (site_content store.*) ───────────────────────────────────────────────

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const txt = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const int = (v: unknown, lo: number, hi: number): number | null => (typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : null);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const day = (v: unknown): string | null => (typeof v === "string" && DAY.test(v.slice(0, 10)) ? v.slice(0, 10) : null);

export type StoreRules = {
  /** store.maxPerOrder: the most of one product an order holds where the product sets no limit of its own. */
  maxPerOrder: number | null;
  /** store.minOrder: the smallest subtotal (riyals, before delivery) an order may have. */
  minOrder: number | null;
  /** store.newBadge: "New" on a product created in the last `days` days that has no mark of its own. */
  newDays: number | null;
  /** store.showStock: "Only N left" at or under this many (0: never); null: as before the setting (3). */
  lowAt: number | null;
  /** store.sort: the lists' order before the visitor picks one. */
  sort: StoreSort;
};

const SORTS: Record<string, StoreSort> = { featured: "featured", newest: "new", price_asc: "price-asc", price_desc: "price-desc" };

export function storeRules(c: SiteContent | null | undefined): StoreRules {
  const nb = obj(c?.["store.newBadge"]), ss = obj(c?.["store.showStock"]);
  const min = c?.["store.minOrder"];
  const sort = c?.["store.sort"];
  return {
    maxPerOrder: int(c?.["store.maxPerOrder"], 1, 99),
    minOrder: typeof min === "number" && Number.isFinite(min) && min > 0 && min <= 100000 ? Math.round(min * 100) / 100 : null,
    newDays: nb?.on === true ? int(nb.days, 1, 365) ?? 30 : null,
    lowAt: ss ? (ss.on === true ? int(ss.under, 1, 1000) ?? 3 : ss.on === false ? 0 : null) : null,
    sort: typeof sort === "string" && SORTS[sort] ? SORTS[sort] : "featured",
  };
}

// ── A product's mark ───────────────────────────────────────────────────────────────────────────

/** The mark a product shows today (YYYY-MM-DD, Riyadh): staff's own until its last day, else "New" while the store marks
 *  new products (store.newBadge) and this one was created within its days; null for none. */
export function shownBadge(p: Pick<StoreProduct, "badge" | "created_at">, rules: Pick<StoreRules, "newDays">, today: string, now: number): ProductBadge | null {
  const b = p.badge;
  if (b) return !b.until || !DAY.test(today) || today <= b.until ? b : null;
  if (rules.newDays === null) return null;
  const at = Date.parse(p.created_at);
  return Number.isFinite(at) && at <= now && now - at <= rules.newDays * 86400000 ? { kind: "new", en: null, ar: null, until: null } : null;
}

/** The products with the store's settings applied, for every page alike: the limit in force (the product's own, else
 *  store.maxPerOrder), the low-stock mark (store.showStock) and the mark shown today (shownBadge). */
export function withRules(products: readonly StoreProduct[], rules: StoreRules, today: string, now: number): StoreProduct[] {
  return products.map((p) => ({
    ...p,
    max_per_order: p.max_per_order ?? rules.maxPerOrder,
    badge: shownBadge(p, rules, today, now),
    ...(rules.lowAt === null ? {} : { low_at: rules.lowAt }),
  }));
}

/** The words of a mark in the page's language: the store's own word for each kind, staff's for a custom one (Arabic on
 *  an Arabic page when written). */
export type BadgeWords = Record<Exclude<BadgeKind, "custom">, string>;
export const badgeText = (b: ProductBadge, locale: string, w: BadgeWords): string =>
  b.kind === "custom" ? pick(locale, b.en, b.ar) : w[b.kind];

// ── Texts staff write for a page (store.heading, store.seo, a category's and a collection's SEO) ─────────

/** Staff's English on an English page and their Arabic on an Arabic one; the page's own words otherwise (the other
 *  languages keep their translation, and a page whose Arabic staff did not write keeps the store's Arabic). */
export function staffText(locale: string, en: string | null | undefined, ar: string | null | undefined, fallback: string): string {
  const mine = locale === "en" ? en : locale === "ar" ? ar : null;
  return mine && mine.trim() ? mine.trim() : fallback;
}

/** A page's title and description for search engines: staff's (staffText) or the page's own. */
export const seoText = (locale: string, seo: StoreSeo | null | undefined, title: string, description: string) => ({
  title: staffText(locale, seo?.title_en, seo?.title_ar, title),
  description: staffText(locale, seo?.desc_en, seo?.desc_ar, description),
});

export type StoreHeading = { title_en: string | null; title_ar: string | null; intro_en: string | null; intro_ar: string | null };
export function storeHeading(c: SiteContent | null | undefined): StoreHeading {
  const o = obj(c?.["store.heading"]) ?? {};
  return { title_en: txt(o.title_en, 60), title_ar: txt(o.title_ar, 60), intro_en: txt(o.intro_en, 300), intro_ar: txt(o.intro_ar, 300) };
}
export function storeSeo(c: SiteContent | null | undefined): StoreSeo | null {
  const o = obj(c?.["store.seo"]);
  if (!o) return null;
  const s = { title_en: txt(o.title_en, 70), title_ar: txt(o.title_ar, 70), desc_en: txt(o.desc_en, 170), desc_ar: txt(o.desc_ar, 170) };
  return s.title_en || s.title_ar || s.desc_en || s.desc_ar ? s : null;
}

// ── The banner (store.banner) ──────────────────────────────────────────────────────────────────

export const BANNER_TONES = ["brand", "dark", "sale", "info"] as const;
export type BannerTone = (typeof BANNER_TONES)[number];
export type StoreBanner = { en: string; ar: string | null; link: string | null; tone: BannerTone; from: string | null; to: string | null };

/** A link staff may give the banner: a page of this site ("/store/..."), or an https address. */
export const bannerLink = (v: unknown): string | null => {
  const s = txt(v, 300);
  if (!s) return null;
  return (s.startsWith("/") && !s.startsWith("//") && !/[\s\\]/.test(s)) || /^https:\/\/[^\s]+$/i.test(s) ? s : null;
};

/** The banner as staff set it, or null while it is off or has no English. */
export function storeBanner(c: SiteContent | null | undefined): StoreBanner | null {
  const o = obj(c?.["store.banner"]);
  const en = o && txt(o.en, 200);
  if (!o || o.on !== true || !en) return null;
  const tone = (BANNER_TONES as readonly string[]).includes(String(o.tone)) ? (o.tone as BannerTone) : "brand";
  return { en, ar: txt(o.ar, 200), link: bannerLink(o.link), tone, from: day(o.from), to: day(o.to) };
}

/** The banner a store page shows today (YYYY-MM-DD, Riyadh): between its dates, both days included. */
export const bannerToday = (b: StoreBanner | null, today: string): StoreBanner | null =>
  b && (!b.from || today >= b.from) && (!b.to || today <= b.to) ? b : null;

// ── The smallest order (store.minOrder) ────────────────────────────────────────────────────────

/** How much more the cart needs before it can be ordered (the database's STORE_MIN_ORDER: the lines' subtotal, gift
 *  cards counted, delivery not); 0 when it is enough or there is no minimum. */
export function minOrderLeft(min: number | null, subtotal: number): number {
  if (min === null || !(min > 0)) return 0;
  const left = Math.round((min - subtotal) * 100) / 100;
  return left > 0 ? left : 0;
}
