// The 2026-10-04 audit's pure rules: Arabic plurals, the password policy, the contact's phone and
// email, the ride's times, the 48-hour rule, declined dates, roles and the insights.
import { describe, expect, it } from "vitest";
import { plural, PLURALS, pluralForm } from "../src/client/plurals";
import {
  arrivalWindow, canCancelSeries, canEditVenue, canRequest, dayStatus, e164, emailOk, insights, passwordProblem, rideTimes, within48h,
  type CalDay, type Mine, type SharedRatings, type Tier,
} from "../src/client/model";
import { STRINGS } from "../src/client/strings";

const mine = (o: Partial<Mine> = {}): Mine => ({ id: 1, status: "confirmed", kind: "single", series_id: null, note: "", staff_note: "", ...o });
const tier: Tier = { id: "multi", name_en: "Multi", name_ar: "", modes: ["single", "multi"], max_per_month: 2, horizon_days: 120, min_lead_days: 7, cancel_cutoff_days: 5, benefits: [] };

describe("plurals", () => {
  it("picks Arabic's six forms", () => {
    expect([0, 1, 2, 3, 10, 11, 99, 100, 101].map((n) => pluralForm("ar", n))).toEqual(["zero", "one", "two", "few", "few", "many", "many", "other", "other"]);
    expect([1, 2, 0].map((n) => pluralForm("en", n))).toEqual(["one", "other", "other"]);
  });

  it("words riders booked in each Arabic form, with Western digits", () => {
    expect(plural("ar", "ridersBooked", 1)).toBe("درّاج واحد مسجّل");
    expect(plural("ar", "ridersBooked", 2)).toBe("درّاجان مسجّلان");
    expect(plural("ar", "ridersBooked", 5)).toBe("5 درّاجين مسجّلين");
    expect(plural("ar", "ridersBooked", 12)).toBe("12 درّاجًا مسجّلًا");
    expect(plural("ar", "ridersBooked", 100)).toBe("100 درّاج مسجّل");
    expect(plural("en", "ridersBooked", 1)).toBe("1 rider booked");
    expect(plural("en", "ridersBooked", 1200)).toBe("1,200 riders booked");
    expect(plural("ar", "ridersBooked", 1200)).not.toMatch(/[٠-٩]/);
  });

  it("fills the other placeholders", () => {
    expect(plural("en", "previewSummary", 3, { ok: 2 })).toBe("2 of 3 dates can be requested.");
    expect(plural("ar", "previewSummary", 2, { ok: 1 })).toBe("يمكن طلب 1 من أصل تاريخين.");
  });

  it("has an other form for every phrase in both languages, and the same phrases", () => {
    expect(Object.keys(PLURALS.ar).sort()).toEqual(Object.keys(PLURALS.en).sort());
    for (const lang of ["en", "ar"] as const) for (const f of Object.values(PLURALS[lang])) expect(f.other).toBeTruthy();
  });

  it("every string key has both languages", () => {
    expect(Object.keys(STRINGS.ar).sort()).toEqual(Object.keys(STRINGS.en).sort());
    for (const [k, v] of Object.entries(STRINGS.ar)) expect(v, k).toBeTruthy();
  });
});

describe("password policy (NIST SP 800-63B, as vendor_set_password checks it)", () => {
  const ctx = { login: "owner@harbourcafe.sa", venueNames: ["Harbour Cafe", "مقهى الميناء"] };
  it("wants 10 to 200 characters and no composition rules", () => {
    expect(passwordProblem("short one", ctx)).toBe("WEAK_PASSWORD");
    expect(passwordProblem("a".repeat(201), ctx)).toBe("WEAK_PASSWORD");
    expect(passwordProblem("long quiet morning ride", ctx)).toBe("");
    expect(passwordProblem("all lowercase words here", ctx)).toBe("");
  });
  it("refuses common passwords", () => {
    expect(passwordProblem("Password123", ctx)).toBe("COMMON_PASSWORD");
    expect(passwordProblem("micromobility", ctx)).toBe("COMMON_PASSWORD");
    expect(passwordProblem("1234567890", ctx)).toBe("COMMON_PASSWORD");
    expect(passwordProblem("zzzzzzzzzzzz", ctx)).toBe("COMMON_PASSWORD");
  });
  it("refuses the login, the phone or the venue's name inside it", () => {
    expect(passwordProblem("owner-is-me-2026", ctx)).toBe("PERSONAL_PASSWORD");
    expect(passwordProblem("best harbour cafe ever", ctx)).toBe("PERSONAL_PASSWORD");
    expect(passwordProblem("HarbourCafe!!2026", ctx)).toBe("PERSONAL_PASSWORD");
    expect(passwordProblem("في مقهى الميناء دائما", ctx)).toBe("PERSONAL_PASSWORD");
    expect(passwordProblem("my number 0501234567", { login: "0501234567" })).toBe("PERSONAL_PASSWORD");
    expect(passwordProblem("call 501234567 now!", { login: "+966501234567" })).toBe("PERSONAL_PASSWORD");
  });
});

describe("the contact's phone and email", () => {
  it("writes phones as E.164, Saudi numbers made whole", () => {
    expect(e164("0501234567")).toBe("+966501234567");
    expect(e164("501234567")).toBe("+966501234567");
    expect(e164("+966 50 123 4567")).toBe("+966501234567");
    expect(e164("00966501234567")).toBe("+966501234567");
    expect(e164("+44 20 7946 0958")).toBe("+442079460958");
    expect(e164("")).toBe("");
    expect(e164("call me")).toBeNull();
    expect(e164("12")).toBeNull();
  });
  it("checks an email's shape", () => {
    expect(emailOk("")).toBe(true);
    expect(emailOk("a@b.co")).toBe(true);
    expect(emailOk("a@b")).toBe(false);
    expect(emailOk("a b@c.de")).toBe(false);
  });
});

describe("the ride's times and the 48 hours", () => {
  it("reads gathering and start, and an arrival window after the start", () => {
    expect(rideTimes("05:45 - 06:15")).toEqual({ gather: "05:45", start: "06:15" });
    expect(rideTimes("6:00–6:30")).toEqual({ gather: "06:00", start: "06:30" });
    expect(rideTimes("")).toBeNull();
    expect(rideTimes(null)).toBeNull();
    expect(arrivalWindow("06:15")).toEqual(["07:45", "08:45"]);
  });
  it("counts 48 hours to the day's start in Riyadh, for confirmed dates only", () => {
    const now = Date.parse("2026-10-08T12:00:00+03:00");
    expect(within48h("2026-10-10", mine(), now)).toBe(true);   // 36 hours to midnight
    expect(within48h("2026-10-11", mine(), now)).toBe(false);  // 60 hours
    expect(within48h("2026-10-10", mine({ status: "pending" }), now)).toBe(false);
  });
});

describe("declined dates and roles", () => {
  const day = (o: Partial<CalDay>): CalDay => ({ day: "2026-11-07", state: "open", reason: "", mine: null, taken: false, riders: null, ...o });
  it("a request not chosen reads Declined; a cancelled one reads Cancelled unless it can be asked for again", () => {
    expect(dayStatus("2026-11-07", day({ mine: mine({ status: "declined" }), taken: true }), "2026-10-04", tier)).toBe("declined");
    expect(dayStatus("2026-11-07", day({ mine: mine({ status: "cancelled" }) }), "2026-10-04", tier)).toBe("available");
    expect(dayStatus("2026-11-07", day({ mine: mine({ status: "cancelled" }), taken: true }), "2026-10-04", tier)).toBe("cancelled");
  });
  it("owner, manager and viewer", () => {
    expect([canRequest("owner"), canRequest("manager"), canRequest("viewer")]).toEqual([true, true, false]);
    expect([canEditVenue("owner"), canEditVenue("manager")]).toEqual([true, false]);
    expect([canCancelSeries("owner"), canCancelSeries("manager")]).toEqual([true, false]);
  });
});

describe("insights", () => {
  it("counts hosted and coming breakfasts, the last six turnouts, and the averages", () => {
    const fb = (rating: number, turnout: number | null) => ({ booking_id: 1, venue_id: 3, day: "", rating, turnout, went_well: "", improve: "", created_at: "", updated_at: "" });
    const days: CalDay[] = [
      { day: "2026-09-05", state: "open", reason: "", taken: false, riders: 20, mine: mine({ feedback: fb(4, 15) }) },
      { day: "2026-09-12", state: "open", reason: "", taken: false, riders: 18, mine: mine({ feedback: fb(5, null) }) },
      { day: "2026-09-19", state: "open", reason: "", taken: false, riders: 9, mine: mine({ status: "declined" }) },
      { day: "2026-10-10", state: "open", reason: "", taken: false, riders: 30, mine: mine() },
    ];
    const shared = [{ booking_id: 1, day: "2026-09-05", riders: 9, averages: { breakfast: 8 }, comments: [], shared_at: "" },
      { booking_id: 2, day: "2026-09-12", riders: 4, averages: { breakfast: 9 }, comments: [], shared_at: "" }] as SharedRatings[];
    const s = insights(days, shared, "2026-10-04");
    expect(s.hosted).toBe(2);
    expect(s.upcoming).toBe(1);
    expect(s.recent).toEqual([{ day: "2026-09-12", riders: 18, turnout: null }, { day: "2026-09-05", riders: 20, turnout: 15 }]);
    expect(s.sharedAvg).toBe(8.5);
    expect(s.ownAvg).toBe(4.5);
    expect(s.ownCount).toBe(2);
  });
});
