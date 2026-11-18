import { catImage } from "./store-cats";
import { CATEGORY_SLUG, seoOf, sortProducts, wasPrice, type StoreProduct, type StoreSeo } from "./store-core";

// The store's collections (the product-management build 2026-11-19, CONTRACT.md section 4: store_collections and
// store_collection_items): a list staff name and fill (manual), or one the store fills itself - the newest products, what
// is on sale, the best sellers (store_bestsellers). Each has its own page (/store/collection/<slug>), and the ones staff
// put on the store page are sections there, in staff's order. Row security shows the public only a collection that is
// visible and inside its dates; the dates are checked here again, on the Riyadh day, for a copy kept from before. Pure
// and browser-safe; read by lib/store.ts loadColls.

export const COLL_KINDS = ["manual", "new", "sale", "best"] as const;
export type CollKind = (typeof COLL_KINDS)[number];
export type StoreColl = {
  slug: string;
  name_en: string;
  name_ar: string | null;
  blurb_en: string | null;
  blurb_ar: string | null;
  image: string | null;
  sort: number;
  /** A section on the store page. */
  on_store: boolean;
  /** YYYY-MM-DD, both days included; null: open on that side. */
  starts_on: string | null;
  ends_on: string | null;
  kind: CollKind;
  /** How far back "new" and "best" look, in days. */
  days: number;
  /** The most products its section on the store page shows. */
  max_items: number;
  seo: StoreSeo | null;
  /** A manual collection's product ids (lower case), in staff's order. */
  items: string[];
};

const txt = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const int = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : d);
const day = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.slice(0, 10)) ? v.slice(0, 10) : null);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The rows as read: the collections with their items, in staff's order; a malformed row is left out. */
export function collsOf(rows: readonly Record<string, unknown>[] | null | undefined, itemRows: readonly Record<string, unknown>[] | null | undefined): StoreColl[] {
  const items = new Map<string, { id: string; sort: number }[]>();
  for (const r of itemRows ?? []) {
    const c = txt(r.collection, 41), id = typeof r.product_id === "string" && UUID.test(r.product_id) ? r.product_id.toLowerCase() : null;
    if (!c || !id) continue;
    items.set(c, [...(items.get(c) ?? []), { id, sort: typeof r.sort === "number" ? r.sort : 0 }]);
  }
  const out: StoreColl[] = [];
  for (const r of rows ?? []) {
    const slug = txt(r.slug, 41), name = txt(r.name_en, 60);
    if (!slug || !CATEGORY_SLUG.test(slug) || !name || out.some((c) => c.slug === slug)) continue;
    const kind = (COLL_KINDS as readonly string[]).includes(String(r.kind)) ? (r.kind as CollKind) : "manual";
    out.push({
      slug, name_en: name, name_ar: txt(r.name_ar, 60), blurb_en: txt(r.blurb_en, 400), blurb_ar: txt(r.blurb_ar, 400), image: catImage(r.image),
      sort: typeof r.sort === "number" && Number.isFinite(r.sort) ? r.sort : 0, on_store: r.on_store === true,
      starts_on: day(r.starts_on), ends_on: day(r.ends_on), kind, days: int(r.days, 1, 365, 30), max_items: int(r.max_items, 1, 48, 12), seo: seoOf(r),
      items: [...new Set((items.get(slug) ?? []).sort((a, b) => a.sort - b.sort).map((x) => x.id))],
    });
  }
  return out.sort((a, b) => a.sort - b.sort || a.name_en.localeCompare(b.name_en));
}

/** Whether a collection is open today (YYYY-MM-DD, Riyadh): between its dates, both days included. */
export const collOpen = (c: Pick<StoreColl, "starts_on" | "ends_on">, today: string): boolean =>
  (!c.starts_on || c.starts_on <= today) && (!c.ends_on || c.ends_on >= today);

/** What a collection is filled from besides its own items: today, the clock, the discount licence (a sale is a former
 *  price shown) and the best sellers' product ids for a number of days (store_bestsellers, best first). */
export type CollCtx = { today: string; now: number; licence: string | boolean | null; best: (days: number) => readonly string[] };

/** Whether a product is on sale: its former price shows (beside the discount licence, between its dates), or staff mark
 *  it Sale. */
export const onSale = (p: StoreProduct, licence: string | boolean | null, today: string): boolean =>
  wasPrice(p, licence, today) !== null || p.badge?.kind === "sale";

/** A collection's products, all of them, in its order: staff's for a manual one, newest first for "new", the store's
 *  order for "sale", best first for "best". Only products the page shows (the store holds no other). */
export function collProducts(c: StoreColl, products: readonly StoreProduct[], ctx: CollCtx): StoreProduct[] {
  const byId = new Map(products.map((p) => [p.id.toLowerCase(), p]));
  const ids = (list: readonly string[]) => list.map((id) => byId.get(id.toLowerCase())).filter((p): p is StoreProduct => !!p);
  if (c.kind === "manual") return ids(c.items);
  if (c.kind === "best") return ids(ctx.best(c.days));
  if (c.kind === "sale") return sortProducts(products.filter((p) => onSale(p, ctx.licence, ctx.today)), "featured");
  const since = ctx.now - c.days * 86400000;
  return products.filter((p) => { const at = Date.parse(p.created_at); return Number.isFinite(at) && at >= since; })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** A product list in this order for the lists' "Featured": each takes its place in the collection as its order. */
export const inCollOrder = (products: readonly StoreProduct[]): StoreProduct[] => products.map((p, i) => ({ ...p, sort: i }));

export type CollSection = { coll: StoreColl; products: StoreProduct[]; more: boolean };
/** The store page's sections: the collections staff put there that are open today and have a product, in staff's order,
 *  each with its first `max_items` products (`more`: its page has more). */
export function storeSections(colls: readonly StoreColl[], products: readonly StoreProduct[], ctx: CollCtx): CollSection[] {
  return colls.filter((c) => c.on_store && collOpen(c, ctx.today)).flatMap((coll) => {
    const all = collProducts(coll, products, ctx);
    return all.length ? [{ coll, products: all.slice(0, coll.max_items), more: all.length > coll.max_items }] : [];
  });
}

/** The best sellers as store_bestsellers answers them ([{product_id, units}], best first): their product ids. */
export function bestIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>).product_id : null))
    .filter((id): id is string => typeof id === "string" && UUID.test(id)).map((id) => id.toLowerCase()))];
}
