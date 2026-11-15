import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ADDED_MS, buyNowHref } from "../cart";
import { linePhoto, linePhotos, relatedOf, storeOf, type Store } from "../store-core";
import { buyLinesOf, tabbyQuarter } from "../store-checkout";
import { buyNowLines, buyNowWithHref, extrasOf, tabbyPart, waDigits } from "../store-pdp";
import { addonsOf, leanProduct, waNumber } from "../store-sections";
import { T as W2 } from "../../components/store/w2.text";
import { T as W3A } from "../../components/store/w3a.text";
import { T as W3B } from "../../components/store/w3b.text";
import { T as W4 } from "../../components/store/w4.text";

// Where the store build's chains met one feature from two sides (2026-11-15, the integration of w1-w5): one rule each
// for the buy-now address, Tabby's quarter, the WhatsApp number, what goes with a bike, the photo a line shows for its
// colour, the "Added" moment and its words, and class names no two chains' blocks of store.css define.
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const variant = (n: number, pid: string, x: Record<string, unknown> = {}) => ({ id: U(100 + n), product_id: pid, size: null, color_en: null, color_ar: null, color_hex: null, price: null, stock: 5, sort: n, ...x });
const product = (id: string, slug: string, x: Record<string, unknown> = {}) => ({
  id, slug, category: "accessories", brand: null, name_en: slug.toUpperCase(), name_ar: null, tagline_en: null, tagline_ar: null, description_en: null, description_ar: null,
  specs: [], images: [], price: 100, compare_at: null, ship_ksa: true, sort: 0, created_at: "2026-11-01T00:00:00Z", ...x,
});
const BIKE = U(1), HELMET = U(2), LIGHTS = U(3), CARD = U(4), GONE = U(5);
const img = (n: string) => `/media/store/helmet/${n}.webp`;
const STORE: Store = storeOf(
  [
    product(BIKE, "max", { category: "bikes", price: 8435, images: ["/media/store/max/1.webp"], goes_with: [HELMET, CARD, GONE, LIGHTS] }),
    product(HELMET, "helmet", {
      price: 520, images: [img("side"), img("white-1"), img("black-1"), img("white-2"), img("detail")],
      image_meta: {
        [img("side")]: { alt_en: "The helmet from the side", colour: null }, [img("white-1")]: { alt_en: "White, front", colour: "White" },
        [img("black-1")]: { alt_en: "Black, front", colour: "Black" }, [img("white-2")]: { alt_en: "White, back", colour: "White" },
      },
    }),
    product(LIGHTS, "lights", { price: 200, images: ["/media/store/lights/1.webp"] }),
    product(CARD, "gift", { category: "gift", kind: "gift_card", price: 100 }),
    product(GONE, "gone", { price: 90 }),
  ],
  [
    variant(1, BIKE, { size: "M" }),
    variant(2, HELMET, { size: "M", color_en: "Black", color_ar: "أسود" }), variant(3, HELMET, { size: "M", color_en: "White", color_ar: "أبيض" }),
    variant(4, HELMET, { size: "M", color_en: "Red", color_ar: "أحمر" }),
    variant(5, LIGHTS), variant(6, CARD, { stock: 999 }), variant(7, GONE, { stock: 0 }),
  ],
);
const P = (slug: string) => STORE.products.find((p) => p.slug === slug)!;

describe("the photo a line shows for its colour", () => {
  const helmet = P("helmet");
  const [black, white, red] = helmet.variants;
  it("is the first photo of the line's colour, as the database snapshots it on the order (X08), else the first photo", () => {
    expect(linePhoto(helmet, black)).toBe(img("black-1"));
    expect(linePhoto(helmet, white)).toBe(img("white-1"));
    expect(linePhoto(helmet, red)).toBe(img("side")); // no photo of red
    expect(linePhoto(helmet, null)).toBe(img("side"));
    expect(linePhoto(P("gone"), null)).toBeNull();
  });
  it("is kept on an add-on card's product, so its photo follows the colour picked; the rest are left out", () => {
    expect(linePhotos(helmet)).toEqual([img("side"), img("white-1"), img("black-1")]);
    const lean = leanProduct(helmet);
    expect(lean.images).toEqual([img("side"), img("white-1"), img("black-1")]);
    expect(Object.keys(lean.image_meta)).toEqual([img("side"), img("white-1"), img("black-1")]);
    expect(linePhoto(lean, black)).toBe(img("black-1"));
  });
});

describe("one rule where two chains wrote one", () => {
  it("what goes with a bike: the buy box's Extras and the Complete your ride section list the same products", () => {
    const bike = P("max");
    expect(addonsOf(STORE, bike).map((p) => p.slug)).toEqual(["helmet", "lights"]); // no gift card, nothing sold out
    expect(addonsOf(STORE, bike)).toEqual(extrasOf(relatedOf(STORE, bike.goes_with, bike.id)));
  });
  it("the buy-now address checkout reads is the one the buy box writes, extras included", () => {
    const href = buyNowWithHref(U(101), 2, [U(103), U(105), U(101)]);
    const q = new URLSearchParams(href.split("?")[1]);
    expect(buyLinesOf(q)).toEqual([{ variant: U(101), qty: 2 }, { variant: U(103), qty: 1 }, { variant: U(105), qty: 1 }]);
    expect(buyLinesOf(q)).toEqual(buyNowLines(q));
    expect(buyLinesOf(new URLSearchParams(buyNowHref(U(101), 1).split("?")[1]))).toEqual([{ variant: U(101), qty: 1 }]);
  });
  it("Tabby's quarter on the pay page is the product page's, in whole halalas", () => {
    for (const n of [4.4, 1104.4, 8435, 100.01, 1001, 0.28]) expect(tabbyQuarter(n)).toBe(tabbyPart(n));
    expect(tabbyQuarter(4.4)).toBe(1.1);
  });
  it("the WhatsApp number of Trade in is the one Ask about this bike opens", () => {
    const cases: [string, string][] = [
      ["https://wa.me/966566668818", "+966 12 000 0000"], ["https://wa.me/+966566668818", ""],
      ["https://api.whatsapp.com/send?phone=966500000000", ""], ["https://api.whatsapp.com/send/?phone=966500000000&text=hi", ""],
      ["", "+966 56 666 8818"], ["https://instagram.com/x", ""],
    ];
    for (const [link, phone] of cases) expect(waNumber({ social: { whatsapp: link }, contact: { phone } })).toBe(waDigits(link, phone));
    expect(waDigits("https://wa.me/+966566668818", "")).toBe("966566668818");
  });
});

describe("the Added moment (D14-E)", () => {
  const src = (p: string) => readFileSync(fileURLToPath(new URL(`../../components/store/${p}`, import.meta.url)), "utf8");
  it("lasts as long on a card's quick add, the buy box, the add-ons and the starter set", () => {
    expect(ADDED_MS).toBe(2500);
    for (const f of ["CardParts.tsx", "ProductTop.tsx", "pdp/useFlash.ts"]) {
      expect(src(f), f).toContain("ADDED_MS");
      expect(src(f), f).not.toMatch(/setTimeout\(.*,\s*\d{3,}\s*\)/);
    }
  });
  it("says the same word on every add button, in English and in Arabic", () => {
    const en = [W2.en.added, W3A.en.addedBtn, W3B.en.addedOne, W4.en.added];
    const ar = [W2.ar.added, W3A.ar.addedBtn, W3B.ar.addedOne, W4.ar.added];
    expect(new Set(en).size, en.join(" | ")).toBe(1);
    expect(new Set(ar).size, ar.join(" | ")).toBe(1);
  });
  it("one English text means one thing: a saving is not the heart's Save", () => {
    expect(W2.en.save("DA54")).toBe("Save DA54");
    expect(W3B.en.save("100")).not.toBe(W2.en.save("100"));
  });
});

describe("the product page promises only what the next page offers", () => {
  const top = readFileSync(fileURLToPath(new URL("../../components/store/pdp-top.ts", import.meta.url)), "utf8");
  it("Tabby's line wants the switch and Tabby's keys, as the pay page's tile; Apple Pay wants payments on, as the cart's", () => {
    expect(top).toMatch(/tabby: storeSwitches\(s\.content\)\.tabby && tabbyKeys\(storeEnv\(\)\)/);
    expect(top).toMatch(/applePay: s\.settings\.enabled && payReady\(\) && !!payEnv\(\)\.APPLE_PAY_DOMAIN_FILE/);
  });
  it("the returns pop-up reads the Returns page's answers (lib/policies.ts returnsAnswers)", () => {
    expect(top).toContain("returnsAnswers(help.topics.returns)");
  });
});

describe("store.css", () => {
  const css = readFileSync(fileURLToPath(new URL("../../components/store/store.css", import.meta.url)), "utf8");
  it("gives each chain's classes to that chain alone, so no page takes another's rules", () => {
    const marks = [...css.matchAll(/\/\* ── (?:Store build )?(w\d\w?)\b/g)];
    expect(marks.map((m) => m[1])).toEqual(["w2", "w3a", "w3b", "w4", "w5"]);
    const classes = marks.map((m, i) => {
      const block = css.slice(m.index, marks[i + 1]?.index ?? css.length).replace(/\/\*[\s\S]*?\*\//g, "");
      const set = new Set<string>();
      for (const sel of block.matchAll(/([^{}]+)\{/g)) for (const c of sel[1].matchAll(/\.(st-[\w-]+)/g)) set.add(c[1]);
      return { chain: m[1], set };
    });
    const shared = new Set(["st-ic", "st-sr"]); // the store's icon class and the visually hidden text, the same rule each time
    const clashes: string[] = [];
    classes.forEach((a, i) => classes.slice(i + 1).forEach((b) => {
      for (const c of a.set) if (b.set.has(c) && !shared.has(c)) clashes.push(`${c}: ${a.chain} and ${b.chain}`);
    }));
    expect(clashes).toEqual([]);
  });
});
