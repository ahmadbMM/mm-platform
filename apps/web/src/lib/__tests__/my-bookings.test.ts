import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, isValidElement, type ReactElement } from "react";
// The site has no @types/react-dom; this test needs one function of it (as rating.test.ts does).
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import AccountPage from "../../app/[locale]/account/[[...part]]/page";
import TicketCard, { TicketCancelled } from "@/components/booking/TicketCard";
import { TicketWake } from "@/components/booking/TicketParts";
import Countdown from "@/components/booking/Countdown";
import { T as TICKET } from "@/components/booking/tickets.text";
import { BOOTH_APPLE, BOOTH_DIR, cancelledGroups, icsFor, placeLink, shareLink, ticketRoute, ticketSession, todayCode, type TicketRow } from "../tickets";
import { resetRides } from "../rides";
import { resetSiteContent } from "../site";

const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;

// My Bookings after the booking app's research round (2026-11-10), mirrored on My Account: the cancelled bookings kept
// as quiet rows, a done ride not yet marked paid kept, the date on one line, today's code large, the route and add-ons
// behind Details, Calendar / Directions / Share, the circuit at the booth, one calendar event per booking, Leave
// waitlist, and the countdown a timer.
const jccRow = { id: "j1", session_date: "2099-03-01", event_kind: null, ride_kind: null, needs_approval: null, hide_queue: null, bike_slots: '{"_time":"21:00 - 23:00","_collect":"20:15"}', meet_url: null, paid_ride: null };
const jcc = ticketSession(jccRow)!;
const row = (o: Partial<TicketRow>): TicketRow => ({ id: "q1abcdef", sessionId: "j1", date: "2099-03-01", day: "Sunday", queueNum: 4, status: "waiting", waitlistNum: null, approval: null, price: 75, paid: false, name: "Ann", type: "Road", checkedInAt: null, checkedOutAt: null, rideDuration: null, bikeId: null, addonLines: [], runKm: null, ...o });
type CardOpts = { today?: string; past?: boolean; t?: typeof TICKET.en; locale?: string; links?: Record<string, string | null>; withRoute?: boolean; items?: Map<string, { name: string; price: number | null }> | null; lockers?: Map<string, { period: string; code: string | null; status: string }> | null };
const card = (rows: TicketRow[], o: CardOpts = {}) => renderToStaticMarkup(createElement(TicketCard, {
  locale: o.locale ?? "en", today: o.today ?? "2099-03-01", rows, session: jcc, name: "Open Sports Day", cue: null, t: o.t ?? TICKET.en, gather: "Gathering", start: "Start", typeName: (x: string) => x, past: o.past,
  links: { edit: "https://book.example.test/?ev=jcc", manage: "https://book.example.test/?tab=bookings", place: BOOTH_DIR, share: "https://book.example.test/reserve?ev=jcc&session=j1", bookings: "https://book.example.test/my-bookings", ...o.links },
  route: o.withRoute ? ticketRoute(jcc, new Map()) : null, now: Date.parse("2099-03-01T09:00:00Z"), addonItems: o.items ?? null, lockers: o.lockers ?? null,
}));

describe("the cancelled bookings (the booking app's _mrCancelled)", () => {
  const cx = (o: Record<string, unknown>) => ({ id: "c1", session_id: "2099-03-05", session_date: "2099-03-05", status: "cancelled", cancelled_by: "customer", ...o });
  it("keep one row per booking whose day has not gone, saying who cancelled it, soonest first", () => {
    expect(cancelledGroups([cx({ session_id: "2099-03-09", session_date: "2099-03-09", cancelled_by: null }), cx({}), cx({ id: "c2", cancelled_by: "staff" })], "2099-03-01"))
      .toEqual([{ key: "2099-03-05", sessionId: "2099-03-05", date: "2099-03-05", by: "staff" }, { key: "2099-03-09", sessionId: "2099-03-09", date: "2099-03-09", by: "" }]);
    expect(cancelledGroups([cx({ session_date: "2099-03-01", session_id: "2099-03-01" })], "2099-03-01")[0].by).toBe("customer"); // today is not gone
  });
  it("leave out a day gone, a rider turned down, and a booking that still has a place on it", () => {
    expect(cancelledGroups([cx({ session_date: "2099-02-28", session_id: "2099-02-28" })], "2099-03-01")).toEqual([]);
    expect(cancelledGroups([cx({ approval: "rejected", cancelled_by: "staff" })], "2099-03-01")).toEqual([]);
    expect(cancelledGroups([cx({}), cx({ id: "w1", status: "waiting" })], "2099-03-01")).toEqual([]);
    expect(cancelledGroups([cx({}), cx({ id: "d1", status: "done" })], "2099-03-01")).toEqual([]);
    expect(cancelledGroups([cx({ status: "no_show" })], "2099-03-01")).toEqual([]);
  });
  it("draw a quiet row: the ride, its day and time, who cancelled it; no code, no money, nothing to press", () => {
    const draw = (by: "staff" | "customer" | "", t = TICKET.en, locale = "en") => renderToStaticMarkup(createElement(TicketCancelled, { locale, date: "2099-03-01", session: jcc, name: "Open Sports Day", by, t, gather: "Gathering", start: "Start" }));
    const html = draw("customer");
    expect(html).toContain("Open Sports Day");
    expect(html).toContain('<span class="tk-cx-chip">Cancelled by you</span>');
    expect(html).toContain("<bdi>Sunday 1 Mar 2099</bdi> · <bdi>9 PM – 11 PM</bdi>");
    expect(draw("staff")).toContain(">Cancelled by us<");
    expect(draw("")).toContain(">Cancelled<");
    for (const no of ["<a", "<button", "tk-qr", "MMC", "SAR", "⃁", "Ann"]) expect(html, no).not.toContain(no);
    expect(draw("customer", TICKET.ar, "ar")).toContain(">أُلغي بطلبك<");
    expect(draw("staff", TICKET.ar, "ar")).toContain(">أُلغي من قِبَلنا<");
    expect(draw("", TICKET.ar, "ar")).toContain(">ملغي<");
  });
});

describe("the ticket's date and code", () => {
  it("says the date on one line and the place on one more, start-aligned under the number", () => {
    const html = card([row({})]);
    expect(html).toContain('<p class="tk-when-d"><strong class="tk-dw">Today</strong><span class="tk-sep" aria-hidden="true">·</span><bdi class="tk-seg">Sunday 1 Mar 2099</bdi><span class="tk-sep" aria-hidden="true">·</span><bdi>9 PM – 11 PM</bdi></p>');
    expect(html).toContain('<p class="tk-when-p"><span class="tk-venue">Jeddah Corniche Circuit</span><span class="tk-sep" aria-hidden="true">·</span><span class="go tk-seg">Collect bikes from 8:15 PM</span></p>');
    expect(html).not.toContain("<br");
    expect(card([row({})], { today: "2099-02-28" })).toContain('<strong class="tk-dw">Tomorrow</strong>');
    expect(card([row({})], { today: "2099-02-20" })).not.toContain("tk-dw");
  });
  it("draws today's code large under the number, named with what it says; other days keep the corner code", () => {
    const today = card([row({})]);
    expect(today).toMatch(/<div class="tk-qr-big"><span class="tk-qr"><svg role="img" aria-label="Booking QR code MMC-4-q1abcd" width="224" height="224"/);
    expect(today).not.toContain("tk-right");
    const later = card([row({})], { today: "2099-02-28" });
    expect(later).not.toContain("tk-qr-big");
    expect(later).toMatch(/<div class="tk-right"><span class="tk-qr"><svg role="img" aria-label="Booking QR code MMC-4-q1abcd" width="132" height="132"/);
    // a waitlisted rider brings the same code when a place opens; a rider on the bike keeps it; a past card has none
    expect(card([row({ status: "waitlist", queueNum: 9 })])).toContain("tk-qr-big");
    expect(card([row({ status: "active" })])).toContain("tk-qr-big");
    expect(card([row({ status: "done" })], { past: true })).not.toContain("tk-qr");
  });
  it("is large only on the ride's day, for a code that is out", () => {
    const sat = ticketSession({ ...jccRow, event_kind: "community", ride_kind: "saturday", needs_approval: true, hide_queue: true })!;
    expect(todayCode([row({})], jcc, "2099-03-01")).toBe(true);
    expect(todayCode([row({})], jcc, "2099-02-28")).toBe(false);
    expect(todayCode([row({})], jcc, "2099-03-01", true)).toBe(false);
    expect(todayCode([row({ status: "done" })], jcc, "2099-03-01")).toBe(false);
    expect(todayCode([row({ approval: "pending" })], sat, "2099-03-01")).toBe(false); // the list is not out: no code at all
  });
});

describe("the ticket's Details, buttons and words", () => {
  const items = new Map([["gel", { name: "Energy gel", price: 12 }]]);
  it("folds the route and the add-ons behind one Details row, closed, with the total in view", () => {
    const html = card([row({ addonLines: [{ id: "gel", qty: 1, p: null }] })], { withRoute: true, items });
    expect(html).toMatch(/<div class="tk-more"><button type="button" class="tk-more-btn" aria-expanded="false" aria-controls="([^"]+)"><span>Details<\/span><svg class="tk-more-ic"[^>]*>.*?<\/svg><\/button><div class="tk-more-body" id="\1" hidden="">/);
    const body = html.indexOf('class="tk-more-body"');
    expect(html.indexOf(">Route<")).toBeGreaterThan(body);
    expect(html.indexOf("6.17 km a lap")).toBeGreaterThan(body);
    expect(html.indexOf("Energy gel")).toBeGreaterThan(body);
    expect(html.indexOf('class="tk-total"')).toBeGreaterThan(html.indexOf("Energy gel"));
    expect(card([row({})])).not.toContain("tk-more"); // nothing to look up, no row
    expect(card([row({})], { withRoute: true, t: TICKET.ar, locale: "ar" })).toContain("<span>التفاصيل</span>");
  });
  it("keeps a locker on the booking in view, its period and number under Locker", () => {
    const html = card([row({ addonLines: [{ id: "locker", qty: 1, p: 15 }] })], { lockers: new Map([["q1abcdef", { period: "both", code: "L7", status: "reserved" }]]) });
    expect(html).not.toContain("tk-more");
    expect(html).toContain('<p class="tk-addons-h">Locker</p>');
    expect(html).toContain("6 PM - 11 PM · L7");
  });
  it("puts Calendar and Directions side by side, Share square at the end of their row, the Live map on its own", () => {
    const html = card([row({})], { links: { live: "/live?session=j1" } });
    const acts = /<div class="tk-actions tk-go">(.*?)<\/div>(?=<div class="tk-manage">)/.exec(html)?.[1] ?? "";
    expect(acts).toMatch(/^<a class="tk-btn tk-cal" href="data:text\/calendar[^"]*" download="micromobility-20990301\.ics"><svg[^>]*>.*?<\/svg>Add to calendar<\/a><a class="tk-btn tk-dir" href="https:\/\/www\.google\.com\/maps\/dir\/\?api=1&amp;destination=21\.624565%2C39\.106812" target="_blank" rel="noopener"><svg[^>]*>.*?<\/svg>Get directions<\/a><dialog class="tk-dlg"/);
    expect(acts).toContain(`<a class="tk-dlg-a" href="${BOOTH_APPLE.replace(/&/g, "&amp;")}" target="_blank" rel="noopener">Apple Maps</a>`);
    expect(acts).toContain(">Google Maps</a>");
    expect(acts).toMatch(/<\/dialog><button type="button" class="tk-btn tk-share" aria-label="Share" title="Share"><svg[^>]*>.*?<\/svg><\/button><a class="tk-btn solid tk-map" href="\/live\?session=j1">/);
    // a meeting point's link stays as it was, with no choice of maps
    const meet = card([row({})], { links: { place: "https://maps.app.goo.gl/x" } });
    expect(meet).toContain('href="https://maps.app.goo.gl/x"');
    expect(meet).not.toContain("tk-dlg");
    // no Share without its link; drawn icons only, never an emoji
    expect(card([row({})], { links: { share: null } })).not.toContain("tk-share");
    expect(html).not.toMatch(/\p{Extended_Pictographic}/u);
  });
  it("says Leave waitlist on a waitlist's ticket, Cancel on a booking", () => {
    expect(card([row({ status: "waitlist" })])).toContain('<a class="tk-btn red" href="https://book.example.test/?tab=bookings">Leave waitlist</a>');
    expect(card([row({ status: "waitlist" })], { t: TICKET.ar, locale: "ar" })).toContain(">مغادرة قائمة الانتظار</a>");
    expect(card([row({ status: "waitlist" }), row({ id: "q2abcdef", queueNum: 5 })])).toContain(">Cancel</a>"); // a place is held
    expect(card([row({})])).toContain(">Cancel</a>");
  });
  it("makes the countdown a timer", () => {
    const html = renderToStaticMarkup(createElement(Countdown, { moments: [[Date.parse("2099-03-01T17:15:00Z"), "collect"]], now: Date.parse("2099-03-01T09:00:00Z"), t: { collect: "Bike collection in {0}", gather: "Gathering in {0}", start: "Starts in {0}", h: "{h} h", hm: "{h} h {m} min", m: "{m} min" } }));
    expect(html).toMatch(/^<p class="tk-cd" role="timer">/);
  });
});

describe("where a ticket leads", () => {
  it("writes one calendar event per booking: its UID, a SEQUENCE and the way back to My Bookings", () => {
    const now = new Date("2099-02-01T00:00:00Z");
    const ics = icsFor(jcc, "Ride", "", now, { id: "q1abcdef", url: "https://book.example.test/my-bookings" });
    expect(ics).toContain("METHOD:PUBLISH");
    expect(ics).toContain("UID:booking-q1abcdef@micromobility.sa\r\nSEQUENCE:4073587200\r\n");
    expect(ics).toContain("URL:https://book.example.test/my-bookings\r\n");
    expect(icsFor(jcc, "Ride", "", now)).toContain("UID:session-j1@micromobility.sa");
    expect(icsFor(jcc, "Ride", "", now, { id: "q1", url: "javascript:alert(1)" })).not.toContain("URL:");
    expect(decodeURIComponent(/href="data:text\/calendar;charset=utf-8,([^"]*)"/.exec(card([row({})]))![1])).toContain("UID:booking-q1abcdef@micromobility.sa");
  });
  it("sends Directions to the booth on the circuit, a meeting point to its link, another place to a search by its name", () => {
    expect(BOOTH_DIR).toBe("https://www.google.com/maps/dir/?api=1&destination=21.624565%2C39.106812");
    expect(BOOTH_APPLE).toBe("https://maps.apple.com/?daddr=21.624565%2C39.106812&dirflg=d");
    expect(placeLink(jcc, BOOTH_DIR)).toBe(BOOTH_DIR);
    expect(placeLink(ticketSession({ ...jccRow, location: "JCC" })!, BOOTH_DIR)).toBe(BOOTH_DIR);
    expect(placeLink(ticketSession({ ...jccRow, location: "Obhur beach" })!, BOOTH_DIR)).toBe("https://www.google.com/maps/search/?api=1&query=Obhur%20beach");
    expect(placeLink(ticketSession({ ...jccRow, location: "Sharafeyah Branch" })!, BOOTH_DIR)).toBe("https://www.google.com/maps/search/?api=1&query=Sharafeyah%2C%20Jeddah");
    expect(placeLink(ticketSession({ ...jccRow, event_kind: "community", ride_kind: "saturday", meet_url: "https://maps.app.goo.gl/x" })!, BOOTH_DIR)).toBe("https://maps.app.goo.gl/x");
    expect(placeLink(undefined, BOOTH_DIR)).toBe(BOOTH_DIR);
    // a meeting point staff left without its link still has a way there (the booking app's _dirBtnHtml): Run for Her
    // the Jeddah Yacht Club, the DEFE 5K and a ride staff approve with no place the booth, one with a place its name
    expect(placeLink(ticketSession({ ...jccRow, event_kind: "community", ride_kind: "runher", needs_approval: false })!, BOOTH_DIR)).toBe("https://www.google.com/maps/search/?api=1&query=Jeddah%20Yacht%20Club");
    expect(placeLink(ticketSession({ ...jccRow, event_kind: "community", ride_kind: "defe5k", needs_approval: false })!, BOOTH_DIR)).toBe(BOOTH_DIR);
    expect(placeLink(ticketSession({ ...jccRow, event_kind: "community", ride_kind: "saturday" })!, BOOTH_DIR)).toBe(BOOTH_DIR);
    expect(placeLink(ticketSession({ ...jccRow, event_kind: "community", ride_kind: "saturday", location: "Obhur beach" })!, BOOTH_DIR)).toBe("https://www.google.com/maps/search/?api=1&query=Obhur%20beach");
  });
  it("shares the booking app's page for the same date, or its front page for a ride not booked from a list", () => {
    expect(shareLink("https://book.example.test/?lang=en", "jcc", "2099-03-01")).toBe("https://book.example.test/reserve?ev=jcc&session=2099-03-01");
    for (const ev of ["community", "petromin", "blood", undefined]) expect(shareLink("https://book.example.test/", ev, "x")).toBe("https://book.example.test/");
    expect(shareLink("not a url", "jcc", "x")).toBeNull();
  });
});

// The page itself: a cancelled booking listed after the tickets, a done ride not yet paid kept as tonight's past card,
// and the screen kept awake while today's code is on it.
const jar = vi.hoisted(() => ({ account: "" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (n === "mm_acct" && jar.account ? { name: n, value: jar.account } : undefined) }) }));
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
function findAll(n: unknown, type: unknown, out: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(n)) { for (const x of n) findAll(x, type, out); return out; }
  if (!isValidElement(n)) return out;
  if (n.type === type) out.push(n);
  findAll((n.props as { children?: unknown }).children, type, out);
  return out;
}
describe("My Account's rides", () => {
  beforeEach(() => {
    resetRides(); resetSiteContent();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2099-03-01T09:00:00Z")); // noon in Riyadh
  });
  afterEach(() => { jar.account = ""; vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("lists a cancelled booking after the tickets, keeps tonight's ride done but unpaid, and keeps the phone awake for today's code", async () => {
    jar.account = "c1~a1b2c3d4e5f6a7b8c9d0";
    const bookings = [
      { id: "w1abcdef", session_id: "j9", session_date: "2099-03-01", session_day: "Sunday", status: "waiting", queue_num: 3, price: 75, paid: false, name: "Ann", type_preference: "Road" },
      { id: "d1abcdef", session_id: "j1", session_date: "2099-03-01", session_day: "Sunday", status: "done", queue_num: 1, price: 75, paid: false, name: "Ann", type_preference: "Road" },
      { id: "c1abcdef", session_id: "2099-03-05", session_date: "2099-03-05", session_day: "Thursday", status: "cancelled", cancelled_by: "staff", price: 75, name: "Ann" },
      { id: "c2abcdef", session_id: "2099-03-06", session_date: "2099-03-06", status: "cancelled", cancelled_by: "staff", approval: "rejected", name: "Ann" },
      { id: "c3abcdef", session_id: "2099-02-20", session_date: "2099-02-20", status: "cancelled", cancelled_by: "customer", name: "Ann" },
    ];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const fn = /\/rpc\/([a-z0-9_]+)/.exec(String(url))?.[1] ?? "";
      if (fn === "customer_profile") return json([{ name: "Ann Rider", email: "ann@example.test", phone: "+966500000000" }]);
      if (fn === "my_bookings") return json(bookings);
      if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": "0-0/0" } });
      return json([]);
    }));
    const p = await AccountPage({ params: Promise.resolve({ locale: "en", part: undefined }), searchParams: Promise.resolve({}) });
    const cx = findAll(p, TicketCancelled).map((e) => e.props as { date: string; by: string });
    expect(cx).toEqual([expect.objectContaining({ date: "2099-03-05", by: "staff" })]);
    const cards = findAll(p, TicketCard).map((e) => e.props as { past?: boolean; rows: TicketRow[]; links: { share?: string | null; place: string | null } });
    expect(cards.map((c) => [c.rows[0].id, !!c.past])).toEqual([["w1abcdef", false], ["d1abcdef", true]]);
    expect(cards[0].links.place).toBe(BOOTH_DIR);
    expect(findAll(p, TicketWake)).toHaveLength(1);
  });
});
