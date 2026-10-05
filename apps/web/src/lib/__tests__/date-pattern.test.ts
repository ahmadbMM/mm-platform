import { describe, expect, it } from "vitest";
import { DATE_STYLES, datePattern, fmtPattern } from "../date-pattern";
import { LOCALE_CODES, intlOf } from "@/i18n/locales";

// A date the browser writes from the server's description (lib/date-pattern.ts) reads exactly as the
// server would have written it, in every language the site speaks, for every way the site writes one.
const OPTIONS: Intl.DateTimeFormatOptions[] = Object.values(DATE_STYLES);
// Every month, every weekday, every hour of the day, and the hours either side of Riyadh's midnight.
const MOMENTS = [
  ...Array.from({ length: 12 }, (_, m) => Date.UTC(2026, m, 1 + m * 2, 9, 7)),
  ...Array.from({ length: 24 }, (_, h) => Date.UTC(2026, 9, 5, h, 30)),
  Date.UTC(2026, 11, 31, 21, 0), Date.UTC(2026, 11, 31, 20, 59),
];

describe("datePattern and fmtPattern", () => {
  for (const code of LOCALE_CODES) {
    it(`${code} reads as the server writes it`, () => {
      for (const o of OPTIONS) {
        const p = datePattern(code, o);
        const real = new Intl.DateTimeFormat(intlOf(code), o);
        for (const t of MOMENTS) expect(fmtPattern(p, new Date(t)), `${code} ${JSON.stringify(o)} ${new Date(t).toISOString()}`).toBe(real.format(new Date(t)));
      }
    });
  }
  it("reads a day as that day, and a timestamp in Riyadh's time", () => {
    const day = datePattern("en", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
    expect(fmtPattern(day, "2026-10-05")).toBe("Monday 5 October");
    const since = datePattern("en", { month: "long", year: "numeric", timeZone: "Asia/Riyadh" });
    expect(fmtPattern(since, "2026-12-31T22:30:00Z")).toBe("January 2027"); // 01:30 in Riyadh
    expect(fmtPattern(since, "not a date")).toBe("");
  });
  it("is plain data, for a server page to hand to a component", () => {
    const p = datePattern("ne", DATE_STYLES.booked);
    expect(JSON.parse(JSON.stringify(p))).toEqual(p);
    expect(fmtPattern(p, Date.UTC(2026, 9, 5, 18, 5))).toBe(new Intl.DateTimeFormat(intlOf("ne"), DATE_STYLES.booked).format(Date.UTC(2026, 9, 5, 18, 5)));
  });
});
