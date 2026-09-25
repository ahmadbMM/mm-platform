import { describe, expect, it } from "vitest";
import { bookingRef, codeReady, fmtClock, fmtDayDate, icsFor, queueNumbers, ticketCue, ticketGroups, ticketSession, type TicketRow } from "../tickets";

// My Account's tickets follow the booking app's own rules (renderBookingTicket, bookingRef,
// downloadBookingICS): what the code says, when it is shown, and what the line under it says.
const jccRow = { id: "j1", session_date: "2099-03-01", event_kind: null, ride_kind: null, needs_approval: null, hide_queue: null, bike_slots: '{"_time":"21:00 - 23:00","_collect":"20:15"}', meet_url: null, paid_ride: null };
const satRow = { id: "2099-03-04", session_date: "2099-03-04", event_kind: "community", ride_kind: "saturday", needs_approval: true, hide_queue: true, bike_slots: '{"_time":"05:45 - 06:15"}', meet_url: "https://maps.app.goo.gl/x", paid_ride: false, title: "Saturday Social Ride" };
const jcc = ticketSession(jccRow)!;
const sat = ticketSession(satRow)!;
const row = (o: Partial<TicketRow>): TicketRow => ({ id: "q1abcdef", sessionId: "j1", date: "2099-03-01", day: "Sunday", queueNum: 4, status: "waiting", waitlistNum: null, approval: null, price: 75, paid: false, name: "Ann", type: "Road", ...o });

describe("a session as the ticket reads it", () => {
  it("knows the circuit's window and collect time, and a ride staff approve", () => {
    expect(jcc).toMatchObject({ approval: false, published: false, times: ["21:00", "23:00"], collect: "20:15", gathers: false, bikes: true, free: false });
    expect(sat).toMatchObject({ approval: true, published: false, gathers: true, meetUrl: "https://maps.app.goo.gl/x", free: true });
    expect(ticketSession({ ...satRow, hide_queue: false })!.published).toBe(true);
    expect(ticketSession({ ...satRow, meet_url: "javascript:alert(1)" })!.meetUrl).toBeNull();
    expect(ticketSession({ ...satRow, ride_kind: "swim" })).toMatchObject({ bikes: false, gathers: false }); // the pool is a start - end window
  });
});

describe("the tickets", () => {
  it("are the live bookings still ahead, one per night, soonest first, in queue order", () => {
    const g = ticketGroups([
      { id: "a", session_id: "j2", session_date: "2099-03-08", status: "waiting", queue_num: 2 },
      { id: "b", session_id: "j1", session_date: "2099-03-01", status: "waiting", queue_num: 7 },
      { id: "c", session_id: "j1", session_date: "2099-03-01", status: "waiting", queue_num: 5 },
      { id: "d", session_id: "old", session_date: "2099-02-01", status: "waiting", queue_num: 1 },
      { id: "e", session_id: "j3", session_date: "2099-03-09", status: "cancelled", queue_num: 1 },
    ], "2099-03-01");
    expect(g.map((x) => x.sessionId)).toEqual(["j1", "j2"]);
    expect(g[0].rows.map((r) => r.queueNum)).toEqual([5, 7]);
  });
  it("carry the code the staff scanner reads, without a number on a ride staff approve", () => {
    expect(bookingRef(row({}), jcc)).toBe("MMC-4-q1abcd");
    expect(bookingRef(row({}), sat)).toBe("MMC-q1abcd");
    expect(bookingRef(row({}), undefined)).toBe("MMC-q1abcd");
  });
  it("show the code at once, except on a ride staff approve before its list is out", () => {
    expect(codeReady([row({})], jcc)).toBe(true);
    expect(codeReady([row({ approval: "approved" })], sat)).toBe(false);
    const pub = { ...sat, published: true };
    expect(codeReady([row({ approval: "approved" })], pub)).toBe(true);
    expect(codeReady([row({ approval: "approved" }), row({ approval: "pending" })], pub)).toBe(false);
  });
  it("say where the rider stands, as the booking app does", () => {
    expect(ticketCue([row({})], jcc, false)).toBe("next");
    expect(ticketCue([row({})], jcc, true)).toBe("inQueue");
    expect(ticketCue([row({})], jcc, null)).toBeNull();
    expect(ticketCue([row({ status: "active" })], jcc, null)).toBe("onBike");
    expect(ticketCue([row({ approval: "approved" })], sat, null)).toBe("underReview");
    const pub = { ...sat, published: true };
    expect(ticketCue([row({ approval: "approved" })], pub, null)).toBe("confirmed");
    expect(ticketCue([row({ approval: "pending" })], pub, null)).toBe("pending");
    expect(ticketCue([row({ status: "waitlist" })], pub, null)).toBe("waitlist");
  });
  it("number a party as the booking app does", () => {
    expect(queueNumbers([row({ queueNum: 4 })])).toBe("#4");
    expect(queueNumbers([row({ queueNum: 4 }), row({ queueNum: 5 })])).toBe("#4 – #5");
    expect(queueNumbers([row({ queueNum: 4 }), row({ queueNum: 7 })])).toBe("#4, #7");
  });
});

describe("times and dates", () => {
  it("read in English as the booking app writes them, and in every other language in its own clock", () => {
    expect(fmtClock("21:00", "en")).toBe("9 PM");
    expect(fmtClock("05:45", "en")).toBe("5:45 AM");
    expect(fmtClock("21:00", "de")).toBe("21:00");
    expect(fmtClock("21:00", "ar")).toMatch(/9:00\s*م/);
    expect(fmtDayDate("2099-03-01", "en")).toBe("Sunday · 1 Mar 2099");
    expect(fmtDayDate("2099-09-27", "en")).toMatch(/^[A-Z][a-z]+day · 27 Sept? 2099$/);
  });
});

describe("the calendar file", () => {
  it("runs the circuit's window, a gathering to two hours after the start, and past midnight into the next day", () => {
    expect(icsFor(jcc, "Ride", "")).toContain("DTSTART:20990301T210000\r\nDTEND:20990301T230000");
    expect(icsFor(sat, "Ride", "")).toContain("DTSTART:20990304T054500\r\nDTEND:20990304T081500");
    const late = ticketSession({ ...jccRow, bike_slots: '{"_time":"22:00 - 01:00"}' })!;
    expect(icsFor(late, "Ride", "")).toContain("DTEND:20990302T010000");
    expect(icsFor(sat, "Saturday; ride", "")).toContain("SUMMARY:Saturday\\; ride");
  });
});
