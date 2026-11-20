import { describe, expect, it } from "vitest";
import { mkCategory, type MkCategory, type MkIndex, type MkListing, type MkShop } from "../market/core";
import {
  W1_KEPT_MAX, W1_NONE, W1_SEARCH_LISTINGS, W1_SITEMAP_LISTINGS, w1Append, w1Cut, w1Date, w1Digits, w1Facts, w1FiltersFrom, w1FiltersOf, w1Further, w1Href, w1Indexable, w1KeptKey,
  w1Key, w1MapUrl, w1MayKeep, w1Narrowed, w1Nearby, w1Norm, w1Others, w1Own, w1Paths, w1Price, w1Q, w1QueryOf, w1SearchItems, w1ShopFiltersOf, w1SportChips, w1Stage,
  w1TypeOptions, w1With, type W1Filters,
} from "../market/w1";
import { clampPan, clampScale, keyStep, pinchScale, stepPhoto, swipeStep } from "../market/w1-gallery";
import { w1Availability, w1ItemCondition, w1ProductData, w1ShopData } from "../market/w1-seo";

// Browsing the Marketplace (W1): the plain rules behind the browse page, a listing's page and a shop's page.
const cat = (slug: string, parent: string | null, sort: number, name_en = slug, name_ar = slug): MkCategory =>
  mkCategory({ slug, parent, name_en, name_ar, sort, tier: "open", needs_serial: false, min_photos: 1, facts: [] }) as MkCategory;
const CATS: MkCategory[] = [
  cat("cycling", null, 10, "Cycling", "الدراجات الهوائية"), cat("running", null, 20, "Running", "الجري"), cat("golf", null, 30, "Golf", "الغولف"),
  cat("cycling-bike-road", "cycling", 10, "Road bikes", "دراجات الطريق"), cat("cycling-helmets", "cycling", 20, "Helmets", "الخوذات"),
  cat("running-shoes", "running", 10, "Shoes", "الأحذية"),
];
const f = (patch: Partial<W1Filters> = {}): W1Filters => ({ ...W1_NONE, ...patch });

describe("the browse page's address", () => {
  it("reads each filter, checked, and leaves out what is not of its shape", () => {
    expect(w1FiltersOf({ sport: "cycling", seller: "shop", city: "jeddah", condition: "good", min: "100", max: "900", q: "  trek   domane ", sort: "price_asc" }, CATS))
      .toEqual({ sport: "cycling", type: null, seller: "shop", city: "jeddah", condition: "good", min: 100, max: 900, q: "trek domane", sort: "price_asc" });
    expect(w1FiltersOf({ sport: "chess", seller: "staff", city: "paris", condition: "mint", min: "0", max: "9999999", sort: "random", q: ["a", "b"] }, CATS))
      .toEqual(f({ q: "a" }));
    expect(w1FiltersOf(undefined, CATS)).toEqual(W1_NONE);
    expect(w1FiltersOf({ min: "-5", max: "12.5" }, CATS)).toEqual(W1_NONE);
  });
  it("takes a product type with its sport, and never a sport as a type", () => {
    expect(w1FiltersOf({ type: "cycling-helmets" }, CATS)).toMatchObject({ sport: "cycling", type: "cycling-helmets" });
    expect(w1FiltersOf({ type: "cycling-helmets", sport: "running" }, CATS)).toMatchObject({ sport: "cycling", type: "cycling-helmets" });
    expect(w1FiltersOf({ type: "cycling" }, CATS)).toMatchObject({ sport: null, type: null });
    expect(w1FiltersOf({ sport: "cycling-helmets" }, CATS)).toMatchObject({ sport: null, type: null });
  });
  it("takes a slug as it is when the categories could not be read, and nothing that is not a slug", () => {
    expect(w1FiltersOf({ sport: "cycling", type: "cycling-helmets" }, [])).toMatchObject({ sport: "cycling", type: "cycling-helmets" });
    expect(w1FiltersOf({ sport: "Cycling", type: "x'; drop" }, [])).toMatchObject({ sport: null, type: null });
  });
  it("turns a price range written backwards the right way round", () => {
    expect(w1FiltersOf({ min: "900", max: "100" }, CATS)).toMatchObject({ min: 100, max: 900 });
    expect(w1With(f({ min: 500 }), { max: 100 })).toMatchObject({ min: 100, max: 500 });
  });
  it("cleans the search words as the database cleans text, 80 characters at most", () => {
    expect(w1Q("  carbon‏   bike \u{1F6B2} ")).toBe("carbon bike");
    expect(w1Q("x".repeat(200))).toHaveLength(80);
    expect(w1Q(12)).toBe("");
  });
  it("reads a typed price in any digits, and a price only from 1 to 500,000", () => {
    expect(w1Digits("٣٬٥٠٠")).toBe("3500");
    expect(w1Digits("۱۲a3 4567")).toBe("123456");
    expect([w1Price("1"), w1Price("500000"), w1Price("500001"), w1Price("0"), w1Price(""), w1Price("1e3"), w1Price(250)]).toEqual([1, 500000, null, null, null, null, 250]);
  });
  it("writes one address for one set of filters, and reads it back the same", () => {
    const all = f({ sport: "cycling", type: "cycling-helmets", seller: "private", city: "riyadh", condition: "new", min: 50, max: 400, q: "giro mips", sort: "price_desc" });
    const href = w1Href("/marketplace", all);
    expect(href).toBe("/marketplace?q=giro+mips&type=cycling-helmets&seller=private&city=riyadh&condition=new&min=50&max=400&sort=price_desc");
    expect(w1FiltersOf(Object.fromEntries(new URL(href, "https://x").searchParams), CATS)).toEqual(all);
    expect(w1Href("/marketplace", W1_NONE)).toBe("/marketplace");
    expect(w1Href("/marketplace", f({ sport: "golf" }))).toBe("/marketplace?sport=golf");
    expect(w1Key(f({ sport: "golf" }))).not.toBe(w1Key(W1_NONE));
    expect(w1Key(f({ sport: "cycling", sort: "new" }))).toBe(w1Key(f({ sport: "cycling" })));
  });
  it("checks what Show more is sent exactly as it checks its own address", () => {
    expect(w1FiltersFrom({ sport: "cycling", min: 100, max: "50", seller: "company", q: "x", extra: { a: 1 } }, CATS)).toEqual(f({ sport: "cycling", min: 50, max: 100, seller: "company", q: "x" }));
    for (const v of [null, "sport=cycling", ["cycling"], 7]) expect(w1FiltersFrom(v, CATS)).toEqual(W1_NONE);
    expect(w1FiltersFrom({ sport: { $ne: null }, city: ["jeddah"], sort: 1 }, CATS)).toEqual(W1_NONE);
  });
  it("gives a shop's page its sport filter only", () => {
    expect(w1ShopFiltersOf({ sport: "running", seller: "private", q: "x", min: "5", sort: "price_asc" }, CATS)).toEqual(f({ sport: "running" }));
    expect(w1ShopFiltersOf({ sport: "nope" }, CATS)).toEqual(W1_NONE);
  });
});

describe("what is asked of market_browse", () => {
  it("is only what is set, under the database's own names", () => {
    expect(w1QueryOf(W1_NONE)).toEqual({});
    expect(w1QueryOf(f({ sport: "cycling", type: "cycling-helmets", seller: "shop", city: "jeddah", condition: "new", min: 10, max: 90, q: "giro", sort: "price_asc" })))
      .toEqual({ sport: "cycling", category: "cycling-helmets", kind: "shop", city: "jeddah", condition: "new", price_min: 10, price_max: 90, q: "giro", sort: "price_asc" });
    expect(w1QueryOf(f({ sport: "golf" }), { shop: "wheel-house", after: "c_24" })).toEqual({ sport: "golf", shop: "wheel-house", after: "c_24" });
    expect(w1QueryOf(W1_NONE, { after: null, limit: 24 })).toEqual({});
    expect(w1QueryOf(W1_NONE, { limit: 9 })).toEqual({ limit: 9 });
  });
  it("is newest first unless the visitor picked a price order: no seller kind is put ahead", () => {
    expect(w1QueryOf(f({ seller: "company" }))).toEqual({ kind: "company" });
    expect("sort" in w1QueryOf(f({ seller: "company" }))).toBe(false);
  });
  it("is kept a minute only for the first page of the common searches", () => {
    expect(w1KeptKey({})).toBe("|||");
    expect(w1KeptKey({ sport: "cycling" })).toBe("cycling|||");
    expect(w1KeptKey({ sport: "cycling", category: "cycling-helmets" })).toBe("cycling|cycling-helmets||");
    expect(w1KeptKey({ kind: "shop" })).toBe("||shop|");
    expect(w1KeptKey({ shop: "wheel-house" })).toBe("|||wheel-house");
    expect(w1KeptKey({ sort: "new", limit: 24 })).toBe("|||");
    for (const q of [{ q: "trek" }, { city: "jeddah" }, { condition: "good" as const }, { price_min: 5 }, { price_max: 5 }, { after: "c" }, { sort: "price_asc" as const }, { limit: 9 },
      { sport: "cycling", kind: "shop" as const }, { shop: "a-b", sport: "cycling" }, { sport: "Not A Slug" }]) expect(w1KeptKey(q)).toBeNull();
  });
  it("is kept for so many searches and no more, so what is kept never grows with what people type", () => {
    const seen = new Set<string>();
    expect(w1MayKeep(seen, "a", 2)).toBe(true);
    expect(w1MayKeep(seen, "b", 2)).toBe(true);
    expect(w1MayKeep(seen, "c", 2)).toBe(false);
    // one already kept stays kept, and one refused is not remembered
    expect(w1MayKeep(seen, "a", 2)).toBe(true);
    expect([...seen]).toEqual(["a", "b"]);
    const many = new Set<string>();
    for (let i = 0; i < W1_KEPT_MAX + 50; i++) w1MayKeep(many, `k${i}`);
    expect(many.size).toBe(W1_KEPT_MAX);
  });
});

describe("what the pickers offer", () => {
  it("shows a chip only for a sport with something on sale, and for the one picked", () => {
    expect(w1SportChips(CATS, ["running", "cycling", "unknown"], null).map((s) => s.slug)).toEqual(["cycling", "running"]);
    expect(w1SportChips(CATS, ["cycling"], "golf").map((s) => s.slug)).toEqual(["cycling", "golf"]);
    expect(w1SportChips(CATS, [], null)).toEqual([]);
  });
  it("lists the product types of the sport picked that have something on sale, and none without a sport", () => {
    expect(w1TypeOptions(CATS, { sport: "cycling", type: null }, ["cycling-helmets", "running-shoes"]).map((t) => t.slug)).toEqual(["cycling-helmets"]);
    expect(w1TypeOptions(CATS, { sport: "cycling", type: "cycling-bike-road" }, ["cycling-helmets"]).map((t) => t.slug)).toEqual(["cycling-bike-road", "cycling-helmets"]);
    expect(w1TypeOptions(CATS, { sport: null, type: null }, ["cycling-helmets"])).toEqual([]);
  });
  it("drops a product type when another sport is picked", () => {
    expect(w1With(f({ sport: "cycling", type: "cycling-helmets" }), { sport: "running" }, CATS)).toMatchObject({ sport: "running", type: null });
    expect(w1With(f({ sport: "cycling", type: "cycling-helmets" }), { sport: null }, CATS)).toMatchObject({ sport: null, type: null });
    expect(w1With(f({ sport: "cycling", type: "cycling-helmets" }), { seller: "shop" }, CATS)).toMatchObject({ type: "cycling-helmets", seller: "shop" });
  });
  it("counts the filters behind the Filters button, and knows a narrowed list from the whole one", () => {
    expect(w1Further(f({ type: "cycling-helmets", condition: "new", min: 5, max: 9 }))).toBe(3);
    expect(w1Further(f({ sport: "cycling", seller: "shop", city: "jeddah", q: "x" }))).toBe(0);
    expect(w1Narrowed(f({ sort: "price_asc" }))).toBe(false);
    expect(w1Narrowed(f({ q: "x" }))).toBe(true);
    expect(w1Narrowed(f({ max: 10 }))).toBe(true);
  });
  it("leads a search that found nothing to the same sport, the other sports on sale, then everything", () => {
    const near = w1Nearby(CATS, f({ sport: "cycling", q: "zzz" }), ["cycling", "running"]);
    expect(near.map((n) => n.key)).toEqual(["s:cycling", "s:running", "all"]);
    expect(near[0].filters).toEqual(f({ sport: "cycling" }));
    expect(near[2]).toMatchObject({ sport: null, filters: W1_NONE });
    // an empty sport is never offered, and the sport itself is not offered again when nothing else was picked
    expect(w1Nearby(CATS, f({ sport: "golf" }), ["cycling"]).map((n) => n.key)).toEqual(["s:cycling", "all"]);
    expect(w1Nearby(CATS, f({ q: "zzz" }), [])).toEqual([]);
  });
  it("adds more cards after the ones on the page, none twice", () => {
    expect(w1Append([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 3 }, { id: 3 }]).map((c) => c.id)).toEqual([1, 2, 3]);
    expect(w1Others([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }], 2, 2).map((c) => c.id)).toEqual([1, 3]);
  });
});

describe("a listing's page", () => {
  it("is on sale, reserved, sold for a while, or its seller's alone", () => {
    expect(["live", "reserved", "sold", "held", "hidden", "expired", "draft", "deleted"].map((s) => w1Stage(s as MkListing["status"])))
      .toEqual(["sale", "reserved", "sold", "private", "private", "private", "private", "private"]);
  });
  it("is listed by search engines only while the Marketplace is open and everybody can see it", () => {
    expect([w1Indexable("live", true), w1Indexable("reserved", true), w1Indexable("sold", true)]).toEqual([true, true, true]);
    expect([w1Indexable("live", false), w1Indexable("held", true), w1Indexable("hidden", true), w1Indexable("expired", true)]).toEqual([false, false, false, false]);
  });
  it("lists the facts that were filled in, in the form's order", () => {
    expect(w1Facts({ size: " M ", brand: "Trek", year: 2021, model: "", wheel_size: "700c" })).toEqual([
      { key: "brand", value: "Trek" }, { key: "year", value: "2021" }, { key: "wheel_size", value: "700c" }, { key: "size", value: "M" },
    ]);
    expect(w1Facts(null)).toEqual([]);
    expect(w1Facts({ brand: {} as unknown as string, year: NaN })).toEqual([]);
  });
  it("writes a date on Riyadh's calendar, in Western digits", () => {
    expect(w1Date("2026-11-20T22:30:00+00:00", "en")).toBe("21 Nov 2026");
    expect(w1Date("2026-11-20T09:00:00+00:00", "ar")).toMatch(/^20 .+ 2026$/);
    expect(w1Date("2026-11-20T09:00:00+00:00", "ar")).not.toMatch(/[٠-٩]/);
    expect([w1Date(null, "en"), w1Date("soon", "en")]).toEqual([null, null]);
  });
  it("cuts a long text at a whole word", () => {
    expect(w1Cut("Short text.")).toBe("Short text.");
    const cut = w1Cut(`${"word ".repeat(60)}`, 160);
    expect(cut.length).toBeLessThanOrEqual(160);
    expect(cut.endsWith("word…")).toBe(true);
    expect(w1Cut(null)).toBe("");
  });
  it("links a shop's map only at the map addresses the database takes", () => {
    expect(w1MapUrl("https://maps.app.goo.gl/abc")).toBe("https://maps.app.goo.gl/abc");
    expect(w1MapUrl("https://www.google.com/maps/place/x")).toBe("https://www.google.com/maps/place/x");
    for (const v of ["http://maps.app.goo.gl/abc", "https://evil.example/maps.google.com/", "javascript:alert(1)", "https://maps.google.com.evil.example/x", "", null]) expect(w1MapUrl(v)).toBeNull();
  });
});

describe("what search engines read", () => {
  const listing = (patch: Partial<MkListing> = {}): MkListing => ({
    id: 77, status: "live", title: "Trek Domane", description: "A road bike, ridden two seasons.", condition: "good", faults: null, price: 9500, negotiable: true, city: "jeddah",
    category: "cycling-bike-road", sport: "cycling", facts: { brand: "Trek", model: "Domane SL 5", year: 2021 }, serial_masked: "•••X42", declarations: {},
    photos: ["l77/0123456789abcdef0123456789abcdef.jpg", "/media/market/polygon.jpg", "https://evil.example/x.jpg"],
    seller: { kind: "private", name: "Sara A.", shop: null }, checked_at: null, published_at: "2026-11-20T09:00:00+00:00", sold_at: null,
    mine: false, own: null, thread_id: null, reported: false, can_message: true, ...patch,
  });
  const x = { locale: "en", category: "Road bikes", privateLabel: "Private seller", company: "MicroMobility" };
  type Product = { name: string; image?: string[]; brand?: { name: string }; offers: { price: number; priceCurrency: string; itemCondition: string; availability: string; seller: Record<string, string> } };

  it("names the condition as new or used, and whether it can still be bought", () => {
    expect(w1ItemCondition("new")).toBe("https://schema.org/NewCondition");
    for (const c of ["excellent", "good", "fair", "parts"]) expect(w1ItemCondition(c)).toBe("https://schema.org/UsedCondition");
    expect([w1Availability("live"), w1Availability("reserved"), w1Availability("sold")])
      .toEqual(["https://schema.org/InStock", "https://schema.org/LimitedAvailability", "https://schema.org/SoldOut"]);
  });
  it("writes a Product with one Offer: the price in riyals, the photos from the site's own address", () => {
    const p = w1ProductData(listing(), x) as Product;
    expect(p).toMatchObject({ "@type": "Product", name: "Trek Domane", sku: "77", category: "Road bikes", brand: { name: "Trek" }, model: "Domane SL 5" });
    expect(p.image).toEqual(["https://micromobility.sa/mkt/l77/0123456789abcdef0123456789abcdef.jpg", "https://micromobility.sa/media/market/polygon.jpg"]);
    expect(p.offers).toMatchObject({ "@type": "Offer", price: 9500, priceCurrency: "SAR", itemCondition: "https://schema.org/UsedCondition", availability: "https://schema.org/InStock" });
  });
  it("never models the site as the seller of someone else's item, and never indexes the name a private seller chose", () => {
    const priv = w1ProductData(listing(), x) as Product;
    expect(priv.offers.seller).toEqual({ "@type": "Person", name: "Private seller" });
    expect(JSON.stringify(priv)).not.toContain("Sara");
    expect(JSON.stringify(priv)).not.toMatch(/micromobility\.sa\/#organization|MicroMobility"/);
    const shop = w1ProductData(listing({ seller: { kind: "shop", name: null, shop: { slug: "wheel-house", name_en: "Wheel House Cycles", name_ar: null, logo: null } } }), x) as Product;
    expect(shop.offers.seller).toEqual({ "@type": "Organization", name: "Wheel House Cycles", url: "https://micromobility.sa/marketplace/shop/wheel-house" });
    const own = w1ProductData(listing({ seller: { kind: "company", name: null, shop: null } }), x) as Product;
    expect(own.offers.seller).toMatchObject({ "@type": "Organization", name: "MicroMobility" });
  });
  it("says a sold listing is sold, and nothing at all about one only its seller sees", () => {
    expect((w1ProductData(listing({ status: "sold" }), x) as Product).offers.availability).toBe("https://schema.org/SoldOut");
    for (const status of ["held", "hidden", "expired"] as const) expect(w1ProductData(listing({ status }), x)).toBeNull();
  });
  it("writes a shop as the business it registered: its name, its city, its VAT number", () => {
    const s: MkShop = { slug: "wheel-house", name_en: "Wheel House Cycles", name_ar: "بيت العجلات", logo: null, cr_no: "4030123456", cr_activity: "Retail", vat_no: "310123456700003",
      city: "jeddah", address: "Prince Sultan Road", map_url: null, about_en: "A bike shop.", about_ar: null, returns_en: null, returns_ar: null, sells: null, approved_at: "2026-11-01T10:00:00+00:00" };
    expect(w1ShopData(s, "ar")).toMatchObject({ "@type": "Store", name: "Wheel House Cycles", alternateName: "بيت العجلات", vatID: "310123456700003",
      url: "https://micromobility.sa/marketplace/shop/wheel-house?lang=ar", address: { addressLocality: "Jeddah", addressCountry: "SA" } });
  });
});

describe("the sitemap and the site's search", () => {
  const index: MkIndex = {
    listings: [{ id: 12, title: "Trek Domane" }, { id: 13, title: "دراجة طريق" }, { id: 0, title: "nope" }, { id: 14, title: " " }],
    shops: [{ slug: "wheel-house", name_en: "Wheel House Cycles", name_ar: "بيت العجلات" }, { slug: "Bad Slug", name_en: "x", name_ar: null }],
  };
  it("lists the browse page, the rules, every listing on sale and every approved shop - never an account's pages", () => {
    const paths = w1Paths(index);
    expect(paths).toEqual(["/marketplace", "/marketplace/rules", "/marketplace/shop/wheel-house", "/marketplace/12", "/marketplace/13", "/marketplace/14"]);
    for (const p of paths) expect(p).not.toMatch(/sell|mine|inbox|my-shop|apply/);
    expect(w1Paths(null)).toEqual(["/marketplace", "/marketplace/rules"]);
  });
  it("gives the search one entry per shop and per listing, found as the database would match it", () => {
    const items = w1SearchItems(index, "ar", { listing: "إعلان في السوق", shop: "متجر في السوق" });
    expect(items.map((i) => [i.title, i.href])).toEqual([[w1Own("بيت العجلات"), "/marketplace/shop/wheel-house"], [w1Own("Trek Domane"), "/marketplace/12"], [w1Own("دراجة طريق"), "/marketplace/13"]]);
    // what a seller or a shop wrote is set apart in its own direction: the search draws a title as plain text
    expect([w1Own("x").charCodeAt(0), w1Own("x").charCodeAt(2), w1Own("x")[1], w1Own("x").length]).toEqual([0x2068, 0x2069, "x", 3]);
    expect(items[1].title.toLowerCase()).toContain("trek dom");
    expect(items[2].words).toBe("دراجه طريق");
    expect(items[0].words).toContain("wheel house cycles");
    expect(w1SearchItems(index, "en", { listing: "l", shop: "s" })[0].title).toBe(w1Own("Wheel House Cycles"));
    expect(w1SearchItems(null, "en", { listing: "l", shop: "s" })).toEqual([]);
  });
  it("sends the browser, and the sitemap, the newest listings only: the Marketplace's own search has them all", () => {
    const many: MkIndex = { listings: Array.from({ length: 500 }, (_, i) => ({ id: 500 - i, title: `Item ${500 - i}` })), shops: [] };
    const items = w1SearchItems(many, "en", { listing: "l", shop: "s" });
    expect(items).toHaveLength(W1_SEARCH_LISTINGS);
    expect(items[0].href).toBe("/marketplace/500");
    const paths = w1Paths(many);
    expect(paths).toHaveLength(2 + W1_SITEMAP_LISTINGS);
    expect(paths[2]).toBe("/marketplace/500");
    expect(paths).not.toContain("/marketplace/1");
  });
  it("matches Arabic as people type it: no marks, one alef, the ya and the ha they use", () => {
    expect(w1Norm("دَرَّاجَة  الطَّرِيق")).toBe("دراجه الطريق");
    expect(w1Norm("أحذية إلى آخر ٱلمدى")).toBe("احذيه الي اخر المدي");
    expect(w1Norm("Trek—Domane, SL5!")).toBe("trek domane sl5");
    expect(w1Norm("مـــقاس")).toBe("مقاس");
  });
});

describe("a listing's photos", () => {
  it("steps through them without leaving either end", () => {
    expect([stepPhoto(0, 3, 1), stepPhoto(2, 3, 1), stepPhoto(0, 3, -1), stepPhoto(1, 3, -1), stepPhoto(5, 0, 1)]).toEqual([1, 2, 0, 0, 0]);
  });
  it("reads a sideways swipe as next or before, the other way round on a right-to-left page", () => {
    expect([swipeStep(-80, 5, false), swipeStep(80, 5, false), swipeStep(-80, 5, true), swipeStep(80, 5, true)]).toEqual([1, -1, -1, 1]);
    expect([swipeStep(-30, 0, false), swipeStep(-80, 90, false)]).toEqual([0, 0]);
  });
  it("reads the arrow key that points the reading way as next", () => {
    expect([keyStep("ArrowRight", false), keyStep("ArrowLeft", false), keyStep("ArrowRight", true), keyStep("ArrowLeft", true), keyStep("Enter", false)]).toEqual([1, -1, -1, 1, 0]);
  });
  it("zooms between the photo's own size and four times it, and never moves it out of the frame", () => {
    expect([clampScale(0.4), clampScale(1.01), clampScale(2.5), clampScale(9), clampScale(NaN)]).toEqual([1, 1, 2.5, 4, 1]);
    expect(pinchScale(1, 100, 250)).toBe(2.5);
    expect(pinchScale(2, 100, 20)).toBe(1);
    expect(pinchScale(2, 0, 20)).toBe(2);
    expect(clampPan(999, -999, 2, 300, 200)).toEqual({ x: 150, y: -100 });
    expect(clampPan(10, 10, 1, 300, 200)).toEqual({ x: 0, y: 0 });
    expect(clampPan(NaN, 5, 2, 300, 200)).toEqual({ x: 0, y: 5 });
  });
});
