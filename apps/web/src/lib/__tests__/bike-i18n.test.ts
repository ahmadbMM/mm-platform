import { describe, expect, it } from "vitest";
import { BIKE_LANGS, dirOf, fmtDate, fromAcceptLanguage, speedsLabel, tFor } from "../bike-i18n";
import { LOCALE_CODES } from "../../i18n/locales";

// The NFC bike pages speak every language the site does, and pick one from the phone when the
// visitor has not chosen.
describe("the bike pages' languages", () => {
  it("are the site's", () => {
    expect([...BIKE_LANGS]).toEqual([...LOCALE_CODES]);
    expect(dirOf("ur")).toBe("rtl");
    expect(dirOf("ar")).toBe("rtl");
    expect(dirOf("zh")).toBe("ltr");
  });
  it("follow the phone's languages in order, knowing Filipino and Indonesian's old code", () => {
    expect(fromAcceptLanguage("sv-SE,de-DE;q=0.8,en;q=0.5")).toBe("de");
    expect(fromAcceptLanguage("zh-CN,zh;q=0.9")).toBe("zh");
    expect(fromAcceptLanguage("fil-PH,en;q=0.5")).toBe("tl");
    expect(fromAcceptLanguage("in-ID")).toBe("id");
    expect(fromAcceptLanguage("sv, nb")).toBeNull();
    expect(fromAcceptLanguage(null)).toBeNull();
  });
  it("write Arabic as written, and never show a key", () => {
    expect(tFor("ar")("fBrand")).toBe("الماركة");
    expect(tFor("en")("fBrand")).toBe("Brand");
    expect(tFor("de")("noSuchKey")).toBe("noSuchKey");
    expect(tFor("de")("fBrand")).not.toBe("fBrand");
  });
  it("count speeds in each language's own way", () => {
    expect(speedsLabel(1, "en")).toBe("1 speed");
    expect(speedsLabel(21, "en")).toBe("21 speeds");
    expect(speedsLabel(21, "ru")).toBe("21 скорость");
    expect(speedsLabel(24, "ru")).toBe("24 скорости");
    expect(speedsLabel(27, "ru")).toBe("27 скоростей");
    expect(speedsLabel(21, "zh")).toBe("21速");
    expect(speedsLabel(21, "ja")).toBe("21段");
    expect(speedsLabel(1, "de")).toBe("1 Gang");
    expect(speedsLabel(2, "ar")).toBe("2 سرعتان");
  });
  it("date in Latin digits and the Gregorian calendar, in every language", () => {
    for (const l of BIKE_LANGS) expect(fmtDate("2026-03-01T10:00:00Z", l), l).toMatch(/2026/);
  });
});
