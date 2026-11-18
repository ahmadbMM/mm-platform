import { BUILTIN_TREE, catName, catsWithProducts, topOf, type CatTree } from "./store-cats";
import { collOpen, type StoreColl } from "./store-colls";
import { categoryHref, collectionHref, pick, priceRange, productHref, productStock, sar, type Store, type StoreProduct } from "./store-core";

// The site's own store, as the rest of the site finds it (the store build, 2026-11-15): its addresses in the sitemap (X11),
// its products and category pages in the header's search with their price and stock (O06-B), and the /bikes catalogue's
// "See it in the store" (F12). Only while the store is open: until then /store and everything under it forward to the
// Salla shop (proxy.ts storeTarget), so none of its addresses is a page of this site. Plain rules over the products the
// pages already read (lib/store.ts loadStore), so they are tested without a database.

//   The product-management build (2026-11-19): staff's categories on both levels and the collections the public sees are
// listed too; a Preview product (the staging site's alone) never is, in the sitemap or the search.

/** The products a search engine and the header's search may list: never a Preview. */
const listed = (store: Store): StoreProduct[] => store.products.filter((p) => !p.preview);

/** The store's addresses a search engine should know: the store, each category's own page (a category with a product,
 *  as the store lists them), each collection's open today (a manual one with a product in it) and every product's page
 *  (a gift card's is the gift card page, listed once). */
export function storePaths(store: Store, cats: CatTree = BUILTIN_TREE, colls: readonly StoreColl[] = [], today = ""): string[] {
  const products = listed(store);
  const out = new Set<string>(["/store"]);
  for (const c of catsWithProducts(cats, products)) out.add(categoryHref(c.slug));
  const ids = new Set(products.map((p) => p.id.toLowerCase()));
  for (const c of colls) if ((!today || collOpen(c, today)) && (c.kind !== "manual" || c.items.some((id) => ids.has(id)))) out.add(collectionHref(c.slug));
  for (const p of [...products].sort((a, b) => a.sort - b.sort)) out.add(productHref(p));
  return [...out];
}

/** The words the search shows for a product and a category, in the page's language (Store.text's own). */
export type StoreSearchWords = {
  cats: Record<string, string>;
  from: (p: string) => string;
  soldOut: string;
  left: (n: number) => string;
  inStock: string;
  count1: string;
  countN: (n: number) => string;
};
/** One result of the header's search. `price` and `stock` come written (a product's), so a result reads like the store's
 *  own card: "From ⃁ 1,250", "Only 2 left". */
export type StoreSearchItem = { title: string; text: string; href: string; words: string; price?: string; stock?: string; out?: boolean };

const CATEGORY_WORDS: Record<string, string> = {
  bikes: "bike bikes bicycle cycle دراجة دراجات",
  accessories: "accessory accessories helmet lights lock pump إكسسوارات خوذة إضاءة قفل",
  apparel: "apparel clothes clothing jersey shorts gloves ملابس قميص",
  parts: "part parts spares components قطع غيار",
  nutrition: "nutrition gel bar drink تغذية",
  gift: "gift gifts voucher card هدية هدايا بطاقة",
};

/** What a product's price and stock read as in the search. Stock is the product's live stock (no other claim, L11). */
export function productFacts(p: StoreProduct, w: StoreSearchWords): { price: string; stock: string; out: boolean } {
  const { lo, hi } = priceRange(p);
  const st = productStock(p);
  return {
    price: lo !== hi ? w.from(sar(lo)) : sar(lo),
    stock: st.kind === "out" ? w.soldOut : st.kind === "low" ? w.left(st.left) : w.inStock,
    out: st.kind === "out",
  };
}

/** The store's products and category pages as search results, in staff's order: a product by its name, brand, both
 *  languages' names, staff's tags and its categories' words; a category by its names. */
export function storeSearchItems(store: Store, locale: string, w: StoreSearchWords, cats: CatTree = BUILTIN_TREE): StoreSearchItem[] {
  const items: StoreSearchItem[] = [];
  const products = listed(store);
  // a category's words: its names in both languages and the page's, and the six built-in ones' everyday words
  const catWords = (slug: string) => {
    const c = cats.cats.find((x) => x.slug === slug), top = topOf(cats, slug);
    return [catName(cats, slug, locale, w.cats), c?.name_en, c?.name_ar, CATEGORY_WORDS[slug], top !== slug ? CATEGORY_WORDS[top] : null].filter(Boolean).join(" ");
  };
  for (const c of catsWithProducts(cats, products)) {
    const n = products.filter((p) => p.category === c.slug || cats.cats.find((x) => x.slug === p.category)?.parent === c.slug).length;
    items.push({ title: catName(cats, c.slug, locale, w.cats), text: n === 1 ? w.count1 : w.countN(n), href: categoryHref(c.slug), words: `store shop متجر ${catWords(c.slug)}` });
  }
  const seen = new Set<string>();
  for (const p of [...products].sort((a, b) => a.sort - b.sort)) {
    const href = productHref(p);
    if (seen.has(href)) continue;
    seen.add(href);
    const words = [p.brand, p.name_en, p.name_ar, p.tagline_en, p.tagline_ar, ...p.tags, catWords(p.category)].filter(Boolean).join(" ");
    items.push({ title: pick(locale, p.name_en, p.name_ar), text: pick(locale, p.tagline_en, p.tagline_ar) || (p.brand ?? ""), href, words, ...productFacts(p, w) });
  }
  return items;
}

/** The /bikes catalogue's models that a store product sells (the product's catalog_model, staff's pick in the product
 *  editor), each with its store page: the first product in staff's order when two sell the same model. Gift cards sell no
 *  bike. */
export function storeLinksByModel(store: Store): Map<string, string> {
  const out = new Map<string, string>();
  for (const p of [...store.products].sort((a, b) => a.sort - b.sort)) {
    if (p.kind === "gift_card" || p.preview || !p.catalog_model || out.has(p.catalog_model)) continue;
    out.set(p.catalog_model, productHref(p));
  }
  return out;
}
