import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createElement, type ReactElement, type ReactNode } from "react";
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { TxProvider } from "@/i18n/TxProvider";
import { storeOf, type Store, type StoreReview } from "../store-core";
import {
  addonsOf, avgText, choiceKind, choicesOf, cmText, compareTable, leanProduct, monthLabel, productLd, riderHeight, specGroupOf, specTable,
  splitBasis, starsOf, waHref, waNumber, cartRoom,
} from "../store-sections";
import { T as W } from "../../components/store/w3b.text";
import SpecTable from "../../components/store/pdp/SpecTable";
import InTheBox from "../../components/store/pdp/InTheBox";
import FitPanel from "../../components/store/pdp/FitPanel";
import ProductFaq from "../../components/store/pdp/ProductFaq";
import CompleteRide from "../../components/store/pdp/CompleteRide";
import StarterBundle from "../../components/store/pdp/StarterBundle";
import CompareBikes from "../../components/store/pdp/CompareBikes";
import TradeIn from "../../components/store/pdp/TradeIn";
import ReviewList from "../../components/store/pdp/ReviewList";

// The product page's sections below the buy box (store build 2026-11-15, w3b): the grouped specifications with the rider
// height first and the weight's basis (F36), what's in the box (F37), the fit panel (F38), the questions (F41), the
// add-ons with their own Add (F30, D17-C), the starter set only beside the licence (F31), the comparison (F10, O09-B),
// trade-in on WhatsApp (F52), verified buyers' reviews with the average only from five (F42) and the structured data
// (F45). Rules first, then the sections as the server draws them in English and Arabic.
const render = renderUntyped as (el: ReactElement) => string;
const wrap = (locale: string, child: ReactNode) =>
  createElement(NextIntlClientProvider, { locale, messages: {} } as never, createElement(TxProvider, { locale, dict: null } as never, child));
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const variant = (n: number, pid: string, x: Record<string, unknown> = {}) => ({ id: U(100 + n), product_id: pid, size: null, color_en: null, color_ar: null, color_hex: null, price: null, stock: 5, sort: n, ...x });
const product = (id: string, slug: string, x: Record<string, unknown> = {}) => ({
  id, slug, category: "accessories", brand: null, name_en: slug.toUpperCase(), name_ar: null, tagline_en: null, tagline_ar: null, description_en: null, description_ar: null,
  specs: [], images: [], price: 100, compare_at: null, ship_ksa: true, sort: 0, created_at: "2026-11-01T00:00:00Z", ...x,
});
const BIKE = U(1), HELMET = U(2), LIGHTS = U(3), CARD = U(4), OTHER = U(5), GONE = U(6), JERSEY = U(7), THIRD = U(8);
const spec = (en: [string, string], ar?: [string, string]) => ({ en, ar });

const STORE: Store = storeOf(
  [
    product(BIKE, "max", {
      category: "bikes", brand: "Alvas", name_en: "DA54 MAX", name_ar: "دي إيه 54 ماكس", price: 8435, ship_ksa: false, sort: 1, images: ["/media/store/max/1.webp"],
      image_meta: { "/media/store/max/1.webp": { alt_en: "Rider on the DA54 MAX", alt_ar: "راكب على DA54 MAX" } },
      description_en: "A light endurance bike.",
      specs: [
        spec(["Frame", "Carbon"], ["الإطار", "كربون"]), spec(["Groupset", "Shimano 105, 2x12"]), spec(["Wheels", "700c alloy"]),
        spec(["Weight", "10.4 kg (size M)"], ["الوزن", "10.4 كغ (مقاس M)"]), spec(["Brakes", "Hydraulic disc"]), spec(["Sizes", "S, M, L"]),
      ],
      sizes: [{ size: "S", height: { min: 160, max: 170 } }, { size: "M", height: { min: 171, max: 185 } }, { size: "L", height: { min: 186, max: 195 } }, { size: "XL", height: { min: 196, max: null } }],
      key_specs: [{ icon: "weight", en: "10.4 kg", ar: "10.4 كغ" }, { icon: "gears", en: "2x12" }, { icon: "other", en: "Made for heat" }],
      box: [{ icon: "bike", en: "The bike, fully built", ar: "الدراجة مركّبة بالكامل" }, { icon: "pedals", en: "Pedals" }],
      faq: [{ q: { en: "Is it built?", ar: "هل هي مركّبة؟" }, a: { en: "Yes, in our workshop.\n\nAnd checked again." } }, { q: { en: "Can I test ride it?" }, a: { en: "Yes." } }],
      goes_with: [HELMET, LIGHTS, CARD, GONE, U(99)], compare_with: [OTHER, THIRD, CARD],
      bundle: { items: [HELMET, LIGHTS], price: 8800 },
    }),
    product(HELMET, "helmet", { name_en: "Aero Helmet", name_ar: "خوذة انسيابية", price: 520, sort: 2, images: ["/media/store/helmet/1.webp"] }),
    product(LIGHTS, "lights", { name_en: "Lights", price: 200, sort: 3 }),
    product(CARD, "gift", { category: "gift", kind: "gift_card", price: 100, sort: 4 }),
    product(OTHER, "sl", {
      category: "bikes", name_en: "DA54 SL", price: 6500, sort: 5, images: ["/media/store/sl/1.webp"],
      key_specs: [{ icon: "weight", en: "11.2 kg" }, { icon: "brakes", en: "Mechanical disc" }], sizes: [{ size: "M", height: { min: 165, max: 180 } }],
    }),
    product(GONE, "gone", { price: 90, sort: 6 }),
    product(JERSEY, "jersey", {
      category: "apparel", name_en: "Club Jersey", price: 250, sort: 7,
      specs: [spec(["Material", "Recycled polyester"]), spec(["Care", "Machine wash cold"])],
      fit: { fit: { en: "Regular", ar: "عادي" }, size: { en: "Your normal size" }, best: { en: "Hot days", ar: "الأيام الحارة" } },
    }),
    product(THIRD, "kid", { category: "bikes", name_en: "Kid 20", price: 1500, sort: 8 }),
  ],
  [
    variant(1, BIKE, { size: "S", stock: 2 }), variant(2, BIKE, { size: "M", stock: 4 }), variant(3, BIKE, { size: "L", stock: 1 }),
    variant(4, HELMET, { size: "M", color_en: "Black", color_ar: "أسود", stock: 3 }), variant(5, HELMET, { size: "L", color_en: "Black", color_ar: "أسود", stock: 0 }),
    variant(6, HELMET, { size: "M", color_en: "White", color_ar: "أبيض", stock: 2, price: 560 }),
    variant(7, LIGHTS, { stock: 9 }), variant(8, CARD, { stock: 999 }), variant(9, OTHER, { size: "M", stock: 2 }),
    variant(10, GONE, { stock: 0 }), variant(11, JERSEY, { size: "M", stock: 3 }), variant(12, THIRD, { stock: 1 }),
  ],
);
const P = (slug: string) => STORE.products.find((p) => p.slug === slug)!;
const review = (n: number, rating: number, x: Partial<StoreReview> = {}): StoreReview => ({ id: U(500 + n), product_id: BIKE, rating, body: null, lang: "en", bought: "2026-11", ...x });
const WORDS = { cm: W.en.cm, upToCm: W.en.upToCm };
const strip = (s: string) => s.replace(/[⁦-⁩]/g, "");
const NO_EMOJI = /\p{Extended_Pictographic}/u;
// The structured data as plain objects, to read its fields.
type Ld = { [k: string]: unknown; offers: Record<string, unknown>; aggregateRating?: unknown };
const ld = (p: Parameters<typeof productLd>[0], reviews: StoreReview[] = [], locale = "en") => productLd(p, { locale, reviews }) as Ld;

describe("the specification table (F36)", () => {
  it("puts a bike's rows in groups, the rider height its sizes cover first and the weight with its basis", () => {
    const g = specTable(P("max"), "en");
    expect(g.map((x) => x.id)).toEqual(["size", "frame", "drive", "brakes", "wheels"]);
    expect(g[0].rows[0]).toEqual({ kind: "rider", range: { min: 160, max: 195 } });
    expect(g[0].rows[1]).toEqual({ kind: "spec", label: "Weight", value: "10.4 kg", basis: "size M" });
    expect(g[0].rows[2]).toMatchObject({ label: "Sizes", value: "S, M, L", basis: null });
  });
  it("writes Arabic rows on an Arabic page, the weight's basis split there too", () => {
    const g = specTable(P("max"), "ar");
    expect(g[0].rows[1]).toEqual({ kind: "spec", label: "الوزن", value: "10.4 كغ", basis: "مقاس M" });
    expect(g[1].rows[0]).toMatchObject({ label: "الإطار", value: "كربون" });
    expect(g[2].rows[0]).toMatchObject({ label: "Groupset" }); // no Arabic written: the English
  });
  it("keeps any other product's rows in one table with no headings, and has no rider height without heights", () => {
    expect(specTable(P("jersey"), "en")).toEqual([{ id: null, rows: [
      { kind: "spec", label: "Material", value: "Recycled polyester", basis: null }, { kind: "spec", label: "Care", value: "Machine wash cold", basis: null },
    ] }]);
    expect(specTable(P("lights"), "en")).toEqual([]);
  });
  it("draws a bike with one group as one table, and a rider height staff wrote first without adding another", () => {
    const one = storeOf([product(BIKE, "b", { category: "bikes", specs: [spec(["Frame", "Steel"]), spec(["Fork", "Steel"])] })], []).products[0];
    expect(specTable(one, "en").map((x) => x.id)).toEqual([null]);
    const own = storeOf([product(BIKE, "b", { category: "bikes", specs: [spec(["Weight", "9 kg"]), spec(["Rider height", "150-170 cm"])], sizes: [{ size: "S", height: { min: 150, max: 170 } }] })],
      [variant(1, BIKE, { size: "S" })]).products[0];
    const rows = specTable(own, "en").flatMap((x) => x.rows);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ kind: "spec", label: "Rider height" });
  });
  it("groups by the row's English name, the first match winning", () => {
    expect(["Wheel size", "Tyres", "Frame size", "Frame material", "Groupset", "Battery", "Rotors", "Colour", "Max load"].map(specGroupOf))
      .toEqual(["wheels", "wheels", "size", "frame", "drive", "power", "brakes", "other", "size"]);
    // an e-bike's top speed is the motor's, a gear range the drivetrain's (a "Range" alone is the battery's)
    expect(["Top speed", "Max speed", "Gear range", "Gear ratios", "Range", "Speeds"].map(specGroupOf))
      .toEqual(["power", "power", "drive", "drive", "power", "drive"]);
  });
  it("splits a basis off a value only when it ends the value in brackets", () => {
    expect(splitBasis("10.4 kg (size M)")).toEqual({ value: "10.4 kg", basis: "size M" });
    expect(splitBasis("  9.8 kg ( without pedals ) ")).toEqual({ value: "9.8 kg", basis: "without pedals" });
    expect(splitBasis("10.4 kg")).toEqual({ value: "10.4 kg", basis: null });
    expect(splitBasis("(M) 10 kg")).toEqual({ value: "(M) 10 kg", basis: null });
  });
  it("gives the rider height the sizes it comes in cover, with open ends, and none when both ends are open", () => {
    expect(riderHeight(P("max"))).toEqual({ min: 160, max: 195 }); // XL is not a size it comes in
    const open = (rows: unknown[]) => riderHeight(storeOf([product(BIKE, "b", { sizes: rows })], []).products[0]);
    expect(open([{ size: "S", height: { min: 150, max: 165 } }, { size: "L", height: { min: 180, max: null } }])).toEqual({ min: 150, max: null });
    expect(open([{ size: "S", height: { min: null, max: 160 } }, { size: "L", height: { min: 180, max: null } }])).toBeNull();
    expect(open([{ size: "S", chest: { min: 80, max: 90 } }])).toBeNull();
  });
  it("writes a height range left to right in both languages", () => {
    expect(strip(cmText({ min: 165, max: 195 }, WORDS))).toBe("165–195 cm");
    expect(cmText({ min: 165, max: 195 }, WORDS)).toBe("⁦165–195⁩ cm");
    expect(strip(cmText({ min: 190, max: null }, WORDS))).toBe("190+ cm");
    expect(strip(cmText({ min: null, max: 160 }, WORDS))).toBe("Up to 160 cm");
    expect(strip(cmText({ min: 170, max: 170 }, { cm: W.ar.cm, upToCm: W.ar.upToCm }))).toBe("170 سم");
  });
});

describe("the add-ons and the starter set (F30, D17-C, F31)", () => {
  it("offer the products staff paired, in their order, in stock, never a gift card or one gone from the store", () => {
    expect(addonsOf(STORE, P("max")).map((p) => p.slug)).toEqual(["helmet", "lights"]);
    expect(addonsOf(STORE, P("helmet"))).toEqual([]);
  });
  it("send a card only its first photo and variants", () => {
    const l = leanProduct(P("max"));
    expect(l.images).toEqual(["/media/store/max/1.webp"]);
    expect(Object.keys(l.image_meta)).toEqual(["/media/store/max/1.webp"]);
    expect([l.specs, l.faq, l.box, l.sizes, l.goes_with, l.compare_with, l.description_en, l.bundle]).toEqual([[], [], [], [], [], [], null, null]);
    expect(l.variants).toHaveLength(3);
  });
  it("add only while the cart has room: 10 of a variant at most (or what is left), 20 lines in all", () => {
    const [m, , w] = P("helmet").variants; // M Black (3 left), L Black (sold out), M White (2 left)
    const lights = P("lights").variants[0]; // 9 left
    const line = (v: { id: string }, qty: number) => ({ variant: v.id.toLowerCase(), qty });
    expect(cartRoom([], [m])).toBe("ok");
    expect(cartRoom([line(m, 2)], [m])).toBe("ok");
    expect(cartRoom([line(m, 3)], [m])).toBe("most"); // all that is left is already in the cart
    expect(cartRoom([], [P("helmet").variants[1]])).toBe("most"); // sold out
    expect(cartRoom([line(lights, 9)], [lights])).toBe("most");
    const many = { ...lights, stock: 50 };
    expect(cartRoom([line(many, 10)], [many])).toBe("most"); // 10 of one line at most
    const nineteen = Array.from({ length: 19 }, (_, i) => ({ variant: U(900 + i), qty: 1 }));
    expect(cartRoom(nineteen, [m])).toBe("ok"); // the 20th line
    expect(cartRoom(nineteen, [m, w])).toBe("full"); // a set of two new lines would make 21
    expect(cartRoom([...nineteen, line(m, 1)], [m, w])).toBe("full");
    expect(cartRoom([...nineteen, line(m, 1)], [m])).toBe("ok"); // one more of a line already there
  });
  it("ask for a size, a colour or both only when a product comes in several variants", () => {
    expect(choiceKind(P("helmet"))).toBe("both");
    expect(choiceKind(P("max"))).toBe("size");
    expect(choiceKind(P("lights"))).toBeNull();
    expect(choicesOf(P("helmet"), "ar")).toEqual([
      { id: U(104), label: "M · أسود", open: true }, { id: U(105), label: "L · أسود", open: false }, { id: U(106), label: "M · أبيض", open: true },
    ]);
  });
});

describe("the comparison (F10, O09-B)", () => {
  it("sets this bike first against the ones staff named, a row per key specification any has, the rider height on top", () => {
    const c = compareTable(STORE, P("max"), "en")!;
    expect(c.products.map((p) => p.slug)).toEqual(["max", "sl", "kid"]); // never a gift card
    expect(c.rider).toEqual([{ min: 160, max: 195 }, { min: 165, max: 180 }, null]);
    expect(c.rows.map((r) => r.key)).toEqual(["weight", "gears", "brakes"]); // "other" says nothing alone
    expect(c.rows[0].values).toEqual(["10.4 kg", "11.2 kg", null]);
    expect(c.rows[2].values).toEqual([null, "Mechanical disc", null]);
  });
  it("falls back to the specification rows two of them share, and is nothing with no bike to compare with", () => {
    const s = storeOf([
      product(BIKE, "a", { category: "bikes", compare_with: [OTHER], specs: [spec(["Frame", "Carbon"], ["الإطار", "كربون"]), spec(["Saddle", "Fizik"])] }),
      product(OTHER, "b", { category: "bikes", specs: [spec(["frame", "Alloy"]), spec(["Pedals", "Flat"])] }),
    ], []);
    const c = compareTable(s, s.products[0], "ar")!;
    expect(c.rows).toEqual([{ key: "spec:frame", label: "الإطار", values: ["كربون", "Alloy"] }]);
    expect(c.rider).toBeNull();
    expect(compareTable(STORE, P("helmet"), "en")).toBeNull();
  });
});

describe("reviews, trade-in and the structured data (F42, F52, F45)", () => {
  it("write the month bought in the page's language and the stars a rating fills", () => {
    expect(monthLabel("2026-11", "en")).toBe("Nov 2026");
    expect(monthLabel("2026-11", "ar")).toMatch(/نوفمبر 2026/);
    expect(monthLabel("2026-13", "en")).toBe("2026-13");
    expect(starsOf(4)).toEqual([true, true, true, true, false]);
    expect(starsOf(4.6).filter(Boolean)).toHaveLength(5);
    expect(avgText(4)).toBe("4.0");
  });
  it("find the store's WhatsApp number in its link, else its phone", () => {
    expect(waNumber({ social: { whatsapp: "https://wa.me/966566668818" } })).toBe("966566668818");
    expect(waNumber({ social: { whatsapp: "https://api.whatsapp.com/send?phone=966500000000" } })).toBe("966500000000");
    expect(waNumber({ social: { whatsapp: "" }, contact: { phone: "+966 56 666 8818" } })).toBe("966566668818");
    expect(waNumber({ social: {}, contact: { phone: "" } })).toBe("");
    expect(waHref("966566668818", "Hello & more")).toBe("https://wa.me/966566668818?text=Hello%20%26%20more");
  });
  it("give search engines the price with VAT in riyals, stock, condition, warranty and the return window", () => {
    const d = ld(P("lights"));
    expect(d["@type"]).toBe("Product");
    expect(d.offers).toMatchObject({
      "@type": "Offer", price: 200, priceCurrency: "SAR", availability: "https://schema.org/InStock", itemCondition: "https://schema.org/NewCondition",
      priceSpecification: { valueAddedTaxIncluded: true, priceCurrency: "SAR", price: 200 },
      hasMerchantReturnPolicy: { applicableCountry: "SA", merchantReturnDays: 7, returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow" },
      warranty: { durationOfWarranty: { value: 24, unitCode: "MON" } },
    });
    expect(d.offers.url).toBe("https://micromobility.sa/store/lights?lang=en");
    expect(d.aggregateRating).toBeUndefined();
    const range = ld(P("helmet"), [], "ar");
    expect(range.name).toBe("خوذة انسيابية");
    expect(range.offers).toMatchObject({ "@type": "AggregateOffer", lowPrice: 520, highPrice: 560, offerCount: 3, priceSpecification: { valueAddedTaxIncluded: true } });
    expect(range.image).toEqual(["https://micromobility.sa/media/store/helmet/1.webp"]);
    expect(ld(P("gone")).offers.availability).toBe("https://schema.org/OutOfStock");
    expect(productLd(P("gift"), { locale: "en", reviews: [] })).toBeNull();
    const used = storeOf([product(BIKE, "u", { category: "bikes", condition: "certified" })], [variant(1, BIKE)]).products[0];
    expect(ld(used).offers).toMatchObject({ itemCondition: "https://schema.org/UsedCondition", warranty: { durationOfWarranty: { value: 12 } } });
  });
  it("give the star average only from five verified buyers' reviews, as the page does", () => {
    const four = [5, 4, 4, 3].map((r, i) => review(i, r));
    expect(ld(P("max"), four).aggregateRating).toBeUndefined();
    const five = [...four, review(9, 5)];
    expect(ld(P("max"), five).aggregateRating).toEqual({ "@type": "AggregateRating", ratingValue: 4.2, reviewCount: 5, bestRating: 5, worstRating: 1 });
  });
});

describe("the sections as the server draws them", () => {
  const both = (f: (locale: string) => string) => ["en", "ar"].map((l) => { const html = f(l); expect(html, l).not.toMatch(NO_EMOJI); return html; });

  it("draw the specification table with its group headings, the rider height first and the weight's basis lighter", () => {
    const [en, ar] = both((l) => render(createElement(SpecTable, { groups: specTable(P("max"), l), locale: l })));
    expect(en).toContain(">Size and weight<");
    expect(en).toContain(">Drivetrain<");
    expect(en.indexOf("Rider height")).toBeLessThan(en.indexOf("Weight"));
    expect(strip(en)).toContain("160–195 cm");
    expect(en).toContain('<bdi>10.4 kg</bdi><span class="st-pd-basis"> (<bdi>size M</bdi>)</span>');
    expect(ar).toContain("طول الراكب");
    expect(ar).toContain("المقاس والوزن");
    const flat = render(createElement(SpecTable, { groups: specTable(P("jersey"), "en"), locale: "en" }));
    expect(flat).not.toContain("st-pd-spec-g");
  });
  it("draw what's in the box with drawn marks, the fit panel's rows and the questions collapsed", () => {
    const [box] = both((l) => render(createElement(InTheBox, { p: P("max"), locale: l })));
    expect(box).toContain("What&#x27;s in the box");
    expect(box.match(/<svg/g)).toHaveLength(2);
    expect(render(createElement(InTheBox, { p: P("lights"), locale: "en" }))).toBe("");
    const [fit, fitAr] = both((l) => render(createElement(FitPanel, { p: P("jersey"), locale: l })));
    expect(fit).toMatch(/<dt>Fit<\/dt><dd><bdi>Regular<\/bdi><\/dd>.*<dt>Size<\/dt><dd><bdi>Your normal size<\/bdi><\/dd>.*<dt>Best for<\/dt><dd><bdi>Hot days<\/bdi><\/dd>/);
    expect(fitAr).toContain("الأيام الحارة");
    expect(fitAr).toContain("<bdi>Your normal size</bdi>"); // no Arabic written: the English, in its own direction
    expect(render(createElement(FitPanel, { p: P("max"), locale: "en" }))).toBe("");
    const [faq] = both((l) => render(createElement(ProductFaq, { p: P("max"), locale: l })));
    expect(faq.match(/<details>/g)).toHaveLength(2);
    expect(faq).not.toContain("<details open");
    expect(faq).toContain('<p dir="auto">And checked again.</p>');
  });
  it("draw the add-ons with their own Add button and a choice where one is needed", () => {
    const [en, ar] = both((l) => render(wrap(l, createElement(CompleteRide, { store: STORE, p: P("max"), locale: l }))));
    expect(en).toContain("Complete your ride");
    expect(en.match(/class="bk-btn2 st-pd-add"/g)).toHaveLength(2);
    expect(en).toContain('aria-label="Add Aero Helmet to your cart"');
    expect(en).toMatch(/<option value=""[^>]*>Size and colour<\/option>/);
    expect(en).toMatch(/<option value="[^"]+" disabled="">L · Black · Sold out<\/option>/);
    expect(en).toContain("href=\"/store/helmet\"");
    expect(ar).toContain("أكمل تجهيز رحلتك");
    expect(ar).toContain("<bdi>خوذة انسيابية</bdi>");
    expect(render(wrap("en", createElement(CompleteRide, { store: STORE, p: P("helmet"), locale: "en" })))).toBe("");
  });
  it("draw the starter set only beside the licence, at its price with the parts struck through and the licence number", () => {
    expect(render(wrap("en", createElement(StarterBundle, { store: STORE, p: P("max"), locale: "en", licence: null })))).toBe("");
    const [en] = both((l) => render(wrap(l, createElement(StarterBundle, { store: STORE, p: P("max"), locale: l, licence: "MC-123" }))));
    expect(en).toContain("Starter set");
    expect(en).toContain("8,800");
    expect(en).toMatch(/<s class="st-was"[^>]*>.*9,155/); // 8,435 + 520 + 200
    expect(en).toContain("Save");
    expect(en).toContain('Discount licence no. <bdi dir="ltr" class="st-pd-lic">MC-123</bdi>'); // kept left to right in Arabic too
    expect(en).toMatch(/<s class="st-was"><span aria-hidden="true">.*<\/span><span class="st-pd-sr">.*9,155.* bought separately<\/span><\/s>/);
    expect(en).toContain("Add the set to your cart");
    const pricey = storeOf([product(BIKE, "b", { bundle: { items: [LIGHTS], price: 400 } }), product(LIGHTS, "l", { price: 200 })], [variant(1, BIKE), variant(2, LIGHTS)]);
    expect(render(wrap("en", createElement(StarterBundle, { store: pricey, p: pricey.products[0], locale: "en", licence: "MC-1" })))).toBe("");
  });
  it("draw the comparison with this bike marked Currently viewing, a View button on the others and a dash where a fact is missing", () => {
    const [en, ar] = both((l) => render(wrap(l, createElement(CompareBikes, { store: STORE, p: P("max"), locale: l }))));
    expect(en).toContain("Compare bikes");
    expect(en.match(/Currently viewing/g)).toHaveLength(1);
    expect(en).toContain('href="/store/sl"');
    expect(en).toContain('href="/store/kid"');
    expect(en).not.toContain('href="/store/max"');
    expect(en).toContain(">—<");
    expect(en).toContain(">Weight<");
    expect(en).toContain(">Rider height<");
    expect(en).toMatch(/<table class="st-pd-cmp n3">/);
    expect(en.match(/class="is-cur"/g)).toHaveLength(1 + 4); // this bike's heading and its four facts
    expect(ar).toContain("تشاهده الآن");
  });
  it("draw the trade-in row on a bike's page only, opening WhatsApp with the bike named", () => {
    const site = { social: { whatsapp: "https://wa.me/966566668818" }, contact: {} };
    const [en, ar] = both((l) => render(createElement(TradeIn, { p: P("max"), locale: l, site })));
    expect(en).toContain("Trade in your old bike");
    expect(en).toContain(`href="https://wa.me/966566668818?text=${encodeURIComponent("Hello, I would like to trade in my old bike towards the DA54 MAX.").replace(/&/g, "&amp;")}"`);
    expect(ar).toContain("استبدل دراجتك القديمة");
    expect(render(createElement(TradeIn, { p: P("helmet"), locale: "en", site }))).toBe("");
    expect(render(createElement(TradeIn, { p: P("max"), locale: "en", site: { social: {}, contact: {} } }))).toBe("");
  });
  it("draw verified buyers' reviews with no name, the average only from five, and nothing before the first", () => {
    expect(render(createElement(ReviewList, { reviews: [], locale: "en" }))).toBe("");
    const few = [review(1, 5, { body: "Great bike" }), review(2, 4, { body: "ممتازة", lang: "ar" })];
    const [en] = both((l) => render(createElement(ReviewList, { reviews: few, locale: l })));
    expect(en).toContain("2 reviews");
    expect(en).toContain("Verified buyer · Bought Nov 2026");
    expect(en).toContain('<p lang="ar" dir="auto">ممتازة</p>');
    expect(en).not.toContain("st-pd-rev-sum\"><span class=\"st-pd-stars\"");
    expect(en).toContain('aria-label="5 out of 5"');
    const many = [5, 4, 4, 5, 3, 5, 4].map((r, i) => review(i, r));
    const html = render(createElement(ReviewList, { reviews: many, locale: "en" }));
    expect(html).toContain("<b>4.3</b>");
    expect(html).toContain('aria-label="4.3 out of 5"');
    expect(html).toContain("Show all 7 reviews");
    expect(render(createElement(ReviewList, { reviews: [review(1, 4)], locale: "ar" }))).toContain("تقييم واحد");
  });
});

describe("the product page", () => {
  it("adds the sections in one block after its About and Specifications, the specification table in their place", () => {
    const src = readFileSync(fileURLToPath(new URL("../../app/[locale]/store/[slug]/page.tsx", import.meta.url)), "utf8");
    const block = src.slice(src.indexOf("{/* w3b sections */}"), src.indexOf("{/* end w3b */}"));
    expect(src.split("{/* w3b sections */}")).toHaveLength(2);
    for (const c of ["FitPanel", "InTheBox", "CompleteRide", "StarterBundle", "CompareBikes", "TradeIn", "ProductReviews", "ProductFaq", "ProductJsonLd"]) expect(block, c).toContain(`<${c} `);
    expect(src.indexOf('id="st-spec-h"')).toBeLessThan(src.indexOf("{/* w3b sections */}"));
    expect(src).toContain("<SpecTable groups={specs} locale={locale} />");
    expect(src).not.toContain('className="st-specs"');
  });
});
