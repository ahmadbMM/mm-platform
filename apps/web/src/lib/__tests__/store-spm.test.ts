import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactElement, type ReactNode } from "react";
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { TxProvider } from "@/i18n/TxProvider";
import { localize } from "@/i18n/tx";
import { loadBest, loadCats, loadColls, loadStore, productStock, resetStore, stockState, storeOf, variantStock, type Store } from "../store";
import { BUILTIN_TREE, catFilters, catName, catOf, catPath, catProducts, catTiles, catTree, catsWithProducts, inShownCat, subsWithProducts, topOf, topsWithProducts } from "../store-cats";
import { bestIds, collOpen, collProducts, collsOf, inCollOrder, onSale, storeSections, type CollCtx } from "../store-colls";
import {
  bannerLink, bannerToday, liveAt, minOrderLeft, seoText, shownBadge, staffText, storeBanner, storeHeading, storeRules, storeSeo, visibleProducts, withRules,
} from "../store-rules";
import { cartLines, clampCart, productInCart, roomFor } from "../cart";
import { facetsOf, listOf, listQueryOf, listQueryText, matches, noFilters, quickRoom, quickVariant } from "../store-listing";
import { storePaths, storeSearchItems } from "../store-site";
import { feedItems } from "../sx-B1-feed";
import { payError } from "../pay/http";
import { refusalPlace } from "../store-form";
import { memoSettled } from "../memo";
import { T as ST } from "../../components/store/Store.text";
import { T as SPM } from "../../components/store/spm.text";

// The product-management build (2026-11-19, CONTRACT.md): the store reads staff's categories (two levels), collections,
// a product's mark, pre-order, Preview, the publish window, the limit per order and the store's new settings, and keeps
// working as before where the database has none of it yet.
const render = renderUntyped as (el: ReactElement) => string;
const wrap = (locale: string, child: ReactNode) =>
  createElement(NextIntlClientProvider, { locale, messages: {} } as never, createElement(TxProvider, { locale, dict: null } as never, child));
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const variant = (n: number, pid: string, x: Record<string, unknown> = {}) => ({ id: U(100 + n), product_id: pid, size: null, color_en: null, color_ar: null, color_hex: null, price: null, stock: 5, sort: n, ...x });
const product = (id: string, slug: string, x: Record<string, unknown> = {}) => ({
  id, slug, category: "accessories", brand: null, name_en: slug.toUpperCase(), name_ar: null, tagline_en: null, tagline_ar: null, description_en: null,
  description_ar: null, specs: [], images: [], price: 100, compare_at: null, ship_ksa: true, sort: 0, created_at: "2026-11-01T00:00:00Z", published: true, ...x,
});
const ROAD = U(1), MTB = U(2), HELMET = U(3), GEL = U(4), PRE = U(5), PREVIEW = U(6), LATER = U(7);
const NOW = Date.parse("2026-11-19T09:00:00Z");
const TODAY = "2026-11-19";
const STORE: Store = storeOf(
  [
    product(ROAD, "road", { category: "road", brand: "Alvas", price: 9000, sort: 1, images: ["/media/store/road/1.webp"], tags: ["carbon", "race"], created_at: "2026-11-15T00:00:00Z" }),
    product(MTB, "mtb", { category: "mountain", brand: "Battle", price: 6000, sort: 2, tags: ["trail"], badge: "best" }),
    product(HELMET, "helmet", { category: "accessories", brand: "Camp", price: 450, sort: 3, compare_at: 520, max_per_order: 2, images: ["/site/store/helmet/1.webp"] }),
    product(GEL, "gel", { category: "nutrition", price: 12, sort: 4, condition: "new", badge: "custom", badge_en: "Race day", badge_ar: "يوم السباق", badge_until: "2026-11-30" }),
    product(PRE, "pre", { category: "accessories", price: 300, sort: 5, preorder: true, ships_on: "2026-12-03" }),
    product(PREVIEW, "preview", { category: "accessories", price: 50, sort: 6, published: false, preview: true }),
    product(LATER, "later", { category: "accessories", price: 80, sort: 7, publish_at: "2026-12-01T00:00:00Z" }),
  ],
  [variant(1, ROAD), variant(2, MTB, { stock: 0 }), variant(3, HELMET, { size: "M" }), variant(4, HELMET, { size: "L" }), variant(5, GEL), variant(6, PRE, { stock: 0 }),
    variant(7, PREVIEW), variant(8, LATER)],
);
const by = (slug: string) => STORE.products.find((p) => p.slug === slug)!;
const CAT_ROWS = [
  { slug: "bikes", parent: null, name_en: "Bikes", name_ar: "دراجات", sort: 10, filters: ["brand", "price", "tags"] },
  { slug: "road", parent: "bikes", name_en: "Road bikes", name_ar: "دراجات طريق", sort: 1, image: "/media/store/cats/road.webp", seo_title_en: "Road bikes in Jeddah" },
  { slug: "mountain", parent: "bikes", name_en: "Mountain bikes", name_ar: null, sort: 2 },
  { slug: "accessories", parent: null, name_en: "Accessories", name_ar: "إكسسوارات", sort: 20, blurb_en: "Helmets and lights", image: "/../etc/passwd" },
  { slug: "gift", parent: null, name_en: "Gift cards", name_ar: "بطاقات هدايا", sort: 60 },
  { slug: "deep", parent: "road", name_en: "Too deep", sort: 1 },
  { slug: "orphan", parent: "hidden", name_en: "Orphan", sort: 1 },
  { slug: "Bad Slug", parent: null, name_en: "Bad", sort: 1 },
];
const TREE = catTree(CAT_ROWS);

describe("a product's new fields", () => {
  it("are read with the product, malformed ones dropped, and absent ones read as before", () => {
    const road = by("road"), gel = by("gel"), pre = by("pre"), helmet = by("helmet");
    expect(road.tags).toEqual(["carbon", "race"]);
    expect(by("mtb").badge).toEqual({ kind: "best", en: null, ar: null, until: null });
    expect(gel.badge).toEqual({ kind: "custom", en: "Race day", ar: "يوم السباق", until: "2026-11-30" });
    expect(pre.preorder).toBe(true);
    expect(pre.ships_on).toBe("2026-12-03");
    expect(helmet.max_per_order).toBe(2);
    const plain = storeOf([product(U(9), "plain", { published: undefined })], []).products[0];
    expect([plain.tags, plain.badge, plain.seo, plain.max_per_order, plain.preorder, plain.preview, plain.published]).toEqual([[], null, null, null, false, false, true]);
    // a custom mark needs its words; a mark the database never has is no mark; a limit outside 1-99 is none
    const odd = storeOf([product(U(9), "odd", { badge: "custom", max_per_order: 500, tags: [" a ", "", "a", 5, "b".repeat(40)] }), product(U(10), "odd2", { badge: "hot" })], []).products;
    expect(odd.map((p) => p.badge)).toEqual([null, null]);
    expect(odd[0].max_per_order).toBeNull();
    expect(odd[0].tags).toEqual(["a", "b".repeat(30)]);
  });
  it("say a pre-order is never sold out, and the low-stock mark follows store.showStock", () => {
    expect(productStock(by("pre")).kind).toBe("in");
    expect(variantStock(by("pre"), { stock: 0 }).kind).toBe("in");
    expect(stockState(5, 6)).toEqual({ kind: "low", left: 5 });
    expect(stockState(2, 0)).toEqual({ kind: "in" });
    expect(stockState(2)).toEqual({ kind: "low", left: 2 });
  });
});

describe("live, scheduled and Preview", () => {
  it("read the publish window as the database's _store_live does", () => {
    expect(liveAt({ published: true, publish_at: null, unpublish_at: null }, NOW)).toBe(true);
    expect(liveAt({ published: false, publish_at: null, unpublish_at: null }, NOW)).toBe(false);
    expect(liveAt({ published: true, publish_at: "2026-12-01T00:00:00Z", unpublish_at: null }, NOW)).toBe(false);
    expect(liveAt({ published: true, publish_at: "2026-11-19T09:00:00Z", unpublish_at: null }, NOW)).toBe(true);
    expect(liveAt({ published: true, publish_at: null, unpublish_at: "2026-11-19T09:00:00Z" }, NOW)).toBe(false);
  });
  it("show a Preview product only on the staging site, marked, and a live one never marked", () => {
    const live = visibleProducts(STORE.products, NOW, false).map((p) => p.slug);
    expect(live).not.toContain("preview");
    expect(live).not.toContain("later");
    const staging = visibleProducts(STORE.products, NOW, true);
    expect(staging.find((p) => p.slug === "preview")?.preview).toBe(true);
    const both = visibleProducts([{ ...by("road"), preview: true }], NOW, true);
    expect(both[0].preview).toBe(false);
  });
});

describe("staff's categories", () => {
  it("read two levels in staff's order; a deeper or orphaned one, a bad slug and a photo outside the site are left out", () => {
    expect(TREE.table).toBe(true);
    expect(TREE.cats.map((c) => c.slug)).toEqual(["road", "mountain", "bikes", "accessories", "gift"]);
    expect(catOf(TREE, "accessories")?.image).toBeNull();
    expect(catOf(TREE, "road")?.image).toBe("/media/store/cats/road.webp");
    expect(catOf(TREE, "road")?.filters).toEqual(["brand", "size", "colour", "price", "instock"]);
    expect(catOf(TREE, "bikes")?.filters).toEqual(["brand", "price", "tags"]);
    expect(catPath(TREE, "road").map((c) => c.slug)).toEqual(["bikes", "road"]);
    expect(topOf(TREE, "road")).toBe("bikes");
  });
  it("are the six built-in ones while the table has no row", () => {
    expect(catTree([])).toBe(BUILTIN_TREE);
    expect(catTree(null).cats.map((c) => c.slug)).toEqual(["bikes", "accessories", "apparel", "parts", "nutrition", "gift"]);
    expect(catFilters(BUILTIN_TREE, catOf(BUILTIN_TREE, "bikes"))).toEqual(["price", "size", "colour", "brand"]);
    expect(catFilters(TREE, null)).toEqual(["brand", "size", "colour", "price", "instock"]);
  });
  it("list a category's sub-categories' products on its page, and only products in a category the store shows", () => {
    const shown = inShownCat(TREE, STORE.products).map((p) => p.slug);
    expect(shown).not.toContain("gel"); // nutrition is not one of staff's
    expect(catProducts(TREE, STORE.products, "bikes").map((p) => p.slug)).toEqual(["road", "mtb"]);
    expect(catProducts(TREE, STORE.products, "road").map((p) => p.slug)).toEqual(["road"]);
    expect(topsWithProducts(TREE, STORE.products).map((c) => c.slug)).toEqual(["bikes", "accessories"]);
    expect(subsWithProducts(TREE, STORE.products, "bikes").map((c) => c.slug)).toEqual(["road", "mountain"]);
    expect(catsWithProducts(TREE, STORE.products).map((c) => c.slug)).toEqual(["road", "mountain", "bikes", "accessories"]);
  });
  it("name a category from its row in English and Arabic, and keep the site's translation of a seeded name elsewhere", () => {
    const cats = ST.en.cats;
    expect(catName(TREE, "bikes", "en", cats)).toBe("Bikes");
    expect(catName(TREE, "bikes", "ar", ST.ar.cats)).toBe("دراجات");
    expect(catName(TREE, "mountain", "ar", ST.ar.cats)).toBe("Mountain bikes");
    expect(catName(TREE, "bikes", "de", { ...cats, bikes: "Fahrräder" })).toBe("Fahrräder");
    expect(catName(TREE, "gift", "de", { ...cats, gift: "Geschenke" })).toBe("Geschenke"); // "Gift cards" is the seeded English
    expect(catName(TREE, "road", "de", cats)).toBe("Road bikes");
    const renamed = catTree([{ slug: "bikes", name_en: "Bicycles", sort: 1 }]);
    expect(catName(renamed, "bikes", "de", { ...cats, bikes: "Fahrräder" })).toBe("Bicycles");
    expect(catName(BUILTIN_TREE, "gift", "en", cats)).toBe("Gifts");
  });
  it("give each first-level category a tile with staff's photo, else its first product's", () => {
    expect(catTiles(TREE, STORE.products, "en", ST.en.cats)).toEqual([
      { cat: "bikes", name: "Bikes", image: "/media/store/road/1.webp" },
      { cat: "accessories", name: "Accessories", image: "/site/store/helmet/1.webp" },
    ]);
    const withPhoto = catTree([{ slug: "bikes", name_en: "Bikes", image: "/site/store/cats/bikes.webp" }, { slug: "road", parent: "bikes", name_en: "Road" }]);
    expect(catTiles(withPhoto, STORE.products, "en", ST.en.cats)[0].image).toBe("/site/store/cats/bikes.webp");
  });
});

describe("collections", () => {
  const ROWS = [
    { slug: "picks", name_en: "Staff picks", sort: 2, on_store: true, kind: "manual", max_items: 1 },
    { slug: "fresh", name_en: "Just in", sort: 1, on_store: true, kind: "new", days: 7 },
    { slug: "deals", name_en: "Deals", sort: 3, on_store: true, kind: "sale" },
    { slug: "top", name_en: "Best sellers", sort: 4, on_store: false, kind: "best", days: 30 },
    { slug: "soon", name_en: "Coming", sort: 5, on_store: true, kind: "manual", starts_on: "2026-12-01" },
    { slug: "Bad", name_en: "Bad" },
  ];
  const ITEMS = [{ collection: "picks", product_id: HELMET, sort: 2 }, { collection: "picks", product_id: ROAD.toUpperCase(), sort: 1 }, { collection: "picks", product_id: "nope", sort: 3 }];
  const colls = collsOf(ROWS, ITEMS);
  const ctx: CollCtx = { today: TODAY, now: NOW, licence: "L-1", best: (d) => (d === 30 ? [GEL, MTB] : []) };
  it("read in staff's order with their items in theirs", () => {
    expect(colls.map((c) => c.slug)).toEqual(["fresh", "picks", "deals", "top", "soon"]);
    expect(colls.find((c) => c.slug === "picks")?.items).toEqual([ROAD, HELMET]);
    expect(colls.find((c) => c.slug === "fresh")?.max_items).toBe(12);
  });
  it("open only between their dates", () => {
    expect(collOpen({ starts_on: "2026-12-01", ends_on: null }, TODAY)).toBe(false);
    expect(collOpen({ starts_on: TODAY, ends_on: TODAY }, TODAY)).toBe(true);
    expect(collOpen({ starts_on: null, ends_on: "2026-11-18" }, TODAY)).toBe(false);
  });
  it("fill themselves: staff's items, the newest, what is on sale, the best sellers", () => {
    const of = (slug: string) => collProducts(colls.find((c) => c.slug === slug)!, STORE.products, ctx).map((p) => p.slug);
    expect(of("picks")).toEqual(["road", "helmet"]);
    expect(of("fresh")).toEqual(["road"]);
    expect(of("deals")).toEqual(["helmet"]); // its former price shows beside the licence
    expect(of("top")).toEqual(["gel", "mtb"]);
    expect(onSale(by("helmet"), null, TODAY)).toBe(false);
    expect(onSale({ ...by("road"), badge: { kind: "sale", en: null, ar: null, until: null } }, null, TODAY)).toBe(true);
  });
  it("make the store page's sections: those on it, open today and with a product, each cut to its most", () => {
    const s = storeSections(colls, STORE.products, ctx);
    expect(s.map((x) => x.coll.slug)).toEqual(["fresh", "picks", "deals"]);
    expect(s[1].products.map((p) => p.slug)).toEqual(["road"]);
    expect(s[1].more).toBe(true);
    expect(inCollOrder([by("helmet"), by("road")]).map((p) => p.sort)).toEqual([0, 1]);
  });
  it("read the best sellers as store_bestsellers answers them", () => {
    expect(bestIds([{ product_id: GEL.toUpperCase(), units: 9 }, { product_id: "x" }, null, { product_id: GEL }])).toEqual([GEL]);
    expect(bestIds({})).toEqual([]);
  });
});

describe("the store's settings", () => {
  it("read store.* as staff set them, and as before when missing or malformed", () => {
    expect(storeRules({})).toEqual({ maxPerOrder: null, minOrder: null, newDays: null, lowAt: null, sort: "featured" });
    expect(storeRules({ "store.maxPerOrder": 4, "store.minOrder": 99.5, "store.newBadge": { on: true, days: 14 }, "store.showStock": { on: true, under: 5 }, "store.sort": "price_asc" }))
      .toEqual({ maxPerOrder: 4, minOrder: 99.5, newDays: 14, lowAt: 5, sort: "price-asc" });
    expect(storeRules({ "store.maxPerOrder": 0, "store.minOrder": -1, "store.newBadge": { on: false, days: 14 }, "store.showStock": { on: false }, "store.sort": "random" }))
      .toEqual({ maxPerOrder: null, minOrder: null, newDays: null, lowAt: 0, sort: "featured" });
    expect(storeRules({ "store.sort": "newest" }).sort).toBe("new");
  });
  it("show staff's mark until its day, else New for a product made within the days", () => {
    const rules = { newDays: 7 };
    expect(shownBadge(by("gel"), rules, TODAY, NOW)?.en).toBe("Race day");
    expect(shownBadge(by("gel"), { newDays: null }, "2026-12-01", NOW)).toBeNull();
    expect(shownBadge(by("road"), rules, TODAY, NOW)?.kind).toBe("new");
    expect(shownBadge(by("helmet"), rules, TODAY, NOW)).toBeNull();
    expect(shownBadge(by("road"), { newDays: null }, TODAY, NOW)).toBeNull();
  });
  it("apply the limit per order, the low-stock mark and the marks to every product", () => {
    const ps = withRules(STORE.products, storeRules({ "store.maxPerOrder": 3, "store.showStock": { on: false } }), TODAY, NOW);
    const of = (slug: string) => ps.find((p) => p.slug === slug)!;
    expect(of("helmet").max_per_order).toBe(2);
    expect(of("road").max_per_order).toBe(3);
    expect(of("road").low_at).toBe(0);
    expect(withRules(STORE.products, storeRules({}), TODAY, NOW).find((p) => p.slug === "road")?.low_at).toBeUndefined();
  });
  it("write staff's heading and SEO on English and Arabic pages and keep the translation elsewhere", () => {
    const h = storeHeading({ "store.heading": { title_en: "Our shop", title_ar: "متجرنا", intro_en: " ", intro_ar: null } });
    expect(staffText("en", h.title_en, h.title_ar, "Store")).toBe("Our shop");
    expect(staffText("ar", h.title_en, h.title_ar, "المتجر")).toBe("متجرنا");
    expect(staffText("de", h.title_en, h.title_ar, "Shop")).toBe("Shop");
    expect(staffText("en", h.intro_en, h.intro_ar, "Lead")).toBe("Lead");
    expect(storeSeo({})).toBeNull();
    expect(seoText("ar", storeSeo({ "store.seo": { title_en: "Shop", desc_en: "Bikes" } }), "المتجر", "وصف")).toEqual({ title: "المتجر", description: "وصف" });
    expect(seoText("en", storeSeo({ "store.seo": { title_en: "Shop", desc_en: "Bikes" } }), "Store", "Lead")).toEqual({ title: "Shop", description: "Bikes" });
  });
  it("show the banner only while it is on and between its dates, with a link of the site or https", () => {
    const b = storeBanner({ "store.banner": { on: true, en: "Free delivery this week", ar: "توصيل مجاني هذا الأسبوع", link: "/store/collection/deals", tone: "sale", from: "2026-11-18", to: TODAY } });
    expect(b?.tone).toBe("sale");
    expect(bannerToday(b, TODAY)).toBe(b);
    expect(bannerToday(b, "2026-11-20")).toBeNull();
    expect(storeBanner({ "store.banner": { on: false, en: "x" } })).toBeNull();
    expect(storeBanner({ "store.banner": { on: true, en: "x", tone: "neon" } })?.tone).toBe("brand");
    expect([bannerLink("/store"), bannerLink("https://example.com/a"), bannerLink("//evil.example"), bannerLink("javascript:alert(1)"), bannerLink("http://x")])
      .toEqual(["/store", "https://example.com/a", null, null, null]);
  });
  it("say how much more the smallest order needs", () => {
    expect(minOrderLeft(200, 165.5)).toBe(34.5);
    expect(minOrderLeft(200, 200)).toBe(0);
    expect(minOrderLeft(null, 10)).toBe(0);
  });
});

describe("the cart with limits, pre-orders and Preview", () => {
  const store = { products: withRules(STORE.products, storeRules({}), TODAY, NOW) };
  const helmet = store.products.find((p) => p.slug === "helmet")!, pre = store.products.find((p) => p.slug === "pre")!;
  const M = U(103), L = U(104), PREV = U(106), PREVIEWV = U(107);
  it("take a pre-order beyond its stock, never a Preview, and mark the line past a product's limit", () => {
    const lines = cartLines([{ variant: M, qty: 1 }, { variant: L, qty: 2 }, { variant: PREV, qty: 4 }, { variant: PREVIEWV, qty: 1 }], store);
    expect(lines.map((l) => l.issue)).toEqual([null, "max", null, "gone"]);
    expect(lines[2].total).toBe(1200);
  });
  it("count a product's sizes together against its limit", () => {
    const cart = [{ variant: M, qty: 1 }];
    expect(productInCart(cart, helmet)).toBe(1);
    expect(roomFor(cart, helmet, helmet.variants[1])).toBe(1);
    expect(roomFor([], pre, pre.variants[0])).toBe(10);
    expect(roomFor([{ variant: M, qty: 2 }], helmet, helmet.variants[0])).toBe(0);
    expect(quickRoom([{ variant: M, qty: 2 }], { id: M, stock: 5 }, 2)).toBe(0);
    expect(quickRoom([], { id: M, stock: 5 })).toBe(5);
  });
  it("bring a product's lines down to its limit, the first lines first", () => {
    expect(clampCart([{ variant: M, qty: 2 }, { variant: L, qty: 3 }, { variant: PREV, qty: 4 }], store)).toEqual({ cart: [{ variant: M, qty: 2 }, { variant: PREV, qty: 4 }], changed: true });
    expect(clampCart([{ variant: L, qty: 3 }], store)).toEqual({ cart: [{ variant: L, qty: 2 }], changed: true });
    expect(clampCart([{ variant: M, qty: 1 }], store).changed).toBe(false);
  });
  it("never quick-add a pre-order or a Preview: their pages say more", () => {
    expect(quickVariant({ ...by("helmet"), variants: [by("helmet").variants[0]] })).not.toBeNull();
    expect(quickVariant({ ...pre, variants: [pre.variants[0]] })).toBeNull();
    expect(quickVariant({ ...by("preview"), preview: true })).toBeNull();
  });
  it("name the database's new refusals, the limit on its line", () => {
    expect(payError({ status: 400, message: "STORE_MAX_QTY: " + M }).error).toBe("max_qty");
    expect(payError({ status: 400, message: "STORE_MIN_ORDER" }).error).toBe("min_order");
    expect(refusalPlace("max_qty")).toEqual({ line: true });
  });
});

describe("the new filters and the store's own order", () => {
  const ctx = { licence: "L-1", today: TODAY };
  it("offer In stock, On sale, Condition and Tags only where they narrow the list and the category asks for them", () => {
    const all = ["price", "size", "colour", "brand", "instock", "sale", "condition", "tags"] as const;
    const keys = (ps = STORE.products, groups: readonly (typeof all)[number][] = all) => facetsOf(ps, groups, ctx).map((f) => f.key);
    expect(keys()).toEqual(["price", "size", "brand", "instock", "sale", "tags"]);
    expect(keys(STORE.products, ["brand", "tags"])).toEqual(["brand", "tags"]);
    expect(facetsOf(STORE.products).map((f) => f.key)).toEqual(["price", "size", "brand"]);
    expect(facetsOf(STORE.products, all, ctx).find((f) => f.key === "tags")?.options.map((o) => o.value)).toEqual(["carbon", "race", "trail"]);
  });
  it("keep what each new filter asks for", () => {
    const f = (x: Partial<ReturnType<typeof noFilters>>) => ({ ...noFilters(), ...x });
    const slugs = (x: Partial<ReturnType<typeof noFilters>>) => STORE.products.filter((p) => matches(p, f(x), ctx)).map((p) => p.slug);
    expect(slugs({ instock: ["1"] })).not.toContain("mtb");
    expect(slugs({ instock: ["1"] })).not.toContain("pre");
    expect(slugs({ sale: ["1"] })).toEqual(["helmet"]);
    expect(slugs({ tags: ["race", "trail"] })).toEqual(["road", "mtb"]);
    expect(slugs({ condition: ["certified"] })).toEqual([]);
    expect(listOf(STORE.products, f({ tags: ["carbon"] }), "featured", ctx).fresh.map((p) => p.slug)).toEqual(["road"]);
  });
  it("open in the store's own order, and keep it out of the address", () => {
    expect(listQueryOf({}, "price-asc").sort).toBe("price-asc");
    expect(listQueryOf({ sort: "featured" }, "price-asc").sort).toBe("featured");
    expect(listQueryText("", noFilters(), "price-asc", "price-asc")).toBe("");
    expect(listQueryText("", noFilters(), "featured", "price-asc")).toBe("?sort=featured");
    expect(listQueryText("", { ...noFilters(), instock: ["1"], tags: ["race"] }, "featured")).toBe("?instock=1&tags=race");
  });
});

describe("the sitemap, the search and the feed", () => {
  const store = { products: STORE.products.filter((p) => p.slug !== "later") };
  it("list staff's categories on both levels and the open collections, never a Preview", () => {
    const colls = collsOf([{ slug: "picks", name_en: "Picks", kind: "manual" }, { slug: "empty", name_en: "Empty", kind: "manual" }, { slug: "fresh", name_en: "Fresh", kind: "new", ends_on: "2026-11-01" }],
      [{ collection: "picks", product_id: ROAD }]);
    const paths = storePaths(store, TREE, colls, TODAY);
    expect(paths).toContain("/store/category/road");
    expect(paths).toContain("/store/category/bikes");
    expect(paths).toContain("/store/collection/picks");
    expect(paths).not.toContain("/store/collection/empty");
    expect(paths).not.toContain("/store/collection/fresh");
    expect(paths).not.toContain("/store/preview");
    expect(storePaths(store)).toContain("/store/category/accessories");
  });
  it("find a product by staff's tags and its category's names", () => {
    const w = localize(ST, "en", null);
    const items = storeSearchItems(store, "en", w, TREE);
    const road = items.find((i) => i.href === "/store/road");
    expect(road?.words).toContain("carbon");
    expect(road?.words).toContain("Road bikes");
    expect(road?.words).toContain("bicycle"); // the built-in bikes' everyday words reach its sub-category
    expect(items.some((i) => i.href === "/store/category/road" && i.title === "Road bikes")).toBe(true);
    expect(items.some((i) => i.href === "/store/preview")).toBe(false);
  });
  it("leave a Preview out of the feed and give a sub-category its path and its category's Google category", () => {
    const xml = feedItems([...store.products, { ...by("helmet"), slug: "prev-helmet", preview: true }],
      { site: "https://micromobility.sa", lang: "en", licence: null, today: TODAY, storeName: "Micromobility", cats: TREE }).join("\n");
    expect(xml).toContain("<g:product_type>bikes &gt; road</g:product_type>");
    expect(xml).toContain("Bicycles</g:google_product_category>");
    expect(xml).not.toContain("prev-helmet");
  });
});

describe("the pieces as the server draws them", () => {
  it("draw a mark, Preview and the pre-order line with drawn signs, in English and Arabic, and no emoji", async () => {
    const { ProductMarks, PreorderLine, StoreBannerLine } = await import("@/components/store/spm-parts");
    const en = localize(SPM, "en", null), ar = localize(SPM, "ar", null);
    const html = render(wrap("en", createElement("div", null,
      createElement(ProductMarks, { p: { badge: { kind: "best", en: null, ar: null, until: null }, preview: true }, locale: "en", x: en }),
      createElement(PreorderLine, { ships: "Thu 3 Dec", x: en }))));
    for (const s of ["st-mark is-best", "Best seller", "st-mark is-preview", "Preview", "Pre-order · Ships by Thu 3 Dec", "<svg"]) expect(html).toContain(s);
    const custom = render(wrap("ar", createElement(ProductMarks, { p: { badge: { kind: "custom", en: "Race day", ar: "يوم السباق", until: null }, preview: false }, locale: "ar", x: ar })));
    expect(custom).toContain('<bdi dir="auto">يوم السباق</bdi>');
    const banner = render(wrap("en", createElement(StoreBannerLine, { banner: { en: "Sale <b>now</b>", ar: null, link: "https://example.com", tone: "sale", from: null, to: null }, locale: "en" })));
    expect(banner).toContain('target="_blank"');
    expect(banner).toContain("Sale &lt;b&gt;now&lt;/b&gt;");
    expect(render(wrap("en", createElement(StoreBannerLine, { banner: null, locale: "en" })))).toBe("");
    expect(html + custom + banner).not.toMatch(/\p{Extended_Pictographic}/u);
  });
  it("draw a card's mark, a pre-order's status line and Preview, with no quick add for either", async () => {
    const { default: StoreGrid } = await import("@/components/store/StoreGrid");
    const products = withRules(visibleProducts(STORE.products, NOW, true), storeRules({ "store.newBadge": { on: true, days: 7 } }), TODAY, NOW);
    const html = render(wrap("en", createElement(StoreGrid, { locale: "en", products, start: { sort: "featured", filters: noFilters() }, licence: false, today: TODAY,
      whens: { ship: null, local: null }, groups: ["brand", "tags"] })));
    for (const s of ["st-mark is-new", "st-mark is-best", "Race day", "st-card-pre", "Pre-order", "st-mark is-preview", "<legend>Tags</legend>"]) expect(html).toContain(s);
    expect(html).not.toContain('aria-label="Add PRE to cart"');
    expect(html).not.toContain('aria-label="Add PREVIEW to cart"');
  });
  it("draw a category page's second row with All of the category filled until a sub-category is open", async () => {
    const { CategoryChips } = await import("@/components/store/StoreExtras");
    const t = localize(ST, "en", null);
    const sub = render(wrap("en", createElement(CategoryChips, { cats: [{ cat: "road", name: "Road bikes" }], at: null, t, all: "/store/category/bikes", label: "Bikes", sub: true })));
    expect(sub).toContain("st-chips-sub");
    expect(sub).toMatch(/aria-current="page"[^>]*href="\/store\/category\/bikes"|href="\/store\/category\/bikes"[^>]*aria-current="page"/);
    expect(sub).toContain('aria-label="Bikes"');
  });
});

describe("reading what staff manage", () => {
  const env = () => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://db.test"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); };
  const ok = (v: unknown) => new Response(JSON.stringify(v), { status: 200 });
  const missing = (code: string, status = 404) => new Response(JSON.stringify({ code, message: "not there" }), { status });
  afterEach(() => { resetStore(); vi.unstubAllEnvs(); });

  it("keeps the six categories and no collections while the tables are not there", async () => {
    env();
    const f = vi.fn(async () => missing("PGRST205")) as unknown as typeof fetch;
    expect((await loadCats(f, 1)).table).toBe(false);
    expect(await loadColls(f, 1)).toEqual([]);
    expect((await loadBest([30], vi.fn(async () => missing("PGRST202")) as unknown as typeof fetch, 1)).get(30)).toEqual([]);
    await memoSettled();
  });
  it("asks for Preview products too on the staging site only, and shows a product only in a category the store shows", async () => {
    env();
    vi.stubEnv("MM_ENV", "staging");
    const urls: string[] = [];
    const f = vi.fn(async (u: string) => {
      urls.push(u);
      if (u.includes("store_categories")) return ok([{ slug: "accessories", name_en: "Accessories" }]);
      if (u.includes("store_products")) return ok([product(HELMET, "helmet"), product(PREVIEW, "preview", { published: false, preview: true }), product(ROAD, "road", { category: "road" })]);
      return ok([variant(3, HELMET), variant(7, PREVIEW), variant(1, ROAD)]);
    }) as unknown as typeof fetch;
    const s = await loadStore(f, NOW);
    expect(urls.find((u) => u.includes("store_products"))).toContain("or=(published.is.true,preview.is.true)");
    expect(s?.products.map((p) => [p.slug, p.preview])).toEqual([["helmet", false], ["preview", true]]);
    await memoSettled();
  });
  it("never asks for Preview products elsewhere, and reads the store build's columns when the new ones are not there", async () => {
    env();
    const urls: string[] = [];
    const f = vi.fn(async (u: string) => {
      urls.push(u);
      if (u.includes("store_categories")) return missing("42P01");
      if (u.includes("store_products") && u.includes("preorder")) return missing("42703", 400);
      if (u.includes("store_products")) return ok([product(HELMET, "helmet", { published: undefined })]);
      return ok([variant(3, HELMET)]);
    }) as unknown as typeof fetch;
    const s = await loadStore(f, NOW);
    const reads = urls.filter((u) => u.includes("store_products"));
    expect(reads).toHaveLength(2);
    expect(reads[0]).toContain("published=is.true");
    expect(reads[0]).not.toContain("preview.is.true");
    expect(reads[1]).toContain("key_specs");
    expect(s?.products.map((p) => p.slug)).toEqual(["helmet"]);
    await memoSettled();
  });
  it("reads the collections with their items and the best sellers by their days", async () => {
    env();
    const bodies: string[] = [];
    const f = vi.fn(async (u: string, init?: RequestInit) => {
      if (u.includes("store_collection_items")) return ok([{ collection: "picks", product_id: HELMET, sort: 1 }]);
      if (u.includes("store_collections")) return ok([{ slug: "picks", name_en: "Picks", on_store: true }]);
      bodies.push(String(init?.body));
      return ok([{ product_id: HELMET, units: 3 }]);
    }) as unknown as typeof fetch;
    expect((await loadColls(f, 1)).map((c) => [c.slug, c.items])).toEqual([["picks", [HELMET]]]);
    expect((await loadBest([30, 30, 7], f, 1)).get(7)).toEqual([HELMET]);
    expect(bodies.map((b) => JSON.parse(b).p_days).sort()).toEqual([30, 7].sort());
    await memoSettled();
  });
});
