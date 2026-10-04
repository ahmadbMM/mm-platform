import { describe, expect, it } from "vitest";
import { addDays, addMonths, arrowStep, defaultUntil, hijriDay, hijriLabel, isIso, localeTag, longDate, monthGrid, patternArgs, patternDays, patternValid, weekday } from "../src/client/dates";
import { dayStatus, lateCancel, pickable, reasonText, staffNoteText, verdictText, type CalDay, type Tier } from "../src/client/model";
import { STRINGS } from "../src/client/strings";

const tier: Tier = { id: "multi", name_en: "Multi", name_ar: "عدة أيام", modes: ["single", "multi"], max_per_month: 2, horizon_days: 120, min_lead_days: 7, cancel_cutoff_days: 5, benefits: [] };

describe("month grid", () => {
  it("starts weeks on Sunday and pads with empty cells", () => {
    const g = monthGrid("2026-10-15"); // 1 Oct 2026 is a Thursday
    expect(g[0]).toEqual([null, null, null, null, "2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(g.every((w) => w.length === 7)).toBe(true);
    expect(g.flat().filter(Boolean)).toHaveLength(31);
    expect(g[g.length - 1]).toEqual(["2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31"]);
    for (const w of g) for (const [i, d] of w.entries()) if (d) expect(weekday(d)).toBe(i);
  });

  it("handles February and six-week months", () => {
    expect(monthGrid("2026-02-01").flat().filter(Boolean)).toHaveLength(28);
    expect(monthGrid("2026-02-01")).toHaveLength(4); // 1 Feb 2026 is a Sunday
    expect(monthGrid("2026-08-01")).toHaveLength(6); // starts Saturday, 31 days
    expect(monthGrid("2028-02-10").flat().filter(Boolean)).toHaveLength(29);
  });

  it("adds days and months across year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addMonths("2026-12-20", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-31", -1)).toBe("2025-12-01");
    expect(isIso("2026-02-30")).toBe(false);
    expect(isIso("2026-02-28")).toBe(true);
  });
});

describe("Hijri labels", () => {
  it("use the Umm al-Qura calendar with Western digits", () => {
    expect(localeTag("ar", true)).toBe("ar-SA-u-ca-islamic-umalqura-nu-latn");
    // 1 Ramadan 1447 AH = 18 February 2026 (Umm al-Qura).
    expect(hijriDay("2026-02-18")).toBe(1);
    const ar = hijriLabel("2026-02-18", "ar");
    expect(ar).toMatch(/1/);
    expect(ar).not.toMatch(/[٠-٩]/);
    expect(hijriLabel("2026-02-18", "en")).toMatch(/1/);
  });

  it("writes long Gregorian dates with Western digits in Arabic", () => {
    const s = longDate("2026-10-10", "ar");
    expect(s).toContain("10");
    expect(s).toContain("2026");
    expect(s).not.toMatch(/[٠-٩]/);
  });
});

describe("grid keys", () => {
  it("mirror left and right in Arabic", () => {
    expect(arrowStep("ArrowRight", false)).toBe(1);
    expect(arrowStep("ArrowRight", true)).toBe(-1);
    expect(arrowStep("ArrowLeft", true)).toBe(1);
    expect(arrowStep("ArrowDown", true)).toBe(7);
    expect(arrowStep("Enter", false)).toBe(0);
  });
});

describe("pattern sentence", () => {
  it("becomes vendor_preview / vendor_request arguments", () => {
    expect(patternArgs({ ordinal: -1, interval: 2, from: "2026-10-10", until: "2027-03-31" })).toEqual({
      p_mode: "recurring", p_ordinal: -1, p_interval: 2, p_from: "2026-10-10", p_until: "2027-03-31",
    });
    expect(defaultUntil("2026-10-03", 365)).toBe("2027-10-03");
    expect(patternValid({ ordinal: 1, interval: 1, from: "2026-11-01", until: "2026-10-01" })).toBe(false);
    expect(patternValid({ ordinal: 1, interval: 1, from: "2026-10-01", until: "2026-12-31" })).toBe(true);
  });

  it("names the same Saturdays as the database", () => {
    expect(patternDays({ ordinal: 1, interval: 1, from: "2026-10-01", until: "2026-12-31" })).toEqual(["2026-10-03", "2026-11-07", "2026-12-05"]);
    expect(patternDays({ ordinal: -1, interval: 1, from: "2026-10-01", until: "2026-12-31" })).toEqual(["2026-10-31", "2026-11-28", "2026-12-26"]);
    expect(patternDays({ ordinal: 2, interval: 2, from: "2026-10-01", until: "2027-02-28" })).toEqual(["2026-10-10", "2026-12-12", "2027-02-13"]);
    for (const d of patternDays({ ordinal: 4, interval: 1, from: "2026-01-01", until: "2026-12-31" })) expect(weekday(d)).toBe(6);
  });
});

describe("calendar statuses", () => {
  const today = "2026-10-03";
  const e = (p: Partial<CalDay>): CalDay => ({ day: "2026-10-24", state: "open", reason: "", mine: null, taken: false, riders: null, ...p });
  it("reads each day", () => {
    expect(dayStatus("2026-10-24", undefined, today)).toBe("not_open");
    expect(dayStatus("2026-10-24", e({}), today)).toBe("available");
    expect(dayStatus("2026-10-24", e({ state: "closed", reason: "Ramadan" }), today)).toBe("closed");
    expect(dayStatus("2026-10-24", e({ taken: true }), today)).toBe("taken");
    const mine = { id: 1, status: "pending" as const, kind: "single" as const, series_id: null, note: "", staff_note: "" };
    expect(dayStatus("2026-10-24", e({ mine }), today)).toBe("requested");
    expect(dayStatus("2026-10-24", e({ mine: { ...mine, status: "confirmed" } }), today)).toBe("confirmed");
    expect(dayStatus("2026-10-24", e({ mine: { ...mine, status: "declined" }, taken: true }), today)).toBe("declined"); // not chosen (2026-10-04)
    expect(dayStatus("2026-09-26", e({ day: "2026-09-26" }), today)).toBe("past");
    // With the plan: inside the notice period, or past the booking window, is not "Available".
    expect(dayStatus("2026-10-05", e({ day: "2026-10-05" }), today, tier)).toBe("soon");
    expect(dayStatus("2027-03-06", e({ day: "2027-03-06" }), today, tier)).toBe("far");
    expect(dayStatus("2026-10-24", e({}), today, tier)).toBe("available");
  });

  it("knows what can be picked and what is late", () => {
    expect(pickable(e({ day: "2026-10-05" }), today, tier)).toBe(false); // inside the notice
    expect(pickable(e({ day: "2026-10-17" }), today, tier)).toBe(true);
    expect(pickable(e({ day: "2027-03-06" }), today, tier)).toBe(false); // beyond the horizon
    const conf = { id: 1, status: "confirmed" as const, kind: "single" as const, series_id: null, note: "", staff_note: "" };
    expect(lateCancel("2026-10-06", conf, today, tier)).toBe(true);
    expect(lateCancel("2026-10-17", conf, today, tier)).toBe(false);
    expect(lateCancel("2026-10-06", { ...conf, status: "pending" }, today, tier)).toBe(false);
  });

  it("words every verdict and the staff code", () => {
    expect(verdictText("en", { day: "2026-10-10", verdict: "too_soon", reason: "" }, tier)).toBe("Notice needed: 7 days");
    expect(verdictText("en", { day: "2026-10-10", verdict: "over_quota", reason: "" }, tier)).toBe("Over your plan's monthly limit (2)");
    expect(verdictText("en", { day: "2026-10-10", verdict: "closed", reason: "Weather" }, tier)).toBe("Closed: Weather");
    expect(staffNoteText("en", "another_venue")).toBe("Another venue was chosen for this date");
    expect(staffNoteText("ar", "another_venue")).toBe(STRINGS.ar.anotherVenue);
  });
});

describe("strings", () => {
  it("have Arabic for every key, without emoji", () => {
    const keys = Object.keys(STRINGS.en);
    expect(Object.keys(STRINGS.ar).sort()).toEqual(keys.sort());
    for (const lang of ["en", "ar"] as const) {
      for (const k of keys) {
        const s = STRINGS[lang][k as keyof typeof STRINGS.en];
        expect(s.length, `${lang}.${k}`).toBeGreaterThan(0);
        expect(/\p{Extended_Pictographic}/u.test(s), `${lang}.${k}`).toBe(false);
      }
    }
  });
});

describe("closed-date reasons", () => {
  it("translates the staff page's preset codes and keeps typed text", () => {
    expect(reasonText("en", "ramadan")).toBe("Ramadan");
    expect(reasonText("ar", "eid")).toBe("العيد");
    expect(reasonText("en", "Venue renovation")).toBe("Venue renovation");
  });
});
