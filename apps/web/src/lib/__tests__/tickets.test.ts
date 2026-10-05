import { describe, expect, it, vi } from "vitest";
import { routeItems } from "../route-names";
import { addonLines, addonsCost, bookingRef, breakfastFor, cdLine, codeReady, countdownAt, countdownMoments, dayWord, doneToday, entryAddons, meetsAt, ticketRoute, ticketRow, ticketStages, fmtClock, fmtDayDate, icsFor, icsPlace, queueNumbers, rideEndsAt, ticketCue, ticketGroups, ticketLook, ticketSession, venueOf, venueText, type TicketRow } from "../tickets";
import { T as TICKET } from "@/components/booking/tickets.text";
import TicketCard from "@/components/booking/TicketCard";
import { createElement, type ReactElement } from "react";
// The site has no @types/react-dom; this test needs one function of it (as rating.test.ts does).
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { loadAddonItems } from "../ticket-addons";

const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;

// My Account's tickets follow the booking app's own rules (renderBookingTicket, bookingRef,
// downloadBookingICS): what the code says, when it is shown, and what the line under it says.
const jccRow = { id: "j1", session_date: "2099-03-01", event_kind: null, ride_kind: null, needs_approval: null, hide_queue: null, bike_slots: '{"_time":"21:00 - 23:00","_collect":"20:15"}', meet_url: null, paid_ride: null };
const satRow = { id: "2099-03-04", session_date: "2099-03-04", event_kind: "community", ride_kind: "saturday", needs_approval: true, hide_queue: true, bike_slots: '{"_time":"05:45 - 06:15"}', meet_url: "https://maps.app.goo.gl/x", paid_ride: false, title: "Saturday Social Ride" };
const jcc = ticketSession(jccRow)!;
const sat = ticketSession(satRow)!;
const row = (o: Partial<TicketRow>): TicketRow => ({ id: "q1abcdef", sessionId: "j1", date: "2099-03-01", day: "Sunday", queueNum: 4, status: "waiting", waitlistNum: null, approval: null, price: 75, paid: false, name: "Ann", type: "Road", checkedInAt: null, checkedOutAt: null, rideDuration: null, bikeId: null, addonLines: [], runKm: null, ...o });

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

describe("the breakfast stop (the booking app's _commInfoHtml)", () => {
  const bfRow = { ...satRow, breakfast_name: "Bean Box", breakfast_url: "https://maps.example.test/bean", breakfast_name_ar: "بين بوكس", breakfast_offer_en: "15% off breakfast", breakfast_offer_ar: "خصم ١٥٪" };
  it("shows the Arabic name on the Arabic page and the offer in the rider's language", () => {
    const s = ticketSession(bfRow)!;
    expect(breakfastFor(s, "en")).toEqual({ name: "Bean Box", url: "https://maps.example.test/bean", offer: "15% off breakfast" });
    expect(breakfastFor(s, "ar")).toEqual({ name: "بين بوكس", url: "https://maps.example.test/bean", offer: "خصم ١٥٪" });
    expect(breakfastFor(s, "fr")).toEqual({ name: "Bean Box", url: "https://maps.example.test/bean", offer: "15% off breakfast" });
  });
  it("falls back to what there is, refuses a bad link, and is the Saturday ride's only", () => {
    expect(breakfastFor(ticketSession({ ...bfRow, breakfast_name_ar: null, breakfast_offer_ar: null })!, "ar")).toEqual({ name: "Bean Box", url: "https://maps.example.test/bean", offer: "15% off breakfast" });
    expect(breakfastFor(ticketSession({ ...bfRow, breakfast_url: "javascript:alert(1)", breakfast_offer_en: null, breakfast_offer_ar: null })!, "en")).toEqual({ name: "Bean Box", url: null, offer: null });
    expect(breakfastFor(ticketSession({ ...bfRow, ride_kind: "event" })!, "en")).toBeNull();
    expect(breakfastFor(sat, "en")).toBeNull();
    expect(breakfastFor(undefined, "en")).toBeNull();
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
    // In UTC: Jeddah's hour less three, whatever zone the phone is in.
    expect(icsFor(jcc, "Ride", "")).toContain("DTSTART:20990301T180000Z\r\nDTEND:20990301T200000Z");
    expect(icsFor(sat, "Ride", "")).toContain("DTSTART:20990304T024500Z\r\nDTEND:20990304T051500Z");
    const late = ticketSession({ ...jccRow, bike_slots: '{"_time":"22:00 - 01:00"}' })!;
    expect(icsFor(late, "Ride", "")).toContain("DTSTART:20990301T190000Z\r\nDTEND:20990301T220000Z"); // 01:00 the next morning in Jeddah
    expect(icsFor(sat, "Saturday; ride", "")).toContain("SUMMARY:Saturday\\; ride");
  });
  it("knows when the ride is over, for the live map: the calendar file's end, past midnight too, else the end of its day", () => {
    expect(new Date(rideEndsAt(jcc)).toISOString()).toBe("2099-03-01T20:00:00.000Z"); // 23:00 in Jeddah
    expect(new Date(rideEndsAt(sat)).toISOString()).toBe("2099-03-04T05:15:00.000Z"); // two hours after the 06:15 start
    expect(new Date(rideEndsAt(ticketSession({ ...jccRow, bike_slots: '{"_time":"22:00 - 01:00"}' })!)).toISOString()).toBe("2099-03-01T22:00:00.000Z");
    expect(new Date(rideEndsAt(ticketSession({ ...jccRow, bike_slots: null })!)).toISOString()).toBe("2099-03-01T21:00:00.000Z"); // midnight in Jeddah
  });
  it("says where the ride is as the booking app does: the meeting point's link, the place staff wrote, the circuit", () => {
    const at = (location: string | null) => icsPlace(ticketSession({ ...jccRow, location })!);
    expect(at(null)).toBe("");
    expect(at("JCC")).toBe("Jeddah Corniche Circuit");
    expect(at("Sharafeyah Branch")).toBe("Sharafeyah, Jeddah");
    expect(at("Obhur beach")).toBe("Obhur beach");
    expect(icsPlace(sat)).toBe("https://maps.app.goo.gl/x");
    expect(icsFor(ticketSession({ ...jccRow, location: "Sharafeyah Branch" })!, "Ride", at("Sharafeyah Branch"))).toContain("LOCATION:Sharafeyah\\, Jeddah");
    expect(icsFor(jcc, "Ride", icsPlace(jcc))).toContain("LOCATION:Jeddah Corniche Circuit");
  });
});

describe("the add-ons on a ticket (the booking app's entryAddons, addonLineItems, addonsCost)", () => {
  const items = new Map([["gel", { name: "Energy gel", price: 12 }], ["cap", { name: "Cycling cap", price: 45 }]]);
  it("reads the stored list, its text, and the old list of bare ids, joining lines sold at the same price", () => {
    expect(entryAddons('[{"id":"gel","qty":2},{"id":"cap","qty":1,"p":40}]')).toEqual([{ id: "gel", qty: 2, p: null }, { id: "cap", qty: 1, p: 40 }]);
    expect(entryAddons([{ id: "gel", qty: 1, p: 10 }, { id: "gel", qty: 2, p: 10 }, { id: "gel", qty: 1, p: 12 }])).toEqual([{ id: "gel", qty: 3, p: 10 }, { id: "gel", qty: 1, p: 12 }]);
    expect(entryAddons('["gel","gel"]')).toEqual([{ id: "gel", qty: 2, p: null }]);
    expect(entryAddons([{ id: "gel", qty: 0 }, { id: "", qty: 3 }, null, 7])).toEqual([{ id: "gel", qty: 1, p: null }]);
    for (const v of [null, undefined, "", "[]", "not json", "{}"]) expect(entryAddons(v)).toEqual([]);
    expect(ticketRow({ id: "q1", session_id: "j1", session_date: "2099-03-01", status: "waiting", addons: '[{"id":"gel","qty":2}]' })!.addonLines).toEqual([{ id: "gel", qty: 2, p: null }]);
  });
  it("prices a line at what it was sold for, else today's price, and adds them up", () => {
    const rows = [row({ id: "a", name: "Ann", addonLines: [{ id: "gel", qty: 2, p: null }, { id: "cap", qty: 1, p: 40 }] }), row({ id: "b", name: "Bea", addonLines: [] })];
    const lines = addonLines(rows, items);
    expect(lines).toEqual([
      { rowId: "a", rider: "Ann", name: "Energy gel", qty: 2, amount: 24 },
      { rowId: "a", rider: "Ann", name: "Cycling cap", qty: 1, amount: 40 },
    ]);
    expect(addonsCost(lines)).toBe(64);
    expect(addonsCost([])).toBe(0);
  });
  it("lists a line it cannot price without an amount, and then says no total rather than a wrong one", () => {
    const rows = [row({ addonLines: [{ id: "gel", qty: 1, p: null }, { id: "gone", qty: 1, p: null }, { id: "cap", qty: 1, p: 40 }] })];
    expect(addonLines(rows, items).map((l) => [l.name, l.amount])).toEqual([["Energy gel", 12], ["gone", null], ["Cycling cap", 40]]);
    expect(addonsCost(addonLines(rows, items))).toBeNull();
    // the inventory could not be read: a stamped price still counts, the rest are unknown
    expect(addonLines(rows, null).map((l) => l.amount)).toEqual([null, null, 40]);
    expect(addonsCost(addonLines([row({ addonLines: [{ id: "cap", qty: 2, p: 40 }] })], null))).toBe(80);
  });
  it("asks the inventory only for the items the tickets hold, and says when it could not", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    try {
      const urls: string[] = [];
      const ok = (async (u: string) => { urls.push(u); return new Response(JSON.stringify([{ id: "gel", name: " Energy gel ", price: "12.5" }])); }) as unknown as typeof fetch;
      expect(await loadAddonItems(["gel", "gel", "bad id;"], ok)).toEqual(new Map([["gel", { name: "Energy gel", price: 12.5 }]]));
      expect(urls).toEqual(["https://example.supabase.co/rest/v1/inventory?select=id,name,price&id=in.(gel)"]);
      expect(await loadAddonItems([], ok)).toEqual(new Map());
      const down = (async () => new Response("{}", { status: 503 })) as unknown as typeof fetch;
      expect(await loadAddonItems(["gel"], down)).toBeNull();
    } finally {
      vi.unstubAllEnvs();
    }
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
  it("keeps the map link of a route as the Routes page resolves it (routeItems)", () => {
    const content = { "routes.routes.items": [{ slug: { en: "obhur", ar: "obhur" }, name: { en: "Obhur coast", ar: "شاطئ أبحر" }, km: 32.5, href: { href: "https://maps.app.goo.gl/o" } }] };
    const routes = routeItems(content, "en");
    expect(routes.get("obhur")?.href).toBe("https://maps.app.goo.gl/o");
    expect(ticketRoute({ ...jcc, routeSlug: "obhur" }, routes)).toMatchObject({ name: "Obhur coast", href: "https://maps.app.goo.gl/o" });
  });
});


describe("a Run for Her ticket (ride_kind 'runher', 2026-10-05)", () => {
  // As the booking app makes a run: members only, free, nobody approves it, gather - start, at the
  // Jeddah Yacht Club with the meeting point's map link.
  const runRow = { id: "2099-10-17-rh", session_date: "2099-10-17", event_kind: "community", ride_kind: "runher", needs_approval: false, hide_queue: true, open_to_all: false, paid_ride: false, bike_slots: '{"_time":"06:00 - 06:30"}', meet_url: "https://maps.app.goo.gl/run", location: "JYC", title: "Run for Her", capacity: 80 };
  const run = ticketSession(runRow)!;
  const t = TICKET.en;

  it("has no bikes, gathers, is free, and shows its number (nobody approves it)", () => {
    expect(run).toMatchObject({ kind: "runher", bikes: false, gathers: true, approval: false, free: true, freeRide: true, times: ["06:00", "06:30"], meetUrl: "https://maps.app.goo.gl/run", location: "JYC" });
    expect(bookingRef(row({ sessionId: run.id, queueNum: 12 }), run)).toBe("MMC-12-q1abcd");
    expect(codeReady([row({})], run)).toBe(true);
  });
  it("is at the Jeddah Yacht Club, and its button opens the meeting point", () => {
    expect(venueOf(run)).toEqual({ kind: "jyc" });
    expect(venueText(venueOf(run), t)).toBe("Jeddah Yacht Club");
    expect(venueText(venueOf(run), TICKET.ar)).toBe("نادي جدة لليخوت");
    expect(meetsAt(run)).toBe(true);
    // the rides staff approve meet at their link too; a circuit night does not
    expect(meetsAt(sat)).toBe(true);
    expect(meetsAt(jcc)).toBe(false);
    expect(meetsAt(undefined)).toBe(false);
    // the other venues are as before
    expect(venueText(venueOf(jcc), t)).toBe("Jeddah Corniche Circuit");
    expect(venueText(venueOf(sat), t)).toBe("Meeting point");
    expect(venueText(venueOf(ticketSession({ ...jccRow, location: "Obhur" })!), t)).toBe("Obhur");
  });
  it("counts down to the gathering, then the start, and has no bike step and no route", () => {
    expect(countdownMoments(run, "2099-10-17").map((x) => x[1])).toEqual(["gather", "start"]);
    expect(ticketStages([row({ status: "active" })], run.bikes, null, "en").stages.map((x) => x.key)).toEqual(["booked", "in", "done"]);
    const routes = new Map([["obhur", { name: "Obhur coast", km: 32.5, level: "Easy", surface: "Road", href: "https://maps.app.goo.gl/o" }]]);
    expect(ticketRoute(run, routes)).toBeNull();
    expect(ticketRoute({ ...run, routeSlug: "obhur" }, routes)).toBeNull();
  });
  it("puts the meeting point, else the Jeddah Yacht Club, in the calendar, and never calls it a bike rental", () => {
    expect(icsPlace(run)).toBe("https://maps.app.goo.gl/run");
    const noLink = ticketSession({ ...runRow, meet_url: null })!;
    expect(icsPlace(noLink)).toBe("Jeddah Yacht Club");
    const ics = icsFor(noLink, "Run for Her - Saturday", icsPlace(noLink));
    expect(ics).toContain("LOCATION:Jeddah Yacht Club");
    // from the gathering (06:00 in Jeddah) to two hours after the 06:30 start, in UTC
    expect(ics).toContain("DTSTART:20991017T030000Z\r\nDTEND:20991017T053000Z");
    expect(ics).toContain("DESCRIPTION:Your MicroMobility booking. Be at the meeting point by the gathering time and show your ticket there.");
    expect(ics).not.toMatch(/bike rental/i);
    expect(ics).not.toMatch(/ride reminder/i);
    // a circuit night is still a bike rental; the pool is a booking to turn up for
    expect(icsFor(jcc, "Ride", "")).toContain("bike rental");
    expect(icsFor(ticketSession({ ...satRow, ride_kind: "swim", needs_approval: false })!, "Swim", "")).toContain("DESCRIPTION:Your MicroMobility booking. Arrive 10 minutes early and show your ticket when you arrive.");
  });
  it("reads the distance each runner picked, 3 or 5 km only, and never as a bike type", () => {
    const at = (run_km: unknown) => ticketRow({ id: "r1", session_id: run.id, session_date: "2099-10-17", status: "waiting", type_preference: "None", run_km });
    expect(at(5)).toMatchObject({ runKm: 5, type: "None" });
    expect(at("3")!.runKm).toBe(3);
    for (const bad of [4, 0, null, undefined, "", "five"]) expect(at(bad)!.runKm, String(bad)).toBeNull();
    // a ride's row has none
    expect(ticketRow({ id: "j", session_id: "j1", session_date: "2099-03-01", status: "waiting", type_preference: "Road" })!.runKm).toBeNull();
  });
  it("says Runner number and the distance in the ticket's words", () => {
    expect(t.runnerNumber).toBe("Runner number");
    expect(TICKET.ar.runnerNumber).toBe("رقم العدّاء");
    expect(t.rtKm("5")).toBe("5 km");
    expect(TICKET.ar.rtKm("3")).toBe("3 كم");
  });
  it("draws the card: the runner's number and distance, the yacht club, the meeting point, no helmet line, cancel only", () => {
    const card = (s: typeof run, r: Record<string, unknown>, place: string | null) => renderToStaticMarkup(createElement(TicketCard, {
      locale: "en", today: "2099-10-10", rows: [ticketRow({ id: "rh1abcdef", session_id: s.id, session_date: s.date, session_day: "Saturday", status: "waiting", queue_num: 12, price: 0, paid: false, name: "Test Runner", ...r })!],
      session: s, name: "Run for Her", cue: null, t, gather: "Gathering", start: "Start", typeName: (x: string) => x,
      links: { edit: "https://book.example.test/?ev=runher", manage: "https://book.example.test/?tab=bookings", place }, now: Date.parse("2099-10-10T09:00:00Z"),
    }));
    const html = card(run, { type_preference: "None", run_km: 5 }, run.meetUrl);
    expect(html).toContain("Runner number");
    expect(html).not.toContain("Queue number");
    expect(html).toMatch(/class="tk-type tk-km">5 km</);
    expect(html).toContain("Jeddah Yacht Club");
    expect(html).toContain("Gathering at 6 AM");
    expect(html).toMatch(/href="https:\/\/maps\.app\.goo\.gl\/run"[^>]*>.*?Meeting point/);
    expect(html).not.toContain("Get directions");
    expect(html).not.toContain("Helmets");
    expect(html).toContain("Participants");
    expect(html).not.toContain(">Edit<");
    expect(html).not.toContain("Reschedule");
    expect(html).toContain(">Cancel<");
    // a circuit night keeps its own words: the queue number, the bike type, the helmet, Edit and Reschedule
    const ride = card(jcc, { type_preference: "Road", price: 75 }, "https://maps.app.goo.gl/jcc");
    expect(ride).toContain("Queue number");
    expect(ride).not.toContain("tk-km");
    expect(ride).toContain("Helmets");
    expect(ride).toContain(">Edit<");
    expect(ride).toContain("Reschedule");
    expect(ride).toContain("Get directions");
  });
});
