import { describe, expect, it } from "vitest";
import { alternateLinks, askedLang } from "../lang-url";

describe("askedLang", () => {
  it("reads ?lang= when it is one of the site's languages", () => {
    expect(askedLang(new URLSearchParams("lang=ar"))).toBe("ar");
    expect(askedLang(new URLSearchParams("tag=x&lang=en"))).toBe("en");
  });
  it("ignores anything else", () => {
    for (const q of ["", "lang=", "lang=fr", "lang=AR", "language=ar"]) expect(askedLang(new URLSearchParams(q)), q).toBeNull();
  });
});

describe("alternateLinks", () => {
  it("names the page in each language, and the plain address as the default", () => {
    expect(alternateLinks(new URL("https://micromobility.sa/club"))).toBe(
      '<https://micromobility.sa/club?lang=en>; rel="alternate"; hreflang="en", ' +
        '<https://micromobility.sa/club?lang=ar>; rel="alternate"; hreflang="ar", ' +
        '<https://micromobility.sa/club>; rel="alternate"; hreflang="x-default"',
    );
  });
  it("keeps the rest of the address and replaces a lang already in it", () => {
    const v = alternateLinks(new URL("https://micromobility.sa/journal?tag=news&lang=ar#top"));
    expect(v).toContain("<https://micromobility.sa/journal?tag=news&lang=en>");
    expect(v).toContain("<https://micromobility.sa/journal?tag=news&lang=ar>");
    expect(v).toContain('<https://micromobility.sa/journal?tag=news>; rel="alternate"; hreflang="x-default"');
  });
});
