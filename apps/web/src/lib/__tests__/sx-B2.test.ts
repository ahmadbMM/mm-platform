import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { paySettings } from "../pay/settings";
import { storeOf } from "../store-core";
import {
  checkupWeeks, fleetRecordOf, GALLERY_SIZES, MEDIA_WIDTHS, orderByDays, orderByOf, pdpSrcSet, presetOf, previewText, rodeOf, shareHref,
  sharedSlugs, sizeGrid, thumbSrc,
} from "../sx-B2";

// The product page's rules from the "do all" build of 2026-11-18 (builder B2).
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const variant = (n: number, x: Record<string, unknown> = {}) => ({ id: U(100 + n), product_id: U(1), size: null, color_en: null, color_ar: null, color_hex: null, price: null, stock: 5, sort: n, ...x });
const bike = storeOf(
  [{ id: U(1), slug: "max", category: "bikes", name_en: "DA54 MAX", price: 8435, images: [], published: true, sort: 0, created_at: "2026-11-01T00:00:00Z" }],
  ["XS", "S", "M", "L", "XL", "XXL"].flatMap((s, i) => [
    variant(i * 2, { size: s, color_en: "Black", color_ar: "أسود" }),
    variant(i * 2 + 1, { size: s, color_en: "Pearl White", color_ar: "أبيض لؤلؤي" }),
  ]),
).products[0];
const src = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

describe("SM06-B: the sizes stand in even rows", () => {
  it("puts six sizes 3 + 3 in a narrow column and six across where there is room", () => {
    expect(sizeGrid(6, false)).toEqual({ narrow: 3, wide: 6 });
    expect(sizeGrid(6, true)).toEqual({ narrow: 3, wide: 6 });
  });
  it("never leaves one size alone on a row for the usual counts", () => {
    for (const n of [2, 3, 4, 6, 8, 9]) {
      for (const two of [false, true]) {
        const g = sizeGrid(n, two);
        for (const cols of [g.narrow, g.wide]) expect(n % cols === 0 || n % cols > 1, `${n} sizes in ${cols}`).toBe(true);
      }
    }
  });
  it("splits four two-line sizes 2 + 2 on a phone, four plain ones stay in one row", () => {
    expect(sizeGrid(4, true).narrow).toBe(2);
    expect(sizeGrid(4, false).narrow).toBe(4);
  });
  it("is read by store.css through a container query on the size column", () => {
    const css = src("../../components/store/store.css");
    expect(css).toContain(".st-sizes { display: grid; grid-template-columns: repeat(var(--sz-n, 3), minmax(0, 1fr));");
    expect(css).toContain("@container st-sz (min-width: 400px)");
    expect(src("../../components/store/sx-B2.css")).toContain(".st-b2-szbox { container: st-sz / inline-size; }");
    // a sold-out size is struck with a drawn line, never a text strike through its two lines
    expect(css).not.toMatch(/\.st-sizes button\.st-out \{[^}]*line-through/);
    expect(css).toContain(".st-sizes button.st-out::after");
  });
});

describe("P09: photos at the size they are drawn", () => {
  it("offers a staff photo up to 1,600 px wide and its thumbnail from the smallest copy", () => {
    expect(pdpSrcSet("/media/store/abc.jpg")).toBe("/media/store/abc.jpg?w=640 640w, /media/store/abc.jpg?w=1280 1280w, /media/store/abc.jpg?w=1600 1600w");
    expect(thumbSrc("/media/store/abc.jpg")).toBe("/media/store/abc.jpg?w=320");
    expect(MEDIA_WIDTHS).toContain(1600);
  });
  it("uses a site photo's own copies, the whole one included", () => {
    expect(pdpSrcSet("/site/store/max/2.webp")).toBe("/site/store/max/2.w640.webp 640w, /site/store/max/2.w1280.webp 1280w, /site/store/max/2.webp 1600w");
    expect(thumbSrc("/site/store/max/2.webp")).toBe("/site/store/max/2.w640.webp");
    expect(pdpSrcSet("https://example.com/a.jpg")).toBeUndefined();
  });
  it("tells the browser the width of each layout's photo column", () => {
    expect(GALLERY_SIZES).toMatch(/^\(min-width: 1200px\) .+, \(min-width: 768px\) .+, calc\(100vw - 64px\)$/);
    expect(src("../../components/store/ProductGallery.tsx")).toContain("sizes={GALLERY_SIZES}");
  });
  it("lets the media route answer 320 and 1600 with the nearest copy until the staff page saves them", () => {
    const route = src("../../app/media/[...path]/route.ts");
    expect(route).toContain('const WIDTHS = new Set(["320", "640", "1280", "1600"]);');
    expect(route).toContain('const NEAREST: Record<string, string> = { "320": "640", "1600": "1280" };');
  });
});

describe("N09, N01: a link that opens the product with its size and colour", () => {
  it("picks the size and colour the address asks for, only when the product comes in them", () => {
    expect(presetOf(bike, { size: "m", colour: "pearl-white" })).toEqual({ size: "M", colour: "Pearl White" });
    expect(presetOf(bike, { size: "XXL", color: "Black" })).toEqual({ size: "XXL", colour: "Black" });
    expect(presetOf(bike, { colour: "أبيض لؤلؤي" })).toEqual({ size: null, colour: "Pearl White" });
    expect(presetOf(bike, { size: "XXXL", colour: "Green" })).toEqual({ size: null, colour: null });
    expect(presetOf(bike, { size: ["L", "M"] })).toEqual({ size: "L", colour: null });
    expect(presetOf(bike, {})).toEqual({ size: null, colour: null });
  });
  it("shares the page's address with the size and colour picked and no language", () => {
    expect(shareHref("https://micromobility.sa/", "max", { size: "M", colour: "Pearl White" })).toBe("https://micromobility.sa/store/max?size=M&colour=Pearl+White");
    expect(shareHref("https://micromobility.sa", "max", {})).toBe("https://micromobility.sa/store/max");
    const back = new URL(shareHref("https://micromobility.sa", "max", { size: "M", colour: "Pearl White" })).searchParams;
    expect(presetOf(bike, Object.fromEntries(back))).toEqual({ size: "M", colour: "Pearl White" });
  });
  it("reads a shared saved list's slugs, store slugs only, no repeats, at most the list's size", () => {
    expect(sharedSlugs("max,helmet,max", 50)).toEqual(["max", "helmet"]);
    expect(sharedSlugs("max,<script>,../x", 50)).toEqual(["max"]);
    expect(sharedSlugs("a,b", 50)).toBeNull();
    expect(sharedSlugs(undefined, 50)).toBeNull();
    expect(sharedSlugs("aa,bb,cc", 2)).toEqual(["aa", "bb"]);
  });
  it("writes the preview's price with VAT in letters a phone can draw", () => {
    expect(previewText("en", 8435, false, "Carbon road bike")).toBe("SAR 8,435 incl. VAT · Carbon road bike");
    expect(previewText("en", 99, true, "")).toBe("From SAR 99 incl. VAT");
    expect(previewText("ar", 8435, false, "")).toBe("8,435 ر.س شامل الضريبة");
  });
});

describe("N12: the free first check-up", () => {
  it("is 12 weeks unless staff change it, and gone when they switch it off", () => {
    expect(checkupWeeks({})).toBe(12);
    expect(checkupWeeks({ "store.checkup": { weeks: 8 } })).toBe(8);
    expect(checkupWeeks({ "store.checkup": { on: false, weeks: 8 } })).toBeNull();
    expect(checkupWeeks({ "store.checkup": { weeks: 0 } })).toBeNull();
    expect(checkupWeeks({ "store.checkup": { weeks: 500 } })).toBe(12);
  });
});

describe("N36: order by a date for an occasion, only when it is true", () => {
  const content = {
    "store.delivery": { pickup: { on: true, days: "1" }, jeddah: { on: true, fee: 30, days: "1-2" }, ksa: { on: true, fee: 45, days: "3-5" } },
    "store.orderBy": { en: "Eid", ar: "العيد", day: "2027-03-20", by: { pickup: "2027-03-18", jeddah: "2027-03-17", ksa: "2027-03-12" } },
  };
  const o = orderByOf(content);
  const s = paySettings(content);
  it("reads staff's occasion, and nothing from a half-filled one", () => {
    expect(o).toEqual({ en: "Eid", ar: "العيد", day: "2027-03-20", by: { pickup: "2027-03-18", jeddah: "2027-03-17", ksa: "2027-03-12" } });
    expect(orderByOf({ "store.orderBy": { en: "Eid", day: "2027-03-20" } })).toBeNull();
    expect(orderByOf({ "store.orderBy": { en: "Eid", day: "20-03-2027", by: { jeddah: "2027-03-17" } } })).toBeNull();
    expect(orderByOf({})).toBeNull();
  });
  it("names each way while today is on or before its last day and an order today arrives in time", () => {
    expect(orderByDays(o, s, "2027-03-10")).toEqual({ pickup: "2027-03-18", jeddah: "2027-03-17", ksa: "2027-03-12" });
    // after the KSA day, Jeddah and pickup still say it
    expect(orderByDays(o, s, "2027-03-15")).toEqual({ pickup: "2027-03-18", jeddah: "2027-03-17" });
    // on the day itself the line stays; the day after it goes
    expect(orderByDays(o, s, "2027-03-17")).toEqual({ pickup: "2027-03-18", jeddah: "2027-03-17" });
    expect(orderByDays(o, s, "2027-03-21")).toEqual({});
  });
  it("says nothing for a way whose dates would miss the occasion, whatever staff wrote", () => {
    const late = orderByOf({ "store.orderBy": { en: "Eid", day: "2027-03-20", by: { ksa: "2027-03-19" } } });
    expect(orderByDays(late, s, "2027-03-18")).toEqual({});
    expect(orderByDays(o, paySettings({ "store.delivery": { jeddah: { on: true, fee: 30 } } }), "2027-03-10")).toEqual({});
  });
});

describe("N16, N25: facts from the database, only when they are real", () => {
  it("reads an ex-rental bike's record and ignores anything out of shape", () => {
    expect(fleetRecordOf({ rides: 214, months: 18 })).toEqual({ rides: 214, months: 18 });
    expect(fleetRecordOf({ rides: 0, months: 0 })).toBeNull();
    expect(fleetRecordOf({ rides: -1, months: 3 })).toBeNull();
    expect(fleetRecordOf(null)).toBeNull();
    expect(fleetRecordOf("x")).toBeNull();
  });
  it("reads the rider's own count, nothing for none", () => {
    expect(rodeOf({ rides: 4 })).toBe(4);
    expect(rodeOf({ rides: 0 })).toBeNull();
    expect(rodeOf(null)).toBeNull();
    expect(rodeOf(3)).toBe(3);
  });
});

describe("the product page's layout", () => {
  const css = src("../../components/store/store.css");
  it("moves the way to have it above Add (P21) and keeps one price on the page (SM08-B)", () => {
    const box = src("../../components/store/BuyBox.tsx");
    expect(box.indexOf("{ways}")).toBeGreaterThan(-1);
    expect(box.indexOf("{ways}")).toBeLessThan(box.indexOf("st-add"));
    expect(box).not.toContain("st-buybox-price");
    expect(css).not.toContain(".st-buybox-price");
  });
  it("goes two columns from 768px (SM07-B) and three from 1200px (SM08-B)", () => {
    expect(css).toContain('@media (min-width: 768px) {\n  .st-top { grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);');
    expect(css).toContain('@media (min-width: 1200px) {\n  .st-top { grid-template-columns: minmax(0, 1fr) minmax(250px, .46fr) 320px;');
  });
  it("lets Add take its own row on a narrow phone (P06)", () => {
    expect(css).toContain(".st-buybox .st-cta { flex-wrap: wrap; }");
  });
  it("pulses the header's cart count only when it changes on the page, never under reduced motion (SM09-B)", () => {
    const site = src("../../components/site/site.css");
    expect(site).toContain(".mm-cart-n.is-new { animation: mmCartPulse");
    expect(site).toContain("@media (prefers-reduced-motion: reduce) { .mm-cart-n.is-new { animation: none; } }");
    expect(src("../../components/site/SiteNav.tsx")).toContain('className={`mm-cart-n${said ? " is-new" : ""}`}');
  });
});
