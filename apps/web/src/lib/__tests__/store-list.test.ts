import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ReactElement, type ReactNode } from "react";
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { TxProvider } from "@/i18n/TxProvider";
import { localize } from "@/i18n/tx";
import { storeOf, type Store } from "../store";
import { paySettings } from "../pay/settings";
import {
  bySlugs, cardWhen, cardWhens, categoryTiles, cleanFilters, facetsOf, filterCount, listOf, listProducts, listQueryOf, listQueryText, matches, noFilters,
  quickRoom, quickVariant, recentItems, sortSizes, warrantyText, whenFor, whenText, type CardWhens,
} from "../store-listing";
import { T as W } from "../../components/store/w2.text";

// The store's lists (chain w2, 2026-11-15): the category tiles and pages (O01-E, F01, F02), the filters (O05-C), the cards'
// delivery chip (F05), quick add (F06), Saved and Recently viewed (F07, F08), certified pre-owned (F53), and the cards and
// pieces as the server draws them in English and Arabic.
const render = renderUntyped as (el: ReactElement) => string;
const wrap = (locale: string, child: ReactNode) =>
  createElement(NextIntlClientProvider, { locale, messages: {} } as never, createElement(TxProvider, { locale, dict: null } as never, child));
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const variant = (n: number, pid: string, x: Record<string, unknown> = {}) => ({ id: U(100 + n), product_id: pid, size: null, color_en: null, color_ar: null, color_hex: null, price: null, stock: 5, sort: n, ...x });
const product = (id: string, slug: string, x: Record<string, unknown> = {}) => ({
  id, slug, category: "accessories", brand: null, name_en: slug.toUpperCase(), name_ar: null, tagline_en: null, tagline_ar: null, description_en: "Long text",
  description_ar: null, specs: [{ en: ["Weight", "1 kg"] }], images: [], price: 100, compare_at: null, ship_ksa: true, sort: 0, created_at: "2026-11-01T00:00:00Z", ...x,
});
const BIKE = U(1), HELMET = U(2), LIGHTS = U(3), CARD = U(4), USED = U(5), JERSEY = U(6), CAP = U(7);
const IMG = ["/media/store/b/1.webp", "/media/store/b/2.webp", "/media/store/b/3.webp", "/media/store/b/4.webp", "/media/store/b/5.webp", "/media/store/b/6.webp"];
const STORE: Store = storeOf(
  [
    product(BIKE, "da54", { category: "bikes", brand: "Alvas", name_ar: "دراجة DA54", price: 8000, ship_ksa: false, sort: 1, images: IMG,
      image_meta: { [IMG[0]]: { alt_en: "Rider on the black DA54", alt_ar: "راكب على DA54 الأسود", colour: "Black" } } }),
    product(HELMET, "helmet", { brand: "Camp", price: 450, sort: 2, images: ["/media/store/h/1.webp"], compare_at: 520, sale_from: "2026-11-10", sale_to: "2026-11-20" }),
    product(LIGHTS, "lights", { brand: "Alvas", price: 120, sort: 3 }),
    product(CARD, "gift-card", { category: "gift", kind: "gift_card", sort: 4, images: ["/media/store/g/1.webp"] }),
    product(USED, "da54-used", { category: "bikes", brand: "Alvas", condition: "certified", price: 5200, ship_ksa: false, sort: 5, images: ["/media/store/u/1.webp"] }),
    product(JERSEY, "jersey", { category: "apparel", brand: "Battle", price: 300, sort: 6, images: ["/media/store/j/1.webp"] }),
    product(CAP, "cap", { category: "apparel", brand: "Battle", price: 90, sort: 7 }),
  ],
  [
    variant(1, BIKE, { size: "L", color_en: "Black", color_ar: "أسود", color_hex: "#111111", stock: 2 }),
    variant(2, BIKE, { size: "M", color_en: "Black", color_ar: "أسود", color_hex: "#111111", stock: 0 }),
    variant(3, BIKE, { size: "M", color_en: "Red", color_ar: "أحمر", color_hex: "#aa2222", stock: 1, price: 8100 }),
    variant(4, HELMET, { stock: 3 }), variant(5, LIGHTS, { stock: 9 }),
    variant(6, CARD, { size: "100", price: 100, stock: 999 }), variant(7, CARD, { size: "500", price: 500, stock: 999 }),
    variant(8, USED, { size: "S", stock: 1 }),
    variant(9, JERSEY, { size: "XL", stock: 4 }), variant(10, JERSEY, { size: "S", stock: 4 }), variant(11, JERSEY, { size: "M", stock: 0 }),
    variant(12, CAP, { stock: 0 }),
  ],
);
const P = (slug: string) => STORE.products.find((p) => p.slug === slug)!;
const F = (x: Partial<ReturnType<typeof noFilters>>) => ({ ...noFilters(), ...x });
const slugs = (ps: { slug: string }[]) => ps.map((p) => p.slug);
const EN = localize(W, "en", null), AR = localize(W, "ar", null);

describe("the list's filters (O05-C)", () => {
  it("offer a filter only with two choices, sizes and colours only in stock, sizes in a shopper's order", () => {
    const fc = facetsOf(STORE.products);
    const of = (k: string) => fc.find((f) => f.key === k)?.options.map((o) => o.value);
    expect(fc.map((f) => f.key)).toEqual(["price", "size", "colour", "brand"]);
    expect(of("price")).toEqual(["0-500", "500-2000", "5000-10000"]); // the gift card's 500 too
    expect(of("size")).toEqual(["S", "M", "L", "XL"]); // the gift card's face values are no sizes; the jersey's M is sold out but the bike's is not
    expect(of("colour")).toEqual(["Black", "Red"]);
    expect(of("brand")).toEqual(["Alvas", "Battle", "Camp"]);
    expect(facetsOf([P("helmet"), P("lights")]).map((f) => f.key)).toEqual(["brand"]);
    expect(sortSizes(["XL", "42", "S", "One", "M", "38", "XS"])).toEqual(["XS", "S", "M", "XL", "38", "42", "One"]);
  });
  it("keep any choice of a filter and every filter set, a size and a colour on the same variant in stock", () => {
    const keep = (f: ReturnType<typeof F>) => slugs(STORE.products.filter((p) => matches(p, f)));
    expect(keep(F({ brand: ["Battle", "Camp"] }))).toEqual(["helmet", "jersey", "cap"]);
    expect(keep(F({ price: ["0-500"], brand: ["Alvas"] }))).toEqual(["lights"]);
    expect(keep(F({ size: ["M"] }))).toEqual(["da54"]);
    expect(keep(F({ size: ["M"], colour: ["Black"] }))).toEqual([]); // the black M is sold out
    expect(keep(F({ size: ["L"], colour: ["Black"] }))).toEqual(["da54"]);
    expect(keep(F({ price: ["5000-10000"] }))).toEqual(["da54", "da54-used"]);
    expect(filterCount(F({ size: ["M", "L"], brand: ["Alvas"] }))).toBe(3);
  });
  it("live in the address with the order, and a stale choice from an old link is dropped", () => {
    const q = listQueryOf(new URLSearchParams("size=M&size=L&brand=Alvas&sort=price-asc&price=nope&cat=bikes"));
    expect(q.sort).toBe("price-asc");
    expect(q.filters).toEqual(F({ size: ["M", "L"], brand: ["Alvas"], price: ["nope"] }));
    expect(cleanFilters(q.filters, facetsOf(STORE.products))).toEqual(F({ size: ["M", "L"], brand: ["Alvas"] }));
    expect(listQueryOf({ sort: "bogus", colour: ["Black", "Black"] })).toEqual({ sort: "featured", filters: F({ colour: ["Black"] }) });
    expect(listQueryText("utm=x&cat=bikes&size=S", F({ size: ["M"] }), "new")).toBe("?utm=x&size=M&sort=new");
    expect(listQueryText("", noFilters(), "featured")).toBe("");
  });
  it("draw the certified pre-owned products apart, under the new ones (F53)", () => {
    const { fresh, certified } = listOf(STORE.products, noFilters(), "featured");
    expect(slugs(certified)).toEqual(["da54-used"]);
    expect(slugs(fresh)).toEqual(["da54", "helmet", "lights", "gift-card", "jersey", "cap"]);
    expect(slugs(listOf(STORE.products, noFilters(), "price-asc").fresh).at(-1)).toBe("cap"); // sold out goes last
  });
});

describe("a card", () => {
  it("adds straight to the cart only one-size gear in stock (F06): never a bike, a gift card or a choice to make", () => {
    expect(quickVariant(P("helmet"))?.id).toBe(U(104));
    expect(quickVariant(P("lights"))?.id).toBe(U(105));
    expect(quickVariant(P("da54"))).toBeNull();
    expect(quickVariant(P("da54-used"))).toBeNull();
    expect(quickVariant(P("gift-card"))).toBeNull();
    expect(quickVariant(P("jersey"))).toBeNull();
    expect(quickVariant(P("cap"))).toBeNull(); // sold out
  });
  it("never puts more in the cart from a card than is in stock, 10 a line at most (F06, L11)", () => {
    const helmet = quickVariant(P("helmet"))!; // 3 in stock
    expect(quickRoom([], helmet)).toBe(3);
    expect(quickRoom([{ variant: helmet.id.toLowerCase(), qty: 2 }], helmet)).toBe(1);
    expect(quickRoom([{ variant: helmet.id.toLowerCase(), qty: 3 }], helmet)).toBe(0); // all of it is in the cart already
    expect(quickRoom([{ variant: U(999), qty: 5 }], { id: helmet.id.toUpperCase(), stock: 50 })).toBe(10);
    expect(quickRoom([{ variant: helmet.id.toLowerCase(), qty: 10 }], { id: helmet.id, stock: 50 })).toBe(0);
  });
  it("names the day it can be had from the delivery staff set (F05): Jeddah first, then the courier, then the showroom", () => {
    const set = (d: Record<string, unknown>) => paySettings({ "pay.enabled": true, "store.delivery": d });
    const today = "2026-11-16"; // a Monday
    const both = set({ pickup: { on: true, days: "0" }, jeddah: { on: true, fee: 30, days: "1" }, ksa: { on: true, fee: 45, days: "3-5" } });
    expect(cardWhen(both, true, today)).toEqual({ way: "jeddah", day: "2026-11-17", by: false });
    const noJeddah = set({ pickup: { on: true, days: "1-2" }, jeddah: { on: false }, ksa: { on: true, fee: 45, days: "3-5" } });
    expect(cardWhen(noJeddah, true, today)).toEqual({ way: "ksa", day: "2026-11-22", by: true }); // Friday is not counted
    expect(cardWhen(noJeddah, false, today)).toEqual({ way: "pickup", day: "2026-11-18", by: true });
    expect(cardWhen(set({ pickup: { on: false }, jeddah: { on: true } }), true, today)).toBeNull(); // no days named: no promise
    const en = (w: Parameters<typeof whenText>[0]) => whenText(w, today, "en-GB", EN);
    expect(en({ way: "jeddah", day: "2026-11-17", by: false })).toBe("Tomorrow in Jeddah");
    expect(en({ way: "jeddah", day: "2026-11-16", by: false })).toBe("Today in Jeddah");
    expect(en({ way: "jeddah", day: "2026-11-17", by: true })).toBe("By tomorrow in Jeddah");
    expect(en({ way: "jeddah", day: "2026-11-19", by: true })).toBe("By Thu 19 Nov in Jeddah");
    expect(en({ way: "ksa", day: "2026-11-22", by: true })).toBe("By Sun 22 Nov");
    expect(en({ way: "pickup", day: "2026-11-17", by: false })).toBe("Ready tomorrow");
    expect(whenText({ way: "jeddah", day: "2026-11-17", by: false }, today, "ar-SA-u-nu-latn-ca-gregory", AR)).toBe("غداً في جدة");
    expect(whenText({ way: "jeddah", day: "2026-11-19", by: true }, today, "ar-SA-u-nu-latn-ca-gregory", AR)).toMatch(/^بحلول .*19.* في جدة$/);
    const w = cardWhens(both, today, "en-GB", EN);
    expect(w).toEqual({ ship: { text: "Tomorrow in Jeddah", way: "jeddah" }, local: { text: "Tomorrow in Jeddah", way: "jeddah" } });
    expect(whenFor(P("cap"), w)).toBeNull(); // sold out: nothing is promised
    expect(whenFor(P("gift-card"), w)).toBeNull();
    expect(whenFor(P("da54"), w)?.text).toBe("Tomorrow in Jeddah");
  });
  it("says a certified pre-owned bike's warranty: the law's year, or staff's longer term", () => {
    expect(warrantyText({ condition: "certified", warranty_months: null }, EN)).toBe("1-year warranty");
    expect(warrantyText({ condition: "certified", warranty_months: 18 }, EN)).toBe("18-month warranty");
    expect(warrantyText({ condition: "certified", warranty_months: 36 }, EN)).toBe("3-year warranty");
    expect(warrantyText({ condition: "new", warranty_months: null }, AR)).toBe("ضمان سنتين");
  });
});

describe("the store page's tiles and the browser-kept rows", () => {
  it("give each category with a product a tile, with its first photo of one in stock (O01-E)", () => {
    expect(categoryTiles(STORE.products)).toEqual([
      { cat: "bikes", image: IMG[0] }, { cat: "accessories", image: "/media/store/h/1.webp" }, { cat: "apparel", image: "/media/store/j/1.webp" }, { cat: "gift", image: "/media/store/g/1.webp" },
    ]);
  });
  it("name kept products in the list's order, a slug no longer sold left out (F07, F08)", () => {
    expect(slugs(bySlugs(STORE.products, ["cap", "gone", "da54", "helmet"], 2))).toEqual(["cap", "da54"]);
    expect(recentItems([P("da54")], "ar")).toEqual([{ slug: "da54", kind: "item", name: "دراجة DA54", image: IMG[0] }]);
  });
  it("hand the cards no long texts, five photos at most and those photos' descriptions", () => {
    const [bike] = listProducts([P("da54")]);
    expect(bike.images).toEqual(IMG.slice(0, 5));
    expect(bike.description_en).toBeNull();
    expect(bike.specs).toEqual([]);
    expect(Object.keys(bike.image_meta)).toEqual([IMG[0]]);
  });
});

describe("the lists as the server draws them", () => {
  const whens: CardWhens = { ship: { text: "Tomorrow in Jeddah", way: "jeddah" }, local: { text: "Ready tomorrow", way: "pickup" } };
  const grid = async (locale: string, licence: boolean, today = "2026-11-16") => {
    const { default: StoreGrid } = await import("@/components/store/StoreGrid");
    return render(wrap(locale, createElement(StoreGrid, { locale, products: listProducts(STORE.products), start: { sort: "featured", filters: noFilters() }, licence, today, whens })));
  };
  it("draw every card with its heart, photo strip, colour dots and delivery chip, the filters beside them, and no emoji", async () => {
    const html = await grid("en", false);
    expect(html).toContain('aria-label="Save DA54"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('alt="Rider on the black DA54"'); // a described photo says what it shows (X10)
    expect(html.match(/class="st-strip-i"/g)?.length).toBeGreaterThanOrEqual(5 + 1);
    expect(html).toContain('aria-label="Next photo"');
    expect(html).toContain('aria-label="Colours: Black, Red"');
    expect(html).toContain("Tomorrow in Jeddah");
    expect(html).toContain("Ready tomorrow"); // a bike's chip (it is not shipped)
    expect(html).toContain("<legend>Price</legend>");
    expect(html).toContain("<legend>Brand</legend>");
    expect(html).toContain("Certified pre-owned");
    expect(html).toContain("1-year warranty");
    expect(html.match(/class="st-quick"/g)?.length).toBe(2); // the helmet and the lights
    expect(html).toContain('aria-label="Add HELMET to cart"');
    expect(html).not.toContain("st-was"); // no former price without a licence
    expect(html).not.toMatch(/\p{Extended_Pictographic}/u);
  });
  it("strike a former price only beside a licence and between its dates (F107)", async () => {
    expect(await grid("en", true)).toContain("st-was");
    expect(await grid("en", true, "2026-11-25")).not.toContain("st-was");
  });
  it("speak Arabic on an Arabic page, the arrows mirroring", async () => {
    const html = await grid("ar", false);
    expect(html).toContain("مستعمل معتمد");
    expect(html).toContain('aria-label="حفظ دراجة DA54"');
    expect(html).toContain("st-ic-flip");
    expect(html).toContain("<legend>العلامة التجارية</legend>");
  });
  it("say when filters keep nothing, and offer to clear them", async () => {
    const { default: StoreGrid } = await import("@/components/store/StoreGrid");
    const html = render(wrap("en", createElement(StoreGrid, { locale: "en", products: listProducts(STORE.products), start: { sort: "featured", filters: F({ size: ["M"], colour: ["Black"] }) },
      licence: false, today: "2026-11-16", whens })));
    expect(html).toContain("Nothing matches these filters.");
    expect(html).toContain("Clear filters");
    expect(html).toContain("Filters (2)");
  });
  it("draw the tiles, a category page's chips, the brand band and the showroom", async () => {
    const { BrandBand, CategoryChips, CategoryTiles, Showroom } = await import("@/components/store/StoreExtras");
    const { T } = await import("@/components/store/Store.text");
    const t = localize(T, "en", null);
    const tiles = render(wrap("en", createElement(CategoryTiles, { tiles: categoryTiles(STORE.products), t })));
    expect(tiles).toContain('href="/store/category/bikes"');
    expect(tiles).toContain(">Accessories<");
    expect(render(wrap("en", createElement(CategoryTiles, { tiles: [{ cat: "bikes", image: null }], t })))).toBe("");
    const chips = render(wrap("en", createElement(CategoryChips, { cats: ["bikes", "apparel"], at: "apparel", t })));
    expect(chips).toMatch(/href="\/store\/category\/apparel" aria-current="page"|aria-current="page"[^>]*href="\/store\/category\/apparel"/);
    expect(chips).toContain('href="/store"');
    const band = render(wrap("en", createElement(BrandBand, { w: EN, showroom: true })));
    for (const s of ["Official distributor", "Built in Jeddah", "Visit the showroom", 'href="#st-showroom"']) expect(band).toContain(s);
    const room = render(wrap("en", createElement(Showroom, { address: "Al Sharafeyah, Jeddah", hours: "Sat–Thu 2pm–10pm", href: "https://maps.app.goo.gl/x", w: EN })));
    for (const s of ["Al Sharafeyah, Jeddah", "Sat–Thu 2pm–10pm", "Directions", 'href="https://maps.app.goo.gl/x"', 'id="st-showroom"']) expect(room).toContain(s);
    expect(render(wrap("en", createElement(Showroom, { address: " ", hours: "", href: "", w: EN })))).toBe("");
    expect(band + room).not.toMatch(/\p{Extended_Pictographic}/u);
  });
  it("wait for the browser's own lists before drawing Saved, Recently viewed or the header's Saved link", async () => {
    const { default: SavedList } = await import("@/components/store/SavedList");
    const { default: RecentRow } = await import("@/components/store/RecentRow");
    const { default: SavedLink } = await import("@/components/store/SavedLink");
    expect(render(wrap("en", createElement(SavedList, { locale: "en", products: listProducts(STORE.products), licence: false, today: "2026-11-16", whens })))).toContain("st-cart-wait");
    expect(render(wrap("en", createElement(RecentRow, { items: recentItems(STORE.products, "en"), locale: "en" })))).toBe("");
    expect(render(wrap("en", createElement(SavedLink)))).toBe("");
  });
});

describe("the list pages", () => {
  const src = (p: string) => readFileSync(join(__dirname, "../../app/[locale]/store", p), "utf8");
  it("lead the store page with the tiles and every product, the band, the showroom and Recently viewed under them, no licence line (L10)", () => {
    const s = src("page.tsx");
    const at = (x: string) => s.indexOf(x);
    expect(at("<CategoryTiles")).toBeGreaterThan(0);
    expect(at("<CategoryTiles")).toBeLessThan(at("<StoreGrid"));
    expect(at("<StoreGrid")).toBeLessThan(at("<BrandBand"));
    expect(at("<BrandBand")).toBeLessThan(at("<Showroom"));
    expect(at("<Showroom")).toBeLessThan(at("<RecentRow"));
    expect(s).not.toContain("st-licence");
    expect(s).toContain("redirect(");
  });
  it("give each category its page with the chips, and Saved its own, never indexed", () => {
    expect(src("category/[cat]/page.tsx")).toContain("<CategoryChips");
    expect(src("category/[cat]/page.tsx")).toContain("notFound()");
    expect(src("saved/page.tsx")).toContain("noindex: true");
  });
});
