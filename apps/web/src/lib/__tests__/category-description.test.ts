import { describe, expect, it } from "vitest";
import { categoryDescription } from "@/components/bikes/CategoryPage";
import { serverL } from "@/i18n/dicts";
import type { CatalogCategory } from "../catalog";

// What search engines read for a catalogue category (components/bikes/CategoryPage.tsx): its own
// blurb, else a line naming it - never the Bikes page's text, which all five would then share.
describe("categoryDescription", () => {
  const cat = (o: Partial<CatalogCategory>) => ({ name_en: "Road", name_ar: "طريق", blurb_en: "", blurb_ar: "", ...o }) as CatalogCategory;
  it("is the category's blurb when staff wrote one", () => {
    expect(categoryDescription(cat({ blurb_en: "Fast on tarmac." }), "en", serverL("en"))).toBe("Fast on tarmac.");
  });
  it("otherwise names the category, so each page has its own", () => {
    expect(categoryDescription(cat({}), "en", serverL("en"))).toBe("Road bikes in the Micromobility catalogue: models, photos and specifications.");
    expect(categoryDescription(cat({ name_en: "Kids", name_ar: "أطفال" }), "ar", serverL("ar"))).toBe("دراجات أطفال في كتالوج مايكروموبيليتي: الموديلات والصور والمواصفات.");
    expect(categoryDescription(cat({}), "ru", serverL("ru"))).toContain("«Road»");
  });
});
