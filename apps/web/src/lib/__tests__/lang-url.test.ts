import { describe, expect, it } from "vitest";
import { askedLang, visitorLang } from "../lang-url";

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

describe("visitorLang (the 404 for an address with no language)", () => {
  it("takes the visitor's pick, then their browser's first language the site speaks, then English", () => {
    expect(visitorLang("ar", "de-DE,de;q=0.9")).toBe("ar");
    expect(visitorLang(undefined, "fr-CH, fr;q=0.9, en;q=0.8")).toBe("fr");
    expect(visitorLang("xx", "sv-SE,ur;q=0.8")).toBe("ur"); // an unknown pick and an unspoken language are passed over
    expect(visitorLang(null, "fil-PH")).toBe("tl");
    expect(visitorLang(null, "in-ID")).toBe("id");
    expect(visitorLang(null, null)).toBe("en");
  });
});
