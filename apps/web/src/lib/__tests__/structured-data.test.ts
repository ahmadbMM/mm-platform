import { describe, expect, it } from "vitest";
import { breadcrumbData } from "../structured-data";

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
