import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bundleOf, categoryHref, colourPhoto, loadReviews, loadStore, photoAlt, photosFor, productHref, relatedOf, resetStore, reviewsOf, reviewSummary,
  sizeForHeight, sizeRow, storeOf, wasPrice, BOX_ICONS, KEY_SPEC_ICONS, type Store,
} from "../store";
import { orderExpected, orderOf, orderSteps, outAt, reviewable } from "../store-order";
import { bundleDiscount, buyNowHref, buyNowOf, cartLines } from "../cart";
import { deliveryOptions, readyDay } from "../store-delivery";
import { checkoutBody, EMPTY_ADDRESS, formProblems, refusalPlace } from "../store-form";
import { deliveryFee, paySettings } from "../pay/settings";
import { payError } from "../pay/http";
import { complaintsDays, deliverySlots, districtServed, LEGAL_DEFAULTS, lowStock, servedDistricts, slotDays, slotOk, storeLegal, storeSwitches } from "../store-settings";
import { EXCHANGE_DAYS, LEGAL_WARRANTY_MONTHS, POLICY, RETURN_DAYS, returnWindow, warrantyMonths, warrantyParts } from "../store-policy";
import { parseLater, parseSlugs, slugFirst, slugToggle } from "../store-lists";
import { zatcaAmount, zatcaFields, zatcaQr } from "../zatca";
import { memoSettled } from "../memo";
import { siteSchema } from "../../content/pages/site";
import { T as STORE_T } from "../../components/store/Store.text";
import { ICON_NAMES } from "../../components/store/icons";

// The store build's shared pieces (2026-11-15, CONTRACTS.md): the product's richer fields as the pages read them, the
// rules on top of them, the new settings, the order's new fields, the browser-kept lists and the invoice's QR. The
// database prices and checks everything itself (rentals 20261115200100); these keep the pages saying the same.
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const variant = (n: number, pid: string, x: Record<string, unknown> = {}) => ({ id: U(100 + n), product_id: pid, size: null, color_en: null, color_ar: null, color_hex: null, price: null, stock: 5, sort: n, ...x });
const product = (id: string, slug: string, x: Record<string, unknown> = {}) => ({
  id, slug, category: "accessories", brand: null, name_en: slug.toUpperCase(), name_ar: null, tagline_en: null, tagline_ar: null, description_en: null, description_ar: null,
  specs: [], images: [], price: 100, compare_at: null, ship_ksa: true, sort: 0, created_at: "2026-11-01T00:00:00Z", ...x,
});
const BIKE = U(1), HELMET = U(2), LIGHTS = U(3), CARD = U(4), OLD = U(5);
const IMG = ["/media/store/b/1.webp", "/media/store/b/2.webp", "/media/store/b/3.webp", "/media/store/b/4.webp"];

const STORE: Store = storeOf(
  [
    product(BIKE, "da54", {
      category: "bikes", price: 8000, ship_ksa: false, sort: 1, images: IMG,
      image_meta: { [IMG[0]]: { alt_en: "Rider on the black DA54", alt_ar: "راكب على DA54 الأسود", colour: "Black" }, [IMG[1]]: { colour: "Red", alt_en: "The red one" },
        [IMG[2]]: { alt_en: "Close-up" }, "/media/not-a-photo-of-it.webp": { alt_en: "ignored" } },
      key_specs: [{ icon: "weight", en: "10.4 kg", ar: "10.4 كغ" }, { icon: "laser", en: "Unknown icon" }, { icon: "gears", ar: "no English" }, "junk"],
      box: [{ icon: "bike", en: "The bike, fully built" }, { icon: "tools", en: "Allen keys" }],
      fit: { fit: { en: "Regular", ar: "عادي" }, best: { en: "Hot days" }, size: { ar: "no English" } },
      faq: [{ q: { en: "Is it built?", ar: "هل هي مركّبة؟" }, a: { en: "Yes, in our workshop." } }, { q: { en: "No answer" } }],
      sizes: [{ size: "S", height: { min: 160, max: 170 } }, { size: "M", height: { min: 171, max: 185 } }, { size: "L", height: { min: 186, max: null } },
        { size: "X", height: { min: 300, max: 400 } }, { size: "Y", height: { min: 180, max: 170 } }],
      goes_with: [HELMET, LIGHTS, BIKE, "not-a-uuid", HELMET.toUpperCase()], compare_with: [OLD],
      bundle: { items: [HELMET, LIGHTS], price: 8300 },
      sale_from: "2026-11-10", sale_to: "2026-11-20", compare_at: 9000,
      condition: "new", warranty_months: 36, catalog_model: "AAAAAAAA-0000-4000-8000-000000000001",
    }),
    product(HELMET, "helmet", { price: 450, sort: 2 }),
    product(LIGHTS, "lights", { price: 120, sort: 3 }),
    product(CARD, "gift-card", { category: "gift", kind: "gift_card", sort: 4 }),
    product(OLD, "ex-rental", { category: "bikes", kind: "gift_card", condition: "certified", warranty_months: 6, sort: 5 }),
  ],
  [
    variant(1, BIKE, { size: "S", color_en: "Black", stock: 2 }), variant(2, BIKE, { size: "M", color_en: "Black", stock: 1 }),
    variant(3, BIKE, { size: "M", color_en: "Red", stock: 1, price: 8100 }), variant(4, BIKE, { size: "L", color_en: "Red", stock: 0 }),
    variant(5, HELMET, { stock: 3 }), variant(6, LIGHTS, { stock: 9 }), variant(7, CARD, { size: "100", price: 100, stock: 999 }),
    variant(8, OLD, { size: "M", stock: 1 }),
  ],
);
const P = (slug: string) => STORE.products.find((p) => p.slug === slug)!;

describe("the product's richer fields", () => {
  it("are read with a malformed element dropped, never the product", () => {
    const b = P("da54");
    expect(b.key_specs).toEqual([{ icon: "weight", en: "10.4 kg", ar: "10.4 كغ" }, { icon: "other", en: "Unknown icon", ar: null }]);
    expect(b.box.map((x) => x.icon)).toEqual(["bike", "tools"]);
    expect(b.fit).toEqual({ fit: { en: "Regular", ar: "عادي" }, size: null, best: { en: "Hot days", ar: null } });
    expect(b.faq).toEqual([{ q: { en: "Is it built?", ar: "هل هي مركّبة؟" }, a: { en: "Yes, in our workshop.", ar: null } }]);
    expect(b.sizes.map((r) => r.size)).toEqual(["S", "M", "L"]);
    expect(b.sizes[2].height).toEqual({ min: 186, max: null });
    // a description belongs to one of the product's own photos
    expect(Object.keys(b.image_meta)).toEqual([IMG[0], IMG[1], IMG[2]]);
    expect(b.image_meta[IMG[1]]).toEqual({ alt_en: "The red one", alt_ar: null, colour: "Red" });
    // relations: ids only, each once, never the product itself
    expect(b.goes_with).toEqual([HELMET, LIGHTS]);
    expect(b.compare_with).toEqual([OLD]);
    expect(b.bundle).toEqual({ items: [HELMET, LIGHTS], price: 8300 });
    expect([b.sale_from, b.sale_to, b.warranty_months, b.catalog_model]).toEqual(["2026-11-10", "2026-11-20", 36, "aaaaaaaa-0000-4000-8000-000000000001"]);
  });

  it("a gift card is one only in the gift category; a row without the new columns reads as before", () => {
    expect(P("gift-card").kind).toBe("gift_card");
    expect(P("ex-rental").kind).toBe("item");
    const h = P("helmet");
    expect([h.kind, h.condition, h.warranty_months, h.fit, h.bundle, h.sale_from, h.catalog_model]).toEqual(["item", "new", null, null, null, null, null]);
    expect([h.key_specs, h.box, h.faq, h.sizes, h.goes_with, h.compare_with]).toEqual([[], [], [], [], [], []]);
    expect(h.image_meta).toEqual({});
    expect(storeOf([product(U(9), "x", { bundle: { items: [U(9)], price: 10 }, warranty_months: 500 })], []).products[0]).toMatchObject({ bundle: null, warranty_months: null });
  });

  it("every icon staff can pick is drawn", () => {
    for (const n of [...KEY_SPEC_ICONS, ...BOX_ICONS]) expect(ICON_NAMES).toContain(n);
  });
});

describe("the rules on top of them", () => {
  it("links a gift card to its own page, a category to its list", () => {
    expect(productHref(P("da54"))).toBe("/store/da54");
    expect(productHref(P("gift-card"))).toBe("/store/gift-card");
    expect(categoryHref("apparel")).toBe("/store/category/apparel");
  });

  it("shows a picked colour's photos, then those of no colour; describes each in the page's language", () => {
    const b = P("da54");
    expect(photosFor(b, "Black")).toEqual([IMG[0], IMG[2], IMG[3]]);
    expect(photosFor(b, "Red")).toEqual([IMG[1], IMG[2], IMG[3]]);
    expect(photosFor(b, "Green")).toEqual(IMG);
    expect(photosFor(b, null)).toEqual(IMG);
    expect(colourPhoto(b, "Red")).toBe(IMG[1]);
    expect(colourPhoto(b, "Green")).toBeNull();
    expect(photoAlt(b, IMG[0], "ar")).toBe("راكب على DA54 الأسود");
    expect(photoAlt(b, IMG[1], "ar")).toBe("The red one");
    expect(photoAlt(b, IMG[3], "en")).toBe("");
  });

  it("strikes a former price only beside a licence, between the licence's dates", () => {
    const b = P("da54");
    expect(wasPrice(b, "LIC-1", "2026-11-15")).toBe(9000);
    expect(wasPrice(b, null, "2026-11-15")).toBeNull();
    expect(wasPrice(b, "LIC-1", "2026-11-09")).toBeNull();
    expect(wasPrice(b, "LIC-1", "2026-11-21")).toBeNull();
    expect(wasPrice({ compare_at: 50, sale_from: null, sale_to: null }, true, "2030-01-01")).toBe(50);
  });

  it("puts the rider's height in a size and finds the size for a height", () => {
    const b = P("da54");
    expect(sizeRow(b, "M")?.height).toEqual({ min: 171, max: 185 });
    expect(sizeRow(b, "XL")).toBeNull();
    expect([sizeForHeight(b, 165), sizeForHeight(b, 171), sizeForHeight(b, 199), sizeForHeight(b, 150), sizeForHeight(b, NaN)]).toEqual(["S", "M", "L", null, null]);
  });

  it("names related products in staff's order, and the bundle only beside a licence", () => {
    expect(relatedOf(STORE, P("da54").goes_with).map((p) => p.slug)).toEqual(["helmet", "lights"]);
    expect(relatedOf(STORE, [U(77), HELMET, BIKE], BIKE).map((p) => p.slug)).toEqual(["helmet"]);
    expect(bundleOf(STORE, P("da54"), null)).toBeNull();
    const bd = bundleOf(STORE, P("da54"), "LIC-1")!;
    expect(bd.products.map((p) => p.slug)).toEqual(["da54", "helmet", "lights"]);
    expect([bd.price, bd.sum, bd.save]).toEqual([8300, 8570, 270]);
  });

  it("counts reviews, and averages them only from five", () => {
    const r = (n: number, rating: number) => ({ id: U(n), product_id: BIKE, rating, body: null, lang: "en", bought: "2026-11" });
    expect(reviewSummary([r(1, 5), r(2, 4), r(3, 4), r(4, 5)])).toEqual({ count: 4, avg: null });
    expect(reviewSummary([r(1, 5), r(2, 4), r(3, 4), r(4, 5), r(5, 3)])).toEqual({ count: 5, avg: 4.2 });
    expect(reviewsOf([{ id: U(1), product_id: BIKE, rating: 5, body: " Great ", bought_month: "2026-11" }, { id: U(2), product_id: BIKE, rating: 6, bought_month: "2026-11" },
      { id: U(3), product_id: BIKE, rating: 4, bought_month: "Nov" }])).toEqual([{ id: U(1), product_id: BIKE, rating: 5, body: "Great", lang: null, bought: "2026-11" }]);
  });

  it("gives the law's warranty at least: 2 years new, 1 year certified pre-owned", () => {
    expect(warrantyMonths(P("da54"))).toBe(36);
    expect(warrantyMonths(P("helmet"))).toBe(LEGAL_WARRANTY_MONTHS.new);
    expect(warrantyMonths(P("ex-rental"))).toBe(12);
    expect(warrantyMonths({ condition: "new", warranty_months: 12 })).toBe(24);
    expect(warrantyParts(24)).toEqual({ years: 2, months: 0 });
    expect(warrantyParts(18)).toEqual({ years: 1, months: 6 });
  });
});

describe("reading the store", () => {
  afterEach(() => { resetStore(); vi.unstubAllEnvs(); });
  const env = () => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://db.test"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); };
  const ok = (v: unknown) => new Response(JSON.stringify(v), { status: 200 });

  it("asks for the new columns, and reads again without them on a database that has none yet", async () => {
    env();
    const urls: string[] = [];
    const f = vi.fn(async (u: string) => {
      urls.push(u);
      if (u.includes("store_products") && u.includes("key_specs")) return new Response("{}", { status: 400 });
      if (u.includes("store_products")) return ok([product(BIKE, "da54")]);
      return ok([variant(1, BIKE)]);
    }) as unknown as typeof fetch;
    const s = await loadStore(f, 1);
    expect(s?.products.map((p) => p.slug)).toEqual(["da54"]);
    expect(urls.filter((u) => u.includes("store_products"))).toHaveLength(2);
    expect(urls[0]).toContain("image_meta");
    await memoSettled();
  });

  it("reads the reviews staff show, by product", async () => {
    env();
    const f = vi.fn(async (u: string) => {
      expect(u).toContain("store_reviews");
      expect(u).toContain("status=eq.shown");
      return ok([{ id: U(1), product_id: BIKE.toUpperCase(), rating: 5, body: "Good", bought_month: "2026-11" }]);
    }) as unknown as typeof fetch;
    const by = await loadReviews(f, 1);
    expect(by.get(BIKE)?.map((r) => r.rating)).toEqual([5]);
    await memoSettled();
  });
});

describe("delivery: the pickup switch (X01) and the day it is ready (F28)", () => {
  const base = { jeddah: { on: true, fee: 30, days: "1-2" }, ksa: { on: true, fee: 45, days: "4-7" }, freeOver: 500 };
  it("offers pickup unless staff switched it off; a delivery setting without it keeps it on", () => {
    const off = paySettings({ "store.delivery": { ...base, pickup: { on: false } } });
    expect(deliveryFee(off, "pickup", 100)).toBeNull();
    expect(deliveryOptions(off, { subtotal: 100, shipKsa: true }).map((o) => o.id)).toEqual(["jeddah", "ksa"]);
    const old = paySettings({ "store.delivery": base });
    expect(old.delivery.pickup.on).toBe(true);
    expect(deliveryFee(old, "pickup", 100)).toBe(0);
    expect(deliveryFee(old, "digital", 100)).toBe(0);
  });
  it("is ready on the last of pickup's days, Fridays not counted", () => {
    const s = paySettings({ "store.delivery": { ...base, pickup: { on: true, days: "1-2" } } });
    expect(readyDay(s, "2026-11-12")).toBe("2026-11-15"); // Thu + 2 working days, past Friday
    expect(readyDay(paySettings({}), "2026-11-12")).toBeNull();
    expect(deliveryOptions(s, { subtotal: 1, shipKsa: true })[0]).toEqual({ id: "pickup", fee: 0, days: "1-2" });
  });
});

describe("the store build's settings", () => {
  it("keeps Tabby, SMSA and the address lookup off until switched on", () => {
    expect(storeSwitches({})).toEqual({ tabby: false, smsa: false, addressLookup: false });
    expect(storeSwitches({ "store.tabby.on": true, "store.smsa.on": "true", "store.addressLookup.on": true })).toEqual({ tabby: true, smsa: false, addressLookup: true });
  });

  it("offers delivery days after the lead, without the days staff skip", () => {
    expect(deliverySlots({})).toBeNull();
    expect(deliverySlots({ "store.slots": { on: true, times: [] } })).toBeNull();
    const s = deliverySlots({ "store.slots": { on: true, ahead: 4, lead: 1, skip: [5, 9], times: [{ id: "am", from: "09:00", to: "13:00" }, { id: "bad", from: "9", to: "x" }] } })!;
    expect(s.times.map((t) => t.id)).toEqual(["am"]);
    expect(s.skip).toEqual([5]);
    // Thursday 12 Nov: the first working day after is Saturday 14 (Friday not counted), then four days without a Friday
    expect(slotDays(s, "2026-11-12")).toEqual(["2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17"]);
    expect(slotOk(s, "2026-11-12", { day: "2026-11-15", time: "am" })).toBe(true);
    expect(slotOk(s, "2026-11-12", { day: "2026-11-13", time: "am" })).toBe(false);
    expect(slotOk(s, "2026-11-12", { day: "2026-11-15", time: "pm" })).toBe(false);
  });

  it("checks a district against the served list while the check is on", () => {
    expect(servedDistricts({ "store.districts": { on: false, list: [{ en: "Al Rawdah" }] } })).toBeNull();
    const l = servedDistricts({ "store.districts": { on: true, list: [{ en: "Al Rawdah", ar: "الروضة" }, { ar: "no English" }] } })!;
    expect(l).toEqual([{ en: "Al Rawdah", ar: "الروضة" }]);
    expect([districtServed(l, " al  rawdah "), districtServed(l, "الروضة"), districtServed(l, "Al Safa"), districtServed(l, "")]).toEqual([true, true, false, false]);
  });

  it("reads low stock and the complaints' answer time in range", () => {
    expect([lowStock({}), lowStock({ "store.lowStock": 5 }), lowStock({ "store.lowStock": 99 })]).toEqual([3, 5, 3]);
    expect([complaintsDays({}), complaintsDays({ "store.complaintsDays": 3 }), complaintsDays({ "store.complaintsDays": 0 })]).toEqual([null, 3, null]);
  });

  it("names the seller from the Legal line: the certificates by default, nothing for what is not set", () => {
    const legal = siteSchema.sections.find((s) => s.id === "legal")!.fields;
    const def = (id: string) => (legal.find((f) => f.id === id) as { def: { en: string; ar: string } }).def;
    expect(LEGAL_DEFAULTS).toEqual({ legalName: def("legalName"), cr: def("cr").en, vat: def("vat").en });
    expect(storeLegal({}, "en")).toEqual({ legalName: "Micromobility Company Ltd.", cr: "1009107240", ecr: "", vat: "312555068900003", sbc: "" });
    expect(storeLegal({}, "ar").legalName).toBe(def("legalName").ar);
    const c = {
      "site.legal.cr": { en: "", ar: "" }, "site.legal.ecr": { en: "4030000000", ar: "4030000000" }, "site.legal.sbc": { href: "https://eauthenticate.saudibusiness.gov.sa/x" },
      "biz.public": { vat_no: "300000000000003" },
    };
    expect(storeLegal(c, "en")).toMatchObject({ cr: "", ecr: "4030000000", vat: "300000000000003", sbc: "https://eauthenticate.saudibusiness.gov.sa/x" });
    expect(storeLegal({ ...c, "site.legal.vat": { en: "311111111111113", ar: "311111111111113" } }, "en").vat).toBe("311111111111113");
    expect(storeLegal({ "site.legal.sbc": { href: "javascript:alert(1)" } }, "en").sbc).toBe("");
  });
});

describe("an order's new fields", () => {
  const raw = {
    id: "o1", no: 1042, status: "out", fulfil: "jeddah", name: "Huda", phone: "•••• 1234", subtotal: 8570, discount: 270, delivery_fee: 0, total: 8300,
    wallet_paid: 0, gift_paid: 100, vat: 1082.61, created_at: "2026-11-14T08:00:00Z", paid_at: "2026-11-14T08:05:00Z",
    discounts: [{ kind: "bundle", ref: "da54", amount: 270 }, { kind: "made-up", ref: "x", amount: 1 }], promo_code: null, gift: true, gift_note: "Happy birthday",
    slot: { day: "2026-11-16", time: "am" }, delivered_at: null,
    items: [{ id: 7, name: "DA54", variant: "M · Black", qty: 1, unit_price: 8000, product_id: BIKE, variant_id: U(102), image: "/media/a.webp", slug: "da54", gift_card: false, reviewed: false },
      { id: "8", name: "Gift card", qty: 1, unit_price: 100, product_id: CARD, gift_card: true }],
    events: [{ at: "2026-11-14T08:05:00Z", status: "paid" }, { at: "2026-11-15T07:00:00Z", status: "out" }],
    returns: [{ id: "r1", kind: "return", status: "open", items: [{ item_id: 7, qty: 1 }], reason: "wrong_size", created_at: "2026-11-15T09:00:00Z" }, { id: "", status: "open" }],
    gift_cards: [{ code: "GC-ABCD-EFGH-JKLM", amount: 100, balance: 100, status: "active" }, { amount: 5 }],
    refunds: [{ amount: 50, dest: "gift", status: "done", at: "2026-11-15T10:00:00Z" }],
  };
  it("are read; unknown discounts, returns and cards are left out", () => {
    const o = orderOf(raw)!;
    expect([o.status, o.fulfil, o.discount, o.gift_paid, o.gift, o.gift_note]).toEqual(["out", "jeddah", 270, 100, true, "Happy birthday"]);
    expect(o.discounts).toEqual([{ kind: "bundle", ref: "da54", amount: 270 }]);
    expect(o.slot).toEqual({ day: "2026-11-16", time: "am" });
    expect(o.items.map((i) => [i.id, i.gift_card, i.product_id])).toEqual([[7, false, BIKE], [8, true, CARD]]);
    expect(o.returns).toHaveLength(1);
    expect(o.returns[0]).toMatchObject({ kind: "return", status: "open", reason: "wrong_size", items: [{ item_id: 7, qty: 1 }], amount: null });
    expect(o.gift_cards).toEqual([{ code: "GC-ABCD-EFGH-JKLM", amount: 100, balance: 100, status: "active" }]);
    expect(o.refunds[0].dest).toBe("gift");
    // an order the database answered before the build still reads
    const before = orderOf({ id: "o2", no: 1, status: "paid", fulfil: "pickup", items: [{ name: "X", qty: 1, unit_price: 5 }] })!;
    expect([before.discount, before.gift, before.slot, before.returns, before.gift_cards, before.items[0].id]).toEqual([0, false, null, [], [], null]);
  });

  it("goes out for delivery on step three, and a gift card alone is paid then delivered", () => {
    expect(orderSteps({ status: "out", fulfil: "jeddah" })).toEqual({ steps: ["paid", "preparing", "out", "delivered"], at: 2 });
    expect(orderSteps({ status: "shipped", fulfil: "ksa" }).steps[2]).toBe("shipped");
    expect(orderSteps({ status: "paid", fulfil: "digital" })).toEqual({ steps: ["paid", "delivered"], at: 0 });
    expect(orderSteps({ status: "delivered", fulfil: "digital" }).at).toBe(1);
    const o = orderOf(raw)!;
    expect(outAt(o)).toBe("2026-11-15T07:00:00Z");
    expect(outAt({ ...o, status: "delivered" })).toBeNull();
    expect(orderExpected({ ...o, fulfil: "digital" }, paySettings({}))).toBeNull();
  });

  it("asks for a review of each delivered product once, never of a gift card", () => {
    const o = orderOf(raw)!;
    expect(reviewable(o)).toEqual([]);
    expect(reviewable({ ...o, status: "delivered" })).toEqual([BIKE]);
    expect(reviewable({ ...o, status: "delivered", items: o.items.map((i) => ({ ...i, reviewed: true })) })).toEqual([]);
  });

  it("can be returned for 7 days and exchanged for 15 from the day it was delivered, one request at a time", () => {
    const o = { ...orderOf(raw)!, status: "delivered" as const, delivered_at: "2026-11-01T20:30:00Z", returns: [] };
    const at = (iso: string) => returnWindow(o, Date.parse(iso));
    expect(at("2026-11-08T20:00:00Z")).toEqual({ ret: true, exchange: true }); // the 8th in Riyadh: day 7
    expect(at("2026-11-08T21:30:00Z")).toEqual({ ret: false, exchange: true }); // past midnight in Riyadh: day 8
    expect(at("2026-11-17T12:00:00Z")).toEqual({ ret: false, exchange: false });
    expect(returnWindow({ ...o, returns: orderOf(raw)!.returns }, Date.parse("2026-11-02T00:00:00Z"))).toEqual({ ret: false, exchange: false });
    expect(returnWindow({ ...o, status: "out" }, Date.parse("2026-11-02T00:00:00Z"))).toEqual({ ret: false, exchange: false });
    expect([RETURN_DAYS, EXCHANGE_DAYS]).toEqual([7, 15]);
  });
});

describe("the one return sentence (X03, L07)", () => {
  it("is the product page's wording on staging, so every language already has it", () => {
    expect(POLICY.en.returnSentence).toBe(STORE_T.en.returns);
    expect(POLICY.ar.returnSentence).toBe(STORE_T.ar.returns);
    expect(POLICY.en.returnSentence).toMatch(/7 days.*15 days/);
  });
});

describe("the cart: buy now (F35) and the bundle (F31)", () => {
  it("reads a buy-now address", () => {
    expect(buyNowOf(new URLSearchParams(`buy=${U(102).toUpperCase()}&qty=3`))).toEqual({ variant: U(102), qty: 3 });
    expect(buyNowOf({ buy: U(102), qty: "99" })).toEqual({ variant: U(102), qty: 1 });
    expect(buyNowOf({ buy: "nope" })).toBeNull();
    expect(buyNowHref(U(102), 2)).toBe(`/store/checkout?buy=${U(102)}&qty=2`);
  });

  it("takes the bundle's price for each complete set, beside a licence only", () => {
    const cart = [{ variant: U(101), qty: 2 }, { variant: U(105), qty: 1 }, { variant: U(106), qty: 3 }, { variant: U(107), qty: 1 }];
    const lines = cartLines(cart, STORE);
    expect(bundleDiscount(lines, null)).toEqual([]);
    // one set: 8000 + 450 + 120 = 8570 against 8300 (the second bike has no helmet)
    expect(bundleDiscount(lines, "LIC-1")).toEqual([{ ref: "da54", sets: 1, amount: 270 }]);
    expect(bundleDiscount(cartLines([{ variant: U(102), qty: 1 }, { variant: U(106), qty: 1 }], STORE), "LIC-1")).toEqual([]);
  });
});

describe("the browser-kept lists (F07, F08, F68)", () => {
  it("keep product slugs once each, newest first, a malformed list empty", () => {
    expect(parseSlugs('["da54","da54","Bad Slug",3,"helmet"]', 10)).toEqual(["da54", "helmet"]);
    expect(parseSlugs("{", 10)).toEqual([]);
    expect(slugFirst(["a1", "b2", "c3"], "c3", 2)).toEqual(["c3", "a1"]);
    expect(slugToggle(["a1"], "b2")).toEqual(["b2", "a1"]);
    expect(slugToggle(["a1", "b2"], "a1")).toEqual(["b2"]);
    expect(parseLater([{ variant: U(102), qty: 2 }, { variant: "x", qty: 1 }])).toEqual([{ variant: U(102), qty: 2 }]);
  });
});

describe("checkout's new fields", () => {
  const contact = { name: "Huda Buyer", phone: "0501112233", email: "" };
  it("sends the code, the gift card, the gift note and the Jeddah slot; a gift card alone sends no address", () => {
    const b = checkoutBody({ items: [{ variant: U(102), qty: 1 }], fulfil: "jeddah", contact, address: { ...EMPTY_ADDRESS, district: "Al Rawdah", street: "1st" },
      note: "", wallet: false, lang: "en", promo: " ride10 ", giftCard: "gc-abcd-efgh-jklm", gift: true, giftNote: " Enjoy ", slot: { day: "2026-11-16", time: "am" } });
    expect([b.promo, b.giftCard, b.gift, b.giftNote, b.slot]).toEqual(["RIDE10", "GC-ABCD-EFGH-JKLM", true, "Enjoy", { day: "2026-11-16", time: "am" }]);
    const d = checkoutBody({ items: [], fulfil: "digital", contact, address: EMPTY_ADDRESS, note: "", wallet: false, lang: "en", giftNote: "x", slot: { day: "2026-11-16", time: "am" } });
    expect([d.address, d.giftNote, d.slot, d.gift]).toEqual([undefined, undefined, undefined, undefined]);
    expect(formProblems({ fulfil: "digital", contact, address: EMPTY_ADDRESS })).toEqual([]);
  });
  it("places the new refusals on their fields, and maps the database's codes", () => {
    expect([refusalPlace("district"), refusalPlace("slot"), refusalPlace("promo_used"), refusalPlace("gift_on_gift")])
      .toEqual([{ field: "district" }, { field: "slot" }, { field: "promo" }, { field: "giftCard" }]);
    expect(payError({ status: 400, message: "STORE_PROMO_USED" })).toEqual({ error: "promo_used", status: 409 });
    expect(payError({ status: 500, message: "STORE_BUSY" })).toEqual({ error: "busy", status: 429 });
    expect(payError({ status: 400, message: "STORE_REVIEW_RATING" })).toEqual({ error: "invalid", status: 409 });
  });
});

describe("the invoice's ZATCA QR (L06)", () => {
  it("is the five fields in TLV, base64, as ZATCA's own example", () => {
    // ZATCA's e-invoicing guideline example: Bobs Records, 310122393500003, 2022-04-25T15:30:00Z, 1000.00, 150.00
    const qr = zatcaQr({ seller: "Bobs Records", vat: "310122393500003", at: "2022-04-25T15:30:00.000Z", total: 1000, vatAmount: 150 });
    expect(qr).toBe("AQxCb2JzIFJlY29yZHMCDzMxMDEyMjM5MzUwMDAwMwMUMjAyMi0wNC0yNVQxNTozMDowMFoEBzEwMDAuMDAFBjE1MC4wMA==");
    expect(zatcaFields(qr)).toEqual({ 1: "Bobs Records", 2: "310122393500003", 3: "2022-04-25T15:30:00Z", 4: "1000.00", 5: "150.00" });
  });
  it("carries an Arabic seller name by its bytes", () => {
    const f = zatcaFields(zatcaQr({ seller: "شركة التنقل الدقيق المحدودة", vat: "312555068900003", at: "2026-11-15T09:00:00Z", total: 8300, vatAmount: 1082.61 }))!;
    expect(f[1]).toBe("شركة التنقل الدقيق المحدودة");
    expect([f[4], f[5]]).toEqual(["8300.00", "1082.61"]);
    expect(zatcaAmount(5.5)).toBe("5.50");
  });
});

describe("the store build's calls to the database (lib/store-api.ts)", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  const calls: { fn: string; body: Record<string, unknown> }[] = [];
  const db = (status: number, answer: unknown) => {
    calls.length = 0;
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://db.test"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); vi.stubEnv("PAY_SERVER_KEY", "k".repeat(40));
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ fn: url.replace(/^.*\/rpc\//, ""), body: JSON.parse(String(init?.body ?? "{}")) });
      return new Response(JSON.stringify(answer), { status });
    }));
  };

  it("send the server key and the database's own names", async () => {
    const api = await import("../store-api");
    db(200, { code: "RIDE10", kind: "percent", value: 10, discount: 57, eligible: 570 });
    expect(await api.promoCheck(" ride10 ", [{ variant: U(105), qty: 1 }, { variant: "x", qty: 1 }])).toEqual({ ok: true, data: { code: "RIDE10", kind: "percent", value: 10, discount: 57, eligible: 570 } });
    expect(calls[0]).toEqual({ fn: "store_promo_check", body: { p_key: "k".repeat(40), p_code: "RIDE10", p_items: [{ variant: U(105), qty: 1 }] } });
    db(400, { message: "STORE_PROMO_USED" });
    expect(await api.promoCheck("RIDE10", [{ variant: U(105), qty: 1 }])).toEqual({ ok: false, error: "promo_used", status: 409 });
    db(200, { id: U(50) });
    expect((await api.stockRequest({ variant: U(104), name: "  Sami   Rider ", phone: "0501112233", lang: "ar" })).ok).toBe(true);
    expect(calls[0]).toMatchObject({ fn: "store_stock_request", body: { p_variant: U(104), p_name: "Sami Rider", p_lang: "ar" } });
    db(200, { id: "o1", no: 1042, status: "delivered", fulfil: "pickup", returns: [{ id: "r1", status: "open", reason: "damaged", kind: "return", items: [{ item_id: 7, qty: 1 }] }] });
    const r = await api.returnRequest({ no: 1042, key: "a".repeat(32), kind: "return", items: [{ item: 7, qty: 1 }], reason: "damaged", note: "" });
    expect(r.ok && r.data.returns[0].id).toBe("r1");
    expect(calls[0].body).toMatchObject({ p_no: 1042, p_kind: "return", p_items: [{ item_id: 7, qty: 1 }], p_reason: "damaged", p_note: null });
  });

  it("refuse what is malformed before asking, and keep the outside services off without their keys", async () => {
    const api = await import("../store-api");
    db(200, {});
    expect(await api.giftCardCheck("not a card")).toEqual({ ok: false, error: "gift", status: 409 });
    expect((await api.reviewAdd({ no: 1, key: "a".repeat(32), product: BIKE, rating: 6, body: "", lang: "en" })).ok).toBe(false);
    expect((await api.returnRequest({ no: 1, key: "short", kind: "return", items: [{ item: 1, qty: 1 }], reason: "damaged", note: "" })).ok).toBe(false);
    expect(calls).toHaveLength(0);
    expect(await api.addressLookup("RCMA7933", true, {})).toEqual({ ok: false, error: "lookup_off", status: 503 });
    expect(await api.tabbySession(U(1), false, { TABBY_SECRET_KEY: "s", TABBY_PUBLIC_KEY: "p", TABBY_MERCHANT_CODE: "m" })).toEqual({ ok: false, error: "tabby_off", status: 503 });
    expect(await api.smsaLabel(U(1), true, {})).toEqual({ ok: false, error: "smsa_off", status: 503 });
  });
});
