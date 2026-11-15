import { categoriesIn, categoryHref, pick, priceRange, productHref, productStock, sar, type Store, type StoreCategory, type StoreProduct } from "./store-core";

// The site's own store, as the rest of the site finds it (the store build, 2026-11-15): its addresses in the sitemap (X11),
// its products and category pages in the header's search with their price and stock (O06-B), and the /bikes catalogue's
// "See it in the store" (F12). Only while the store is open: until then /store and everything under it forward to the
// Salla shop (proxy.ts storeTarget), so none of its addresses is a page of this site. Plain rules over the products the
// pages already read (lib/store.ts loadStore), so they are tested without a database.

/** The store's addresses a search engine should know: the store, each category's own page (a category with a product,
 *  as the store lists them) and every product's page (a gift card's is the gift card page, listed once). */
export function storePaths(store: Store): string[] {
  const out = new Set<string>(["/store"]);
  for (const c of categoriesIn(store)) out.add(categoryHref(c));
  for (const p of [...store.products].sort((a, b) => a.sort - b.sort)) out.add(productHref(p));
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

const CATEGORY_WORDS: Record<StoreCategory, string> = {
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
 *  languages' names and its category's words; a category by its name. */
export function storeSearchItems(store: Store, locale: string, w: StoreSearchWords): StoreSearchItem[] {
  const items: StoreSearchItem[] = [];
  for (const c of categoriesIn(store)) {
    const n = store.products.filter((p) => p.category === c).length;
    items.push({ title: w.cats[c] ?? c, text: n === 1 ? w.count1 : w.countN(n), href: categoryHref(c), words: `store shop متجر ${CATEGORY_WORDS[c]}` });
  }
  const seen = new Set<string>();
  for (const p of [...store.products].sort((a, b) => a.sort - b.sort)) {
    const href = productHref(p);
    if (seen.has(href)) continue;
    seen.add(href);
    const words = [p.brand, p.name_en, p.name_ar, p.tagline_en, p.tagline_ar, w.cats[p.category], CATEGORY_WORDS[p.category]].filter(Boolean).join(" ");
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
    if (p.kind === "gift_card" || !p.catalog_model || out.has(p.catalog_model)) continue;
    out.set(p.catalog_model, productHref(p));
  }
  return out;
}
