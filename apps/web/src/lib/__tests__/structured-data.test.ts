import { describe, expect, it } from "vitest";
import { breadcrumbData, productData } from "../structured-data";
import type { CatalogModel } from "../catalog";

// The breadcrumb trail search engines show under a catalogue page's result (lib/structured-data.ts).
describe("breadcrumbData", () => {
  it("lists the way to the page in order, each step at its address in the page's language", () => {
    expect(breadcrumbData([{ name: "Bikes", path: "/bikes" }, { name: "Road", path: "/bikes/road" }, { name: "Alvas DA54", path: "/bikes/road/carbon/da54" }], "ar")).toEqual({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Bikes", item: "https://micromobility.sa/bikes?lang=ar" },
        { "@type": "ListItem", position: 2, name: "Road", item: "https://micromobility.sa/bikes/road?lang=ar" },
        { "@type": "ListItem", position: 3, name: "Alvas DA54", item: "https://micromobility.sa/bikes/road/carbon/da54?lang=ar" },
      ],
    });
  });
});

// A catalogue model (lib/structured-data.ts productData): a Product only with what a ride costs.
describe("productData", () => {
  const model = { brand: "ALVAS", name: "DA54", ride_type: "Road" } as CatalogModel;
  const x = { path: "/bikes/road/alvas-da54", image: "/site/x.jpg", category: "Road", description: "A road bike.", bookUrl: "https://micromobilityrentals.pages.dev/?lang=en" };
  it("offers a ride on it at its price in riyals, as a rental", () => {
    expect(productData(model, "en", { ...x, price: 75 })).toMatchObject({
      "@type": "Product", name: "ALVAS DA54",
      offers: { "@type": "Offer", price: 75, priceCurrency: "SAR", businessFunction: "http://purl.org/goodrelations/v1#LeaseOut", url: x.bookUrl },
    });
  });
  it("is left out for a model with no ride price, which search engines would refuse", () => {
    expect(productData(model, "en", { ...x, price: null })).toBeNull();
  });
});
