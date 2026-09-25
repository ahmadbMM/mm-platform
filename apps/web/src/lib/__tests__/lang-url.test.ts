import { describe, expect, it } from "vitest";
import { alternateLinks, askedLang } from "../lang-url";
import { LOCALES } from "../../i18n/locales";

describe("askedLang", () => {
  it("reads ?lang= when it is one of the site's languages", () => {
    expect(askedLang(new URLSearchParams("lang=ar"))).toBe("ar");
    expect(askedLang(new URLSearchParams("tag=x&lang=en"))).toBe("en");
    expect(askedLang(new URLSearchParams("lang=zh"))).toBe("zh");
  });
  it("ignores anything else", () => {
    for (const q of ["", "lang=", "lang=xx", "lang=zh-Hans", "lang=AR", "language=ar"]) expect(askedLang(new URLSearchParams(q)), q).toBeNull();
  });
});

describe("alternateLinks", () => {
  it("names the page in each language, and the plain address as the default", () => {
    // hreflang is the page's own <html lang> (zh-Hans for Chinese); ?lang= is the site's code.
    expect(alternateLinks(new URL("https://micromobility.sa/club"))).toBe([
      ...LOCALES.map((l) => `<https://micromobility.sa/club?lang=${l.code}>; rel="alternate"; hreflang="${l.html}"`),
      '<https://micromobility.sa/club>; rel="alternate"; hreflang="x-default"',
    ].join(", "));
    expect(alternateLinks(new URL("https://micromobility.sa/club"))).toContain('<https://micromobility.sa/club?lang=zh>; rel="alternate"; hreflang="zh-Hans"');
  });
  it("keeps the rest of the address and replaces a lang already in it", () => {
    const v = alternateLinks(new URL("https://micromobility.sa/journal?tag=news&lang=ar#top"));
    expect(v).toContain("<https://micromobility.sa/journal?tag=news&lang=en>");
    expect(v).toContain("<https://micromobility.sa/journal?tag=news&lang=ar>");
    expect(v).toContain('<https://micromobility.sa/journal?tag=news>; rel="alternate"; hreflang="x-default"');
  });
});
