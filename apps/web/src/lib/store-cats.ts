import { CATEGORY_SLUG, STORE_CATEGORIES, pick, productStock, seoOf, sortProducts, type StoreProduct, type StoreSeo } from "./store-core";

// The store's categories as staff make them (the product-management build 2026-11-19, CONTRACT.md section 3:
// store_categories): any slug, two levels (a category and its sub-categories), each with its English and Arabic name, a
// line about it, a tile photo, its place in the order, its own title and description for search engines, and the filter
// groups its list offers. Until the table can be read (or while it has no row) the store has the six categories it began
// with, drawn exactly as before. Pure and browser-safe; read by lib/store.ts loadCats.

/** The filter groups a category's list may offer (the contract's list); the panel shows them in its own order. */
export const CAT_FILTER_KEYS = ["brand", "size", "colour", "price", "instock", "sale", "condition", "tags"] as const;
export type CatFilter = (typeof CAT_FILTER_KEYS)[number];
/** A category staff made without choosing (the database's default), and the store page's and a collection's list. */
export const DEFAULT_FILTERS: readonly CatFilter[] = ["brand", "size", "colour", "price", "instock"];
/** The groups the store offered before categories were staff's: what the six built-in categories keep. */
export const FALLBACK_FILTERS: readonly CatFilter[] = ["price", "size", "colour", "brand"];

export type StoreCat = {
  slug: string;
  /** The category it sits under, or null for a category of the first level. */
  parent: string | null;
  name_en: string;
  name_ar: string | null;
  blurb_en: string | null;
  blurb_ar: string | null;
  /** A photo of the site's (/site/...) or one staff uploaded (/media/...), or null: the tile then shows its first
   *  product's. */
  image: string | null;
  sort: number;
  seo: StoreSeo | null;
  filters: CatFilter[];
};
/** The categories a page draws: staff's (`table`), or the six built-in ones. `unread`: staff's could not be read (and no
 *  copy of them was kept), so nothing is known of a category outside the six: no product is hidden for being in one. */
export type CatTree = { cats: StoreCat[]; table: boolean; unread?: boolean };

/** The six as the staff page seeded them (English names it showed): a seeded row whose English is still one of these
 *  keeps the site's own translation of its name in the other languages. */
const SEED_EN: Record<string, readonly string[]> = {
  bikes: ["Bikes"], accessories: ["Accessories"], apparel: ["Apparel"], parts: ["Parts"], nutrition: ["Nutrition"], gift: ["Gift cards", "Gifts"],
};

export const BUILTIN_TREE: CatTree = {
  table: false,
  cats: STORE_CATEGORIES.map((slug, i) => ({
    slug, parent: null, name_en: SEED_EN[slug][0], name_ar: null, blurb_en: null, blurb_ar: null, image: null, sort: (i + 1) * 10, seo: null,
    filters: [...FALLBACK_FILTERS],
  })),
};

const txt = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const IMAGE = /^\/(site|media)\/[A-Za-z0-9_./-]{1,200}$/;
/** A photo path staff saved: one of the site's own or an upload, never anything that leaves the folder. */
export const catImage = (v: unknown): string | null => (typeof v === "string" && IMAGE.test(v) && !v.includes("..") ? v : null);
export function filtersOf(v: unknown): CatFilter[] {
  if (!Array.isArray(v)) return [...DEFAULT_FILTERS];
  return [...new Set(v.filter((x): x is CatFilter => typeof x === "string" && (CAT_FILTER_KEYS as readonly string[]).includes(x)))];
}

/** The rows as read (store_categories, the visible ones: row security shows the public no other) as the store's
 *  categories: a malformed row is left out, and so is a sub-category whose category is not shown (hidden, or itself
 *  under another). No row: the six built-in ones. */
export function catTree(rows: readonly Record<string, unknown>[] | null | undefined): CatTree {
  const all: StoreCat[] = [];
  for (const r of rows ?? []) {
    const slug = txt(r.slug, 41), name = txt(r.name_en, 60);
    if (!slug || !CATEGORY_SLUG.test(slug) || !name || all.some((c) => c.slug === slug)) continue;
    const parent = txt(r.parent, 41);
    const sort = typeof r.sort === "number" && Number.isFinite(r.sort) ? r.sort : 0;
    all.push({
      slug, parent: parent && parent !== slug ? parent : null, name_en: name, name_ar: txt(r.name_ar, 60), blurb_en: txt(r.blurb_en, 400), blurb_ar: txt(r.blurb_ar, 400),
      image: catImage(r.image), sort, seo: seoOf(r), filters: filtersOf(r.filters),
    });
  }
  const tops = new Set(all.filter((c) => c.parent === null).map((c) => c.slug));
  const cats = all.filter((c) => c.parent === null || tops.has(c.parent)).sort((a, b) => a.sort - b.sort || a.name_en.localeCompare(b.name_en));
  return cats.length ? { cats, table: true } : BUILTIN_TREE;
}

export const catOf = (tree: CatTree, slug: string): StoreCat | null => tree.cats.find((c) => c.slug === slug) ?? null;
/** The sub-categories of a category, in staff's order. */
export const subsOf = (tree: CatTree, slug: string): StoreCat[] => tree.cats.filter((c) => c.parent === slug);
/** The category and, for a sub-category, the one above it first: the page's trail. */
export function catPath(tree: CatTree, slug: string): StoreCat[] {
  const c = catOf(tree, slug);
  if (!c) return [];
  const up = c.parent ? catOf(tree, c.parent) : null;
  return up ? [up, c] : [c];
}
/** The first-level category a category is, or sits under. */
export const topOf = (tree: CatTree, slug: string): string => catOf(tree, slug)?.parent ?? slug;

/** Whether a product belongs on a category's page: in that category or in one of its sub-categories. */
export const inCat = (tree: CatTree, p: Pick<StoreProduct, "category">, slug: string): boolean =>
  p.category === slug || catOf(tree, p.category)?.parent === slug;
export const catProducts = <P extends Pick<StoreProduct, "category">>(tree: CatTree, products: readonly P[], slug: string): P[] =>
  products.filter((p) => inCat(tree, p, slug));

/** The products the store shows: those in a category it shows (a hidden category's products go with it). While staff's
 *  categories could not be read, every product (a failed read never hides one, nor turns a cart's line gone). */
export const inShownCat = <P extends Pick<StoreProduct, "category">>(tree: CatTree, products: readonly P[]): P[] =>
  tree.unread ? [...products] : products.filter((p) => !!catOf(tree, p.category));

/** A slug as a name, while nothing better is known ("road-bikes": "Road bikes"). */
export const slugLabel = (slug: string): string => { const s = slug.replace(/-+/g, " ").trim(); return s.charAt(0).toUpperCase() + s.slice(1); };

/** The categories a page draws from: while staff's could not be read, the six built-in ones and, for a product in any
 *  other, that category on its own under its slug's name (its page, its tile and its chip work; its place under another
 *  category comes back with the next good read). Otherwise the tree as it is. */
export function catsFor(tree: CatTree, products: readonly Pick<StoreProduct, "category">[]): CatTree {
  if (!tree.unread) return tree;
  const extra = [...new Set(products.map((p) => p.category))].filter((slug) => !catOf(tree, slug)).sort().map((slug, i): StoreCat => ({
    slug, parent: null, name_en: slugLabel(slug), name_ar: null, blurb_en: null, blurb_ar: null, image: null, sort: 1000 + i, seo: null, filters: [...FALLBACK_FILTERS],
  }));
  return extra.length ? { ...tree, cats: [...tree.cats, ...extra] } : tree;
}

/** The first-level categories that have a product (in themselves or a sub-category), in staff's order. */
export const topsWithProducts = (tree: CatTree, products: readonly Pick<StoreProduct, "category">[]): StoreCat[] =>
  tree.cats.filter((c) => c.parent === null && products.some((p) => inCat(tree, p, c.slug)));
/** A category's sub-categories that have a product, in staff's order. */
export const subsWithProducts = (tree: CatTree, products: readonly Pick<StoreProduct, "category">[], slug: string): StoreCat[] =>
  subsOf(tree, slug).filter((c) => products.some((p) => p.category === c.slug));
/** Every category with a product, both levels: the addresses the sitemap lists. */
export const catsWithProducts = (tree: CatTree, products: readonly Pick<StoreProduct, "category">[]): StoreCat[] =>
  tree.cats.filter((c) => products.some((p) => inCat(tree, p, c.slug)));

/** A category's name in the page's language. The six built-in ones while the table has no row: the site's own words,
 *  as before. Staff's: their English, their Arabic on an Arabic page (else the English); in the other languages the
 *  site's translation for one of the six whose English is still the seeded one, else staff's English. */
export function catName(tree: CatTree, slug: string, locale: string, cats: Record<string, string>): string {
  const c = catOf(tree, slug);
  if (!tree.table || !c) return cats[slug] ?? c?.name_en ?? slug;
  if (locale === "en") return c.name_en;
  if (locale === "ar") return c.name_ar ?? (seeded(c) ? cats[slug] ?? c.name_en : c.name_en);
  return seeded(c) && cats[slug] ? cats[slug] : c.name_en;
}
const seeded = (c: StoreCat) => (SEED_EN[c.slug] ?? []).some((n) => n.toLowerCase() === c.name_en.trim().toLowerCase());

/** A category's line about itself in the page's language (Arabic on an Arabic page when written, else the English). */
export const catBlurb = (c: StoreCat | null, locale: string): string => (c ? pick(locale, c.blurb_en, c.blurb_ar) : "");

/** The filter groups a list offers: a category's own (staff's pick), the store page's and a collection's the default
 *  while categories are staff's, and the four the store always had while they are not. */
export const catFilters = (tree: CatTree, c: StoreCat | null): CatFilter[] =>
  !tree.table ? [...FALLBACK_FILTERS] : c ? c.filters : [...DEFAULT_FILTERS];

export type CatTile = { cat: string; name: string; image: string | null };
/** A tile per first-level category that has a product (O01-E), with staff's photo for it, else the photo of its first
 *  product in staff's order that has one (one in stock first). */
export function catTiles(tree: CatTree, products: readonly StoreProduct[], locale: string, cats: Record<string, string>): CatTile[] {
  const featured = sortProducts([...products], "featured");
  return topsWithProducts(tree, products).map((c) => {
    if (c.image) return { cat: c.slug, name: catName(tree, c.slug, locale, cats), image: c.image };
    const withPhoto = featured.filter((p) => inCat(tree, p, c.slug) && p.images.length);
    const p = withPhoto.find((x) => productStock(x).kind !== "out") ?? withPhoto[0];
    return { cat: c.slug, name: catName(tree, c.slug, locale, cats), image: p?.images[0] ?? null };
  });
}

/** A chip: its category's slug and name. */
export type CatChip = { cat: string; name: string };
export const catChips = (tree: CatTree, list: readonly StoreCat[], locale: string, cats: Record<string, string>): CatChip[] =>
  list.map((c) => ({ cat: c.slug, name: catName(tree, c.slug, locale, cats) }));
