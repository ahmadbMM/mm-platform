import { describe, expect, it } from "vitest";
import { calEventOf, googleCalUrl, icsText } from "../src/client/ics";

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
  it("a ride that gathers ends two hours after it sets off, not as it sets off", () => {
    const ics = icsText({ id: "d", title: "Saturday Social Ride", date: "2099-11-07", time: "05:30 - 06:00", starts_at: "2099-11-07T05:30:00+03:00", location: null, gathers: true }, now);
    expect(ics).toContain("DTSTART:20991107T023000Z");
    expect(ics).toContain("DTEND:20991107T050000Z");
  });
  it("the start the database gives wins over the typed times", () => {
    expect(icsText({ id: "c", title: "Ride", date: "2099-11-05", time: "17:00 - 23:00", starts_at: "2099-11-05T16:30:00+03:00", location: null }, now)).toContain("DTSTART:20991105T133000Z");
  });
});

describe("the calendar file of 2026-11-11 (the report's Tier 1)", () => {
  it("carries the volunteer's own two reminders: a day before and two hours before", () => {
    const ics = icsText({ id: "x", title: "Blood night", date: "2099-11-05", time: "17:00 - 23:00", location: null }, now);
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(2);
    expect(ics).toContain("TRIGGER:-P1D");
    expect(ics).toContain("TRIGGER:-PT2H");
    expect(ics).toContain("URL:https://volunteer.micromobility.sa/#o/x");
  });
  it("the end the database gives wins, and a start it knows is never a whole day", () => {
    const ends = icsText({ id: "e", title: "Ride", date: "2099-11-07", time: "05:30 - 06:00", starts_at: "2099-11-07T05:30:00+03:00", ends_at: "2099-11-07T09:00:00+03:00", location: null, gathers: true }, now);
    expect(ends).toContain("DTEND:20991107T060000Z");
    const noTimes = icsText({ id: "f", title: "Clean-up", date: "2099-12-01", time: null, starts_at: "2099-12-01T08:00:00+03:00", location: null }, now);
    expect(noTimes).toContain("DTSTART:20991201T050000Z");
    expect(noTimes).toContain("DTEND:20991201T080000Z");
    expect(noTimes).not.toContain("VALUE=DATE");
  });
  it("folds a long line at 75 octets, as calendars want", () => {
    const ics = icsText({ id: "g", title: "حملة التبرع بالدم في مركز جدة للمؤتمرات مع فريق المتطوعين الكامل", date: "2099-11-05", time: "17:00 - 23:00", location: null }, now);
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length, line).toBeLessThanOrEqual(75);
    expect(ics).toMatch(/\r\n SUMMARY|\r\n [^\r\n]+/);
  });
  it("puts where to meet first, and the role and the staff contact in the notes", () => {
    const ev = calEventOf({ id: "h", date: "2099-11-05", time: "17:00 - 23:00", location: "JCC", meet_point: "Gate 3", role: "Guide", contact_name: "Ahmad", contact_phone: "+966500000010" }, "Blood night", false);
    expect(ev.location).toBe("Gate 3");
    expect(ev.note).toBe("Guide\nJCC\nAhmad +966500000010");
    const g = new URL(googleCalUrl(ev));
    expect(g.hostname).toBe("calendar.google.com");
    expect(g.searchParams.get("dates")).toBe("20991105T140000Z/20991105T200000Z");
    expect(g.searchParams.get("location")).toBe("Gate 3");
  });
});
