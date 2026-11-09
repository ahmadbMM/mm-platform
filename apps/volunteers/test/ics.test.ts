import { describe, expect, it } from "vitest";
import { icsText } from "../src/client/ics";

// "Add to calendar": the file is made on the phone, in UTC (Riyadh is UTC+3 all year).
const now = new Date("2026-11-09T10:00:00Z");

describe("the calendar file", () => {
  it("turns a session's Riyadh times into UTC, and says what and where", () => {
    const ics = icsText({ id: "2099-11-05-bd", title: "Micromobility Blood Donation", date: "2099-11-05", time: "17:00 - 23:00", location: "JCC, Gate 3; north", note: "Guide" }, now);
    expect(ics).toContain("DTSTART:20991105T140000Z");
    expect(ics).toContain("DTEND:20991105T200000Z");
    expect(ics).toContain("DTSTAMP:20261109T100000Z");
    expect(ics).toContain("UID:2099-11-05-bd@volunteer.micromobility.sa");
    expect(ics).toContain("LOCATION:JCC\\, Gate 3\\; north");
    expect(ics.split("\r\n")[0]).toBe("BEGIN:VCALENDAR");
  });
  it("a shift past midnight ends the next day, and one with no times is the whole day", () => {
    expect(icsText({ id: "a", title: "Night", date: "2099-11-05", time: "22:00 - 01:00", location: null }, now)).toContain("DTEND:20991105T220000Z");
    const day = icsText({ id: "b", title: "Clean-up", date: "2099-12-01", time: null, location: null }, now);
    expect(day).toContain("DTSTART;VALUE=DATE:20991201");
    expect(day).toContain("DTEND;VALUE=DATE:20991202");
    expect(day).not.toContain("LOCATION");
  });
  it("the start the database gives wins over the typed times", () => {
    expect(icsText({ id: "c", title: "Ride", date: "2099-11-05", time: "17:00 - 23:00", starts_at: "2099-11-05T16:30:00+03:00", location: null }, now)).toContain("DTSTART:20991105T133000Z");
  });
});
