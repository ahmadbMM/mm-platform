import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { activeFilters, brandOnce, cardSizes, isWideCard, photoLoad, withoutFilter } from "../sx-B1-list";
import { noFilters, type Facet } from "../store-listing";

// The store's lists and header on every screen (the user, 2026-11-18: "do all" of the store and Experiences mobile
// report, builder B1). Each rule in plain words.

const F = (x: Partial<ReturnType<typeof noFilters>> = {}) => ({ ...noFilters(), ...x });
const opt = (value: string, x: Partial<Facet["options"][number]> = {}) => ({ value, en: value, ar: null, hex: null, band: null, ...x });
const FACETS: Facet[] = [
  { key: "price", options: [opt("0-500", { band: { id: "0-500", min: null, max: 500 } }), opt("500-2000", { band: { id: "500-2000", min: 500, max: 2000 } })] },
  { key: "size", options: [opt("S"), opt("M"), opt("L")] },
  { key: "colour", options: [opt("Black", { ar: "أسود", hex: "#111111" }), opt("Red", { ar: "أحمر", hex: "#aa2222" })] },
  { key: "brand", options: [opt("Alvas"), opt("Garmin")] },
];
const css = (p: string) => readFileSync(join(__dirname, "../../components", p), "utf8");

describe("a card's size (SM03-B) and its photos (SM12-B)", () => {
  it("gives a bike a wide card, and everything else, a gift card too, one cell", () => {
    expect(isWideCard({ category: "bikes", kind: "item" })).toBe(true);
    expect(isWideCard({ category: "accessories", kind: "item" })).toBe(false);
    expect(isWideCard({ category: "bikes", kind: "gift_card" })).toBe(false);
  });
  it("asks for photos as wide as the card is drawn: a whole phone row for a bike, half for a cell", () => {
    expect(cardSizes(true)).toMatch(/^\(max-width: 699px\) calc\(100vw - 32px\)/);
    expect(cardSizes(false)).toMatch(/^\(max-width: 699px\) 50vw/);
    expect(cardSizes(true)).toMatch(/680px$/);
    expect(cardSizes(false)).toMatch(/330px$/);
  });
  it("loads the list's first photo at once and first, and every other photo lazily", () => {
    expect(photoLoad(true, 0)).toEqual({ loading: "eager", fetchPriority: "high" });
    expect(photoLoad(true, 1)).toEqual({ loading: "lazy" });
    expect(photoLoad(false, 0)).toEqual({ loading: "lazy" });
  });
});

describe("the filters that are on, as pills (SM13-B)", () => {
  it("lists them in the panel's order, whatever order they were ticked in", () => {
    const on = activeFilters(F({ brand: ["Garmin"], size: ["L", "S"], colour: ["Red"], price: ["500-2000"] }), FACETS);
    expect(on.map((a) => `${a.key}:${a.value}`)).toEqual(["price:500-2000", "size:S", "size:L", "colour:Red", "brand:Garmin"]);
    expect(on.find((a) => a.key === "colour")?.option.hex).toBe("#aa2222");
  });
  it("never shows a pill for a choice the list does not offer", () => {
    expect(activeFilters(F({ size: ["XXL"] }), FACETS)).toEqual([]);
    expect(activeFilters(F({ size: ["M"] }), FACETS.filter((f) => f.key !== "size"))).toEqual([]);
    expect(activeFilters(noFilters(), FACETS)).toEqual([]);
  });
  it("takes one pill off and keeps the rest", () => {
    const f = F({ size: ["S", "M"], brand: ["Alvas"] });
    expect(withoutFilter(f, "size", "S")).toEqual(F({ size: ["M"], brand: ["Alvas"] }));
    expect(withoutFilter(f, "brand", "Alvas")).toEqual(F({ size: ["S", "M"] }));
    expect(f.size).toEqual(["S", "M"]); // the old filters are left as they were
  });
});

describe("a product's name on its card says the brand once (P22)", () => {
  it("leaves out a brand the brand line already says, in any case", () => {
    expect(brandOnce("ALVAS TT BGP", "Alvas")).toBe("TT BGP");
    expect(brandOnce("Alvas TOURIST", "Alvas")).toBe("TOURIST");
    expect(brandOnce("Garmin Edge 850", "Garmin")).toBe("Edge 850");
  });
  it("keeps a name that does not start with the brand as a word of its own, is only the brand, or has no brand line", () => {
    expect(brandOnce("DA54 MAX", "Alvas")).toBe("DA54 MAX");
    expect(brandOnce("Alvaston Light", "Alvas")).toBe("Alvaston Light");
    expect(brandOnce("Alvas", "Alvas")).toBe("Alvas");
    expect(brandOnce("Micro Cycling Cap", "Micromobility")).toBe("Micro Cycling Cap");
    expect(brandOnce("Aero Helmet", null)).toBe("Aero Helmet");
    expect(brandOnce("خوذة انسيابية", "Camp")).toBe("خوذة انسيابية");
  });
});

describe("the list's look on every screen", () => {
  const store = css("store/store.css");
  const mine = css("store/sx-B1.css");
  it("draws the order menu at 16px, so iOS does not zoom into it (P11)", () => {
    expect(store).toMatch(/\.st-sort select \{[^}]*font-size: 16px/);
    expect(store).not.toMatch(/\.st-sort select \{[^}]*font-size: 14\.5px/);
  });
  it("puts Filters and Sort on one row of two equal buttons at every width (SM13-B, P18)", () => {
    expect(store).toMatch(/\.st-tools \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    expect(store).toMatch(/\.st-filter-btn \{[^}]*width: 100%/);
  });
  it("gives a bike two of the phone's two columns, three of the tablet's six and two of the computer's four (SM03-B)", () => {
    expect(store).toMatch(/\.st-grid \{ --st-cols: 2; --st-cell: 1; --st-wide: 2;/);
    expect(store).toMatch(/\.st-grid \{ --st-cols: 6; --st-cell: 2; --st-wide: 3;/);
    expect(store).toMatch(/\.st-grid \{ --st-cols: 4; --st-cell: 1; --st-wide: 2;/);
    expect(mine).toContain(".st-card.is-wide { grid-column: span var(--st-wide, 2); }");
  });
  it("keeps the filter panel at 200-220px beside the list (SM08-B)", () => {
    expect(store).toMatch(/\.st-list\.has-side \{[^}]*grid-template-columns: 212px/);
  });
  it("lays sizes out three to a row in the filters (SM13-B)", () => {
    expect(store).toMatch(/\.st-facet\.is-size \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  });
  it("gives the photo arrows, the quick add and the steppers a 44px target (P12)", () => {
    expect(store).toMatch(/\.st-strip-arrow \{[^}]*width: 44px; height: 44px/);
    expect(store).toMatch(/\.st-quick \{[^}]*min-width: 44px; height: 44px/);
    expect(store).toContain(".st-qty.sm button { width: 44px; height: 44px; }");
    expect(store).toContain(".st-buybox .st-qty button { width: 44px; height: 44px; }");
    expect(store).toMatch(/\.st-crumbs a \{[^}]*min-height: 44px/);
  });
  it("writes no store text under 12px but the size buttons' height line, which the product page's size row redraws (P13)", () => {
    const small = [...(store + mine).matchAll(/([^{}]+)\{[^}]*font-size: (\d+(?:\.\d+)?)px/g)].filter((m) => Number(m[2]) < 12).map((m) => m[1].trim());
    expect(small).toEqual([".st-sizes button small"]);
  });
  it("draws no hover look outside a hover screen in its own rules", () => {
    expect(mine.replace(/@media \(hover: hover\) \{[^}]*\}[^}]*\}/g, "")).not.toMatch(/:hover/);
  });
});
