import { describe, expect, it } from "vitest";
import { bookingWindow, notOpenYet, opensOn, siteBookingWindow } from "../booking-window";

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
