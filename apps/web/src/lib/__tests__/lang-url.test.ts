import { describe, expect, it } from "vitest";
import { askedLang } from "../lang-url";

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
