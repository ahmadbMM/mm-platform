import { describe, expect, it } from "vitest";
import { bookingRef, cdLine, codeReady, countdownAt, countdownMoments, dayWord, doneToday, ticketRoute, ticketStages, fmtClock, fmtDayDate, icsFor, queueNumbers, ticketCue, ticketGroups, ticketLook, ticketSession, venueOf, type TicketRow } from "../tickets";

// My Account's tickets follow the booking app's own rules (renderBookingTicket, bookingRef,
// downloadBookingICS): what the code says, when it is shown, and what the line under it says.
const jccRow = { id: "j1", session_date: "2099-03-01", event_kind: null, ride_kind: null, needs_approval: null, hide_queue: null, bike_slots: '{"_time":"21:00 - 23:00","_collect":"20:15"}', meet_url: null, paid_ride: null };
const satRow = { id: "2099-03-04", session_date: "2099-03-04", event_kind: "community", ride_kind: "saturday", needs_approval: true, hide_queue: true, bike_slots: '{"_time":"05:45 - 06:15"}', meet_url: "https://maps.app.goo.gl/x", paid_ride: false, title: "Saturday Social Ride" };
const jcc = ticketSession(jccRow)!;
const sat = ticketSession(satRow)!;
const row = (o: Partial<TicketRow>): TicketRow => ({ id: "q1abcdef", sessionId: "j1", date: "2099-03-01", day: "Sunday", queueNum: 4, status: "waiting", waitlistNum: null, approval: null, price: 75, paid: false, name: "Ann", type: "Road", checkedInAt: null, checkedOutAt: null, rideDuration: null, bikeId: null, ...o });

describe("a session as the ticket reads it", () => {
  it("knows the circuit's window and collect time, and a ride staff approve", () => {
    expect(jcc).toMatchObject({ approval: false, published: false, times: ["21:00", "23:00"], collect: "20:15", gathers: false, bikes: true, free: false });
    expect(sat).toMatchObject({ approval: true, published: false, gathers: true, meetUrl: "https://maps.app.goo.gl/x", free: true });
    expect(ticketSession({ ...satRow, hide_queue: false })!.published).toBe(true);
    expect(ticketSession({ ...satRow, meet_url: "javascript:alert(1)" })!.meetUrl).toBeNull();
    expect(ticketSession({ ...satRow, ride_kind: "swim" })).toMatchObject({ bikes: false, gathers: false }); // the pool is a start - end window
    // a ticketed event: seats, no bikes, nobody approves, and the route a ride follows when one is set
    expect(ticketSession({ ...satRow, ride_kind: "event", needs_approval: false, route_slug: "al-balad-heritage-ride" })).toMatchObject({ kind: "event", bikes: false, approval: false, gathers: false, routeSlug: "al-balad-heritage-ride" });
    expect(jcc.routeSlug).toBeNull();
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
  it("are dark only while a place is held, as the booking app's night ticket (tk-live)", () => {
    expect(ticketLook([row({})], jcc)).toBe("live");
    expect(ticketLook([row({ status: "active" })], jcc)).toBe("live");
    expect(ticketLook([row({ status: "waitlist" })], jcc)).toBe("wl");
    expect(ticketLook([row({ status: "waitlist" }), row({ status: "waitlist" })], jcc)).toBe("wl");
    // a reservation staff have not confirmed stays paper until its code is out
    expect(ticketLook([row({ approval: "approved" })], sat)).toBe("");
    expect(ticketLook([row({ approval: "approved" })], { ...sat, published: true })).toBe("live");
    expect(ticketLook([row({ approval: "pending" })], { ...sat, published: true })).toBe("");
    // the National Day card keeps its own skin
    expect(ticketLook([row({})], { ...jcc, kind: "snd96" })).toBe("");
  });
  it("say Today and Tomorrow, on the Riyadh calendar, across a month's end", () => {
    expect(dayWord("2099-03-01", "2099-03-01")).toBe("today");
    expect(dayWord("2099-03-02", "2099-03-01")).toBe("tomorrow");
    expect(dayWord("2099-03-01", "2099-02-28")).toBe("tomorrow");
    expect(dayWord("2099-03-03", "2099-03-01")).toBeNull();
    expect(dayWord("2099-02-28", "2099-03-01")).toBeNull();
  });
  it("name the venue: the circuit, a place staff wrote, or the meeting point", () => {
    expect(venueOf(jcc)).toEqual({ kind: "circuit" });
    expect(venueOf(ticketSession({ ...jccRow, location: "JCC" })!)).toEqual({ kind: "circuit" });
    expect(venueOf(ticketSession({ ...jccRow, location: " Obhur " })!)).toEqual({ kind: "text", text: "Obhur" });
    expect(venueOf(sat)).toEqual({ kind: "meet" });
    expect(venueOf(undefined)).toEqual({ kind: "circuit" });
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

describe("the ride night", () => {
  it("counts down to bike collection then the start, or the gathering then the start, in Riyadh time", () => {
    const m = countdownMoments(jcc, "2099-03-01");
    expect(m.map((x) => x[1])).toEqual(["collect", "start"]);
    expect(m[0][0]).toBe(Date.parse("2099-03-01T20:15:00+03:00"));
    expect(countdownAt(m, Date.parse("2099-03-01T19:00:00+03:00"))).toEqual({ key: "collect", min: 75 });
    expect(countdownAt(m, Date.parse("2099-03-01T20:59:30+03:00"))).toEqual({ key: "start", min: 1 });
    expect(countdownAt(m, Date.parse("2099-03-01T21:00:00+03:00"))).toBeNull();
    expect(countdownMoments(sat, "2099-03-04").map((x) => x[1])).toEqual(["gather", "start"]);
    expect(countdownMoments(ticketSession({ ...satRow, ride_kind: "swim", needs_approval: false })!, "2099-03-04").map((x) => x[1])).toEqual(["start"]);
  });
  it("writes the countdown's line outside the browser too (the ticket is drawn on the server)", () => {
    const m = countdownMoments(jcc, "2099-03-01");
    const t = { collect: "Bike collection in {0}", gather: "Gathering in {0}", start: "Starts in {0}", h: "{h} h", hm: "{h} h {m} min", m: "{m} min" };
    expect(cdLine(m, Date.parse("2099-03-01T19:00:00+03:00"), t)).toBe("Bike collection in 1 h 15 min");
    expect(cdLine(m, Date.parse("2099-03-01T20:30:00+03:00"), t)).toBe("Starts in 30 min");
    expect(cdLine(m, Date.parse("2099-03-01T21:00:00+03:00"), t)).toBe("");
  });
  it("shows where the rider is: booked, checked in, on the bike, done", () => {
    const at = (r: Partial<TicketRow>[], bikes = true, name: string | null = null) => ticketStages(r.map(row), bikes, name, "en");
    expect(at([{}]).cur).toBe(0);
    const inn = at([{ status: "active", checkedInAt: "2099-03-01T17:40:00Z" }]);
    expect(inn.cur).toBe(1);
    expect(inn.stages[1].sub).toBe("8:40 PM");
    expect(at([{ status: "active", bikeId: "b1" }], true, "B-12").stages[2]).toEqual({ key: "bike", on: true, sub: "B-12" });
    expect(at([{ status: "active", bikeId: "b1" }]).stages[2].on).toBe(true); // a bike the site cannot name still counts
    const done = at([{ status: "done", bikeId: "b1", checkedOutAt: "2099-03-01T19:05:00Z" }], true, "B-12");
    expect(done.cur).toBe(3);
    expect(done.stages[2].sub).toBe("");
    expect(done.stages[3].sub).toBe("10:05 PM");
    expect(at([{}], false).stages.map((x) => x.key)).toEqual(["booked", "in", "done"]);
  });
  it("keeps tonight's finished ride, and nothing still ahead", () => {
    const rows = [
      { id: "a", session_id: "j1", session_date: "2099-03-01", status: "done" },
      { id: "b", session_id: "j2", session_date: "2099-03-01", status: "done" },
      { id: "c", session_id: "j2", session_date: "2099-03-01", status: "active" },
      { id: "d", session_id: "j0", session_date: "2099-02-28", status: "done" },
    ];
    expect(doneToday(rows, "2099-03-01").map((g) => g.sessionId)).toEqual(["j1"]);
  });
  it("names the route: a Routes page item, the circuit drawn, or nothing", () => {
    const routes = new Map([["obhur", { name: "Obhur coast", km: 32.5, level: "Easy", surface: "Road", href: "https://maps.app.goo.gl/o" }]]);
    expect(ticketRoute(jcc, routes)).toMatchObject({ km: 6.174, lap: true, track: true });
    expect(ticketRoute({ ...jcc, routeSlug: "obhur" }, routes)).toEqual({ name: "Obhur coast", km: 32.5, lap: false, note: "Easy · Road", href: "https://maps.app.goo.gl/o", track: false });
    expect(ticketRoute({ ...jcc, routeSlug: "gone" }, routes)).toBeNull();
    expect(ticketRoute({ ...jcc, location: "Obhur" }, routes)).toBeNull();
    expect(ticketRoute(sat, routes)).toBeNull(); // meets at a map link
    expect(ticketRoute({ ...jcc, bikes: false }, routes)).toBeNull();
  });
});

