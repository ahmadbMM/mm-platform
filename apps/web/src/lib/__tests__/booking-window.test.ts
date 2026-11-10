import { describe, expect, it } from "vitest";
import { bookingWindow, notOpenYet, opensAt, opensOn, opensText, siteBookingWindow } from "../booking-window";
import { durText, opensIn, riyadhMs } from "../opens-in";

// The booking window, exactly as the database applies it (_booking_window_guard): a date beyond it
// is greyed out on the site's lists, and never hidden.
describe("bookingWindow", () => {
  it("reads the window staff saved, and nothing that is not one", () => {
    expect(bookingWindow({ days: 7, at: "09:00" })).toEqual({ days: 7, at: "09:00" });
    expect(bookingWindow({ days: 14 })).toEqual({ days: 14, at: null });
    expect(bookingWindow({ days: "3", at: "9:30" })).toEqual({ days: 3, at: "09:30" });
    expect(bookingWindow({ days: 0, at: "" })).toEqual({ days: 0, at: null });
    for (const bad of [null, undefined, "7", {}, { days: -1 }, { days: 2.5 }, { days: 7, at: "25:00" }, { days: 7, at: "nine" }, { at: "09:00" }]) expect(bookingWindow(bad), JSON.stringify(bad)).toBeNull();
    expect(siteBookingWindow({ "booking.window": { days: 5, at: "20:00" } })).toEqual({ days: 5, at: "20:00" });
    expect(siteBookingWindow(null)).toBeNull();
  });
});

describe("notOpenYet", () => {
  const w = { days: 7, at: "09:00" };
  it("keeps a session beyond the window closed, and one within it open", () => {
    expect(notOpenYet("2026-10-10", w, "2026-10-01T12:00")).toBe(true); // opens on the 3rd
    expect(notOpenYet("2026-10-10", w, "2026-10-04T00:00")).toBe(false);
    expect(notOpenYet("2026-10-10", w, "2026-10-10T20:00")).toBe(false); // tonight
  });
  it("opens at the hour on the boundary day", () => {
    expect(notOpenYet("2026-10-10", w, "2026-10-03T08:59")).toBe(true);
    expect(notOpenYet("2026-10-10", w, "2026-10-03T09:00")).toBe(false);
    // no hour: open from midnight of the day
    expect(notOpenYet("2026-10-10", { days: 7, at: null }, "2026-10-03T00:00")).toBe(false);
    expect(notOpenYet("2026-10-10", { days: 7, at: null }, "2026-10-02T23:59")).toBe(true);
  });
  it("counts across month and year ends", () => {
    expect(opensOn("2026-11-03", { days: 7, at: null })).toEqual({ day: "2026-10-27", at: null });
    expect(opensOn("2027-01-02", { days: 7, at: "10:00" })).toEqual({ day: "2026-12-26", at: "10:00" });
    expect(notOpenYet("2027-01-02", w, "2026-12-25T23:00")).toBe(true);
    expect(notOpenYet("2027-01-02", w, "2026-12-26T09:00")).toBe(false);
  });
  it("holds nobody without a window, or with a date it cannot read", () => {
    expect(notOpenYet("2099-01-01", null, "2026-10-01T12:00")).toBe(false);
    expect(notOpenYet("soon", w, "2026-10-01T12:00")).toBe(false);
    // a window of 0 days: only the day itself
    expect(notOpenYet("2026-10-02", { days: 0, at: "07:00" }, "2026-10-01T23:00")).toBe(true);
    expect(notOpenYet("2026-10-02", { days: 0, at: "07:00" }, "2026-10-02T07:00")).toBe(false);
  });
});

// Within a day of opening, the date counts down to the real window (the research's row 3, 2026-11-10); further away it
// says the day and a 12-hour time.
describe("the countdown to the window", () => {
  const w = { days: 7, at: "09:00" };
  const en = (e: string) => e; // the page's words, English
  const at = (iso: string) => Date.parse(iso); // a moment, written in UTC
  it("knows the moment the window opens, in Riyadh", () => {
    expect(opensAt("2026-10-10", w)).toBe(at("2026-10-03T06:00:00Z")); // 9 AM in Riyadh
    expect(opensAt("2026-10-10", { days: 7, at: null })).toBe(at("2026-10-02T21:00:00Z")); // midnight
    expect(riyadhMs("2027-01-01", "00:30")).toBe(at("2026-12-31T21:30:00Z"));
  });
  it("counts whole minutes, rounded up, and only within a day", () => {
    const open = opensAt("2026-10-10", w);
    expect(opensIn(open, open - (2 * 60 + 10) * 60000)).toEqual({ h: 2, m: 10 });
    expect(opensIn(open, open - 30 * 1000)).toEqual({ h: 0, m: 1 }); // never "0 min"
    expect(opensIn(open, open - 24 * 3600e3)).toEqual({ h: 24, m: 0 });
    expect(opensIn(open, open - 24 * 3600e3 - 1)).toBeNull(); // more than a day away
    expect(opensIn(open, open)).toBeNull(); // open
    expect(opensIn(open, open + 60000)).toBeNull();
  });
  it("words it in hours and minutes", () => {
    const ws = { hm: "{h} h {m} min", h: "{h} h", m: "{m} min" };
    expect(durText({ h: 2, m: 10 }, ws)).toBe("2 h 10 min");
    expect(durText({ h: 0, m: 45 }, ws)).toBe("45 min");
    expect(durText({ h: 3, m: 0 }, ws)).toBe("3 h");
    expect(durText({ h: 2, m: 10 }, { hm: "{h} س {m} د", h: "{h} س", m: "{m} د" })).toBe("2 س 10 د");
  });
  it("says the countdown within a day, and the day with a 12-hour time further away", () => {
    const open = opensAt("2026-10-10", { days: 7, at: "21:30" });
    expect(opensText("2026-10-10", { days: 7, at: "21:30" }, "en", en, open - 130 * 60000)).toBe("Booking opens in 2 h 10 min");
    expect(opensText("2026-10-10", { days: 7, at: "21:30" }, "en", en, open - 45 * 60000)).toBe("Booking opens in 45 min");
    expect(opensText("2026-10-10", { days: 7, at: "21:30" }, "ar", (_e, a) => a ?? _e, open - 130 * 60000)).toBe("يبدأ الحجز بعد 2 س 10 د");
    expect(opensText("2026-10-10", { days: 7, at: "21:30" }, "en", en, open - 2 * 86400e3)).toBe("Booking opens Sat 3 Oct at 9:30 PM");
    expect(opensText("2026-10-10", { days: 7, at: "21:30" }, "en", en)).toBe("Booking opens Sat 3 Oct at 9:30 PM");
  });
});
