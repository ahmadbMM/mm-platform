import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactElement } from "react";
// The site has no @types/react-dom; this test needs one function of it (as tickets.test.ts does).
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { comingAnswer, comingBody, comingCancelLink, comingCounts, comingMoments, lateAnswer, lateBody, lateFrom, lateSaid, lateWindow, stillComing } from "../still-coming";
import { ticketRow, ticketSession, type TicketRow, type TicketSession } from "../tickets";
import { loadTicketSessions } from "../tickets-data";
import { resetSessionColumns } from "../rides";
import { POST } from "../../app/api/account/coming/route";
import { POST as LATE } from "../../app/api/account/late/route";
import TicketCard from "@/components/booking/TicketCard";
import { T as TICKET } from "@/components/booking/tickets.text";
import { COMING_WORDS, comingWords } from "@/components/booking/Coming.words";
import { LOCALE_CODES } from "@/i18n/locales";
import { serverLocalize } from "@/i18n/dicts";

const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;

// "Still coming?" on My Account's ticket (the booking app's new features F2, 2026-11-13: _stcTm, _stcAt, _stcHtml): from 24
// hours before the time to turn up until the start, a held place asks I'm coming / Can't come; a yes is one quiet chip.
const H = 3600e3;
const jcc = ticketSession({ id: "2099-03-01", session_date: "2099-03-01", event_kind: null, ride_kind: null, needs_approval: null, hide_queue: null, bike_slots: '{"_time":"21:00 - 23:00","_collect":"20:15"}', meet_url: null, paid_ride: null })!;
const satRow = { id: "2099-03-07", session_date: "2099-03-07", event_kind: "community", ride_kind: "saturday", needs_approval: true, hide_queue: false, bike_slots: '{"_time":"05:45 - 06:15"}', meet_url: "https://maps.app.goo.gl/x", paid_ride: false };
const sat = ticketSession(satRow)!;
const swim = ticketSession({ id: "2099-03-02-tw", session_date: "2099-03-02", event_kind: "community", ride_kind: "swim", needs_approval: false, hide_queue: false, bike_slots: '{"_time":"18:00 - 19:30"}', meet_url: null, paid_ride: true })!;
const late = ticketSession({ ...satRow, id: "2099-03-08", session_date: "2099-03-08", bike_slots: '{"_time":"23:30 - 00:15"}' })!;
// 20:15 and 21:00 in Riyadh on 1 March 2099
const GO = Date.parse("2099-03-01T17:15:00Z"), ST = Date.parse("2099-03-01T18:00:00Z");
const entry = (s: TicketSession, o: Record<string, unknown> = {}) =>
  ticketRow({ id: "q1abcdef", session_id: s.id, session_date: s.date, session_day: "Sunday", status: "waiting", queue_num: 4, price: 75, paid: false, name: "Ann", type_preference: "Road", coming_at: null, ...o })!;

describe("when to turn up and when it starts (_stcTm)", () => {
  it("is bike collection then the start on a circuit night, the gathering then the start on a ride that gathers, the start alone without bikes", () => {
    expect(comingMoments(jcc)).toEqual({ go: GO, st: ST });
    expect(comingMoments(sat)).toEqual({ go: Date.parse("2099-03-07T02:45:00Z"), st: Date.parse("2099-03-07T03:15:00Z") });
    expect(comingMoments(swim)).toEqual({ go: Date.parse("2099-03-02T15:00:00Z"), st: Date.parse("2099-03-02T15:00:00Z") });
    // a collection time left out is 45 minutes before the start, as the booking app's sessionCollectTime
    expect(comingMoments(ticketSession({ id: "j2", session_date: "2099-03-01", bike_slots: '{"_time":"21:00 - 23:00"}' })!)?.go).toBe(Date.parse("2099-03-01T17:15:00Z"));
  });
  it("puts a start before the time to turn up on the next day, and has none without times", () => {
    expect(comingMoments(late)).toEqual({ go: Date.parse("2099-03-08T20:30:00Z"), st: Date.parse("2099-03-08T21:15:00Z") });
    expect(comingMoments({ ...jcc, times: null })).toBeNull();
  });
  it("counts a yes from 48 hours before the time to turn up", () => {
    const m = { go: GO };
    expect(comingCounts(new Date(GO - 48 * H).toISOString(), m)).toBe(true);
    expect(comingCounts(new Date(GO - 48 * H - 1).toISOString(), m)).toBe(false);
    expect(comingCounts(null, m)).toBe(false);
    expect(comingCounts("soon", m)).toBe(false);
  });
});

describe("what the ticket shows (_stcHtml)", () => {
  it("asks from 24 hours before the time to turn up until the start, for the session and its first waiting booking", () => {
    const rows = [entry(jcc)];
    expect(stillComing(rows, jcc, GO - 24 * H - 1)).toBeNull();
    expect(stillComing(rows, jcc, GO - 24 * H)).toEqual({ ask: true, ok: false, late: 0, lateOn: false, sessionId: jcc.id, bookingId: "q1abcdef" });
    expect(stillComing(rows, jcc, ST - 1)).toEqual({ ask: true, ok: false, late: 0, lateOn: false, sessionId: jcc.id, bookingId: "q1abcdef" });
    expect(stillComing(rows, jcc, ST)).toBeNull();
  });
  it("is one chip once every waiting rider said yes for this date, the party's first answer standing for all", () => {
    const yes = new Date(GO - 2 * H).toISOString(), old = new Date(GO - 72 * H).toISOString();
    expect(stillComing([entry(jcc, { coming_at: yes })], jcc, GO - H)).toEqual({ ask: true, ok: true, late: 0, lateOn: false, sessionId: jcc.id, bookingId: "q1abcdef" });
    expect(stillComing([entry(jcc, { coming_at: old })], jcc, GO - H)?.ok).toBe(false); // a yes for another date
    const party = [entry(jcc, { coming_at: yes }), entry(jcc, { id: "q2abcdef", queue_num: 5, coming_at: null })];
    expect(stillComing(party, jcc, GO - H)?.ok).toBe(false);
    expect(stillComing(party.map((r) => ({ ...r, comingAt: yes })), jcc, GO - H)?.ok).toBe(true);
  });
  it("asks nothing of a read without the column, a waitlist, a rider checked in, tonight's past card, a session not seen or called off", () => {
    const now = GO - H;
    expect(stillComing([ticketRow({ ...rawRow(jcc) })!], jcc, now)).toBeNull(); // no coming_at in the row
    expect(stillComing([entry(jcc, { status: "waitlist", queue_num: null })], jcc, now)).toBeNull();
    expect(stillComing([entry(jcc), entry(jcc, { id: "q2abcdef", status: "active" })], jcc, now)).toBeNull();
    expect(stillComing([entry(jcc)], jcc, now, true)).toBeNull();
    expect(stillComing([entry(jcc)], undefined, now)).toBeNull();
    expect(stillComing([entry(jcc)], { ...jcc, calledOff: true }, now)).toBeNull();
    expect(stillComing([], jcc, now)).toBeNull();
  });
  it("asks on a ride staff approve only once its list is out and the rider is on it", () => {
    const now = Date.parse("2099-03-07T00:00:00Z");
    expect(stillComing([entry(sat, { approval: "approved" })], sat, now)).toEqual({ ask: true, ok: false, late: 0, lateOn: false, sessionId: sat.id, bookingId: "q1abcdef" });
    expect(stillComing([entry(sat, { approval: "approved" })], { ...sat, published: false }, now)).toBeNull();
    expect(stillComing([entry(sat, { approval: "pending" })], sat, now)).toBeNull();
  });
  it("asks on a session without bikes too, in words that never say ride or bike", () => {
    expect(stillComing([entry(swim, { type_preference: "None" })], swim, Date.parse("2099-03-02T12:00:00Z"))?.ok).toBe(false);
    for (const l of LOCALE_CODES) for (const v of Object.values(COMING_WORDS[l])) expect(v, l).not.toMatch(/ride|bike|cycl|vélo|bici|велосипед|سائیکل|साइकि|साइकल|সাইকেল|自行车|自転車|basikal|sepeda|\bRad\b|جولة|دراجة/i);
  });
});

const rawRow = (s: TicketSession) => ({ id: "q1abcdef", session_id: s.id, session_date: s.date, session_day: "Sunday", status: "waiting", queue_num: 4, price: 75, paid: false, name: "Ann", type_preference: "Road" });

describe("the booking and session as the ticket reads them", () => {
  it("carries coming_at and bike_report_at only when the read has the columns", () => {
    const bare = ticketRow(rawRow(jcc))!;
    expect("comingAt" in bare || "bikeReportAt" in bare || "bikeIds" in bare).toBe(false);
    expect(ticketRow({ ...rawRow(jcc), coming_at: null, bike_report_at: null })).toMatchObject({ comingAt: null, bikeReportAt: null });
    expect(ticketRow({ ...rawRow(jcc), coming_at: "2099-03-01T10:00:00+00:00", bike_report_at: "2099-03-01T19:00:00+00:00" }))
      .toMatchObject({ comingAt: "2099-03-01T10:00:00+00:00", bikeReportAt: "2099-03-01T19:00:00+00:00" });
  });
  it("keeps every bike of a row handed more than one, the first as before", () => {
    expect(ticketRow({ ...rawRow(jcc), assigned_bike_id: '["b1","b2"]' })).toMatchObject({ bikeId: "b1", bikeIds: ["b1", "b2"] });
    const one = ticketRow({ ...rawRow(jcc), assigned_bike_id: '["b1"]' })!;
    expect([one.bikeId, "bikeIds" in one]).toEqual(["b1", false]);
    expect(ticketRow({ ...rawRow(jcc), assigned_bike_id: "b7" })!.bikeIds).toBeUndefined();
  });
  it("knows a session called off by staff's cancel or its status, when the read has them", () => {
    expect("calledOff" in jcc).toBe(false);
    const row = { id: "j1", session_date: "2099-03-01", bike_slots: '{"_time":"21:00 - 23:00"}' };
    expect(ticketSession({ ...row, cancelled_at: null, ride_status: null })!.calledOff).toBe(false);
    expect(ticketSession({ ...row, cancelled_at: "2099-02-28T10:00:00Z" })!.calledOff).toBe(true);
    expect(ticketSession({ ...row, ride_status: "cancelled" })!.calledOff).toBe(true);
    expect(ticketSession({ ...row, ride_status: "moved" })!.calledOff).toBe(false);
  });
  it("asks the sessions read for both columns, and does without one the database lacks", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    resetSessionColumns();
    const urls: string[] = [];
    const f = vi.fn(async (u: string) => {
      urls.push(u);
      if (u.includes("ride_status")) return new Response(JSON.stringify({ code: "42703", message: "column sessions.ride_status does not exist" }), { status: 400 });
      return new Response(JSON.stringify([{ id: "j1", session_date: "2099-03-01", bike_slots: '{"_time":"21:00 - 23:00"}', cancelled_at: "2099-02-28T10:00:00Z" }]), { status: 200 });
    });
    const got = await loadTicketSessions(["j1"], { id: "c1", token: "t" }, f as unknown as typeof fetch);
    expect(urls[0]).toMatch(/cancelled_at/);
    expect(urls[0]).toMatch(/ride_status/);
    expect(urls.at(-1)).not.toMatch(/ride_status/);
    expect(got.get("j1")?.calledOff).toBe(true);
    resetSessionColumns();
    vi.unstubAllEnvs();
  });
});

describe("Can't come", () => {
  it("opens the booking app's My Bookings at this booking's ticket, in the page's language", () => {
    expect(comingCancelLink("https://experiences.micromobility.sa/my-bookings", "q1abcdef", "fr")).toBe("https://experiences.micromobility.sa/my-bookings?tk=q1abcdef&lang=fr");
    expect(comingCancelLink("https://experiences.micromobility.sa/my-bookings?lang=ar", "q1abcdef", "fr")).toBe("https://experiences.micromobility.sa/my-bookings?lang=ar&tk=q1abcdef");
    expect(comingCancelLink(null, "q1abcdef", "en")).toBeNull();
    expect(comingCancelLink("not a url", "q1abcdef", "en")).toBeNull();
    expect(comingCancelLink("https://experiences.micromobility.sa/my-bookings", "a b", "en")).toBeNull();
  });
});

describe("its words", () => {
  it("are in every language, the booking app's own in English and Arabic", () => {
    expect(Object.keys(COMING_WORDS).sort()).toEqual([...LOCALE_CODES].sort());
    for (const l of LOCALE_CODES) for (const k of ["ask", "yes", "no", "ok"] as const) expect(COMING_WORDS[l][k], `${l}.${k}`).toMatch(/\S/);
    expect(comingWords("en")).toMatchObject({ ask: "Are you still coming?", yes: "I’m coming", no: "Can’t come", ok: "Coming" });
    expect(comingWords("ar").yes).toBe("سأحضر");
    expect(comingWords("xx")).toBe(COMING_WORDS.en);
  });
});

describe("on the ticket", () => {
  const card = (rows: TicketRow[], now: number, o: { locale?: string; past?: boolean; bookings?: string | null } = {}) => renderToStaticMarkup(createElement(TicketCard, {
    locale: o.locale ?? "en", today: "2099-03-01", rows, session: jcc, name: "Circuit night", cue: null, t: serverLocalize(TICKET, o.locale ?? "en"), gather: "Gathering", start: "Start", typeName: (x: string) => x,
    links: { edit: null, manage: "https://book.example.test/?tab=bookings", place: null, bookings: o.bookings === undefined ? "https://book.example.test/my-bookings" : o.bookings }, now, past: o.past,
  }));
  it("shows I'm coming and Can't come, the latter to the booking app's ticket", () => {
    const html = card([entry(jcc)], GO - H);
    expect(html).toContain('class="tk-stc" role="group" aria-label="Are you still coming?"');
    expect(html).toMatch(/<button type="button" class="tk-btn solid">I’m coming<\/button>/);
    expect(html).toContain('<a class="tk-btn" href="https://book.example.test/my-bookings?tk=q1abcdef&amp;lang=en">Can’t come</a>');
    // without the app's address, Can't come opens My Bookings as Cancel does
    expect(card([entry(jcc)], GO - H, { bookings: null })).toContain('<a class="tk-btn" href="https://book.example.test/?tab=bookings">Can’t come</a>');
  });
  it("is one quiet chip after a yes, and nothing outside its hours or on a past card", () => {
    const html = card([entry(jcc, { coming_at: new Date(GO - 3 * H).toISOString() })], GO - H);
    expect(html).toMatch(/<span class="tk-stc-ok"><svg[^>]*>.*?<\/svg>Coming<\/span>/);
    expect(html).not.toContain("I’m coming");
    expect(card([entry(jcc)], GO - 30 * H)).not.toContain("tk-stc");
    expect(card([entry(jcc)], ST + 1)).not.toContain("tk-stc");
    expect(card([entry(jcc)], GO - H, { past: true })).not.toContain("tk-stc");
  });
  it("speaks the page's language", () => {
    const html = card([entry(jcc)], GO - H, { locale: "fr" });
    expect(html).toContain("Je viens");
    expect(html).toContain("Je ne peux pas venir");
    expect(html).toContain("lang=fr");
  });
});

describe("api/account/coming", () => {
  const TOKEN = "a1b2c3d4e5f6a7b8c9d0";
  const HEADERS = { origin: "https://micromobility.sa", cookie: `mm_acct=c1~${TOKEN}`, "content-type": "application/json" };
  const post = (body: unknown, headers: Record<string, string> = HEADERS) =>
    POST(new Request("https://micromobility.sa/api/account/coming", { method: "POST", headers, body: JSON.stringify(body) }));
  const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
  beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("says yes through booking_coming with the cookie's id and token", async () => {
    const f = vi.fn(async () => json({ ok: true, coming_at: "2099-03-01T10:00:00+00:00", n: 2 }));
    vi.stubGlobal("fetch", f);
    const res = await post({ session: "2099-03-01" });
    expect([res.status, res.headers.get("cache-control"), await res.json()]).toEqual([200, "no-store, private", { ok: true, at: "2099-03-01T10:00:00+00:00" }]);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://example.supabase.co/rest/v1/rpc/booking_coming");
    expect(JSON.parse(String(init.body))).toEqual({ p_id: "c1", p_token: TOKEN, p_session: "2099-03-01" });
  });
  it("refuses another site, a missing cookie and a body it cannot read without touching the database", async () => {
    const f = vi.fn(async () => json({ ok: true }));
    vi.stubGlobal("fetch", f);
    expect((await post({ session: "2099-03-01" }, { ...HEADERS, origin: "https://evil.example" })).status).toBe(403);
    expect(await (await post({ session: "2099-03-01" }, { origin: HEADERS.origin })).json()).toEqual({ ok: false, error: "signin" });
    for (const b of [{}, { session: "a b" }, { session: 5 }, null]) expect((await post(b)).status, JSON.stringify(b)).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });
  it("says what the database answered", async () => {
    const said = async (answer: Response) => { vi.stubGlobal("fetch", vi.fn(async () => answer)); const r = await post({ session: "2099-03-01" }); return [r.status, await r.json()]; };
    expect(await said(json({ ok: false, error: "closed" }))).toEqual([409, { ok: false, error: "closed" }]);
    expect(await said(json({ ok: false, error: "none" }))).toEqual([409, { ok: false, error: "none" }]);
    expect(await said(json({ ok: false, error: "denied" }))).toEqual([401, { ok: false, error: "signin" }]);
    expect(await said(json({ code: "PGRST202", message: "Could not find the function public.booking_coming" }, 404))).toEqual([404, { ok: false, error: "absent" }]);
    expect(await said(json({ message: "boom" }, 500))).toEqual([502, { ok: false, error: "generic" }]);
    expect(await said(json(null))).toEqual([502, { ok: false, error: "generic" }]);
  });
  it("reads its body and the database's answer safely", () => {
    expect(comingBody({ session: "2099-03-01-tw" })).toEqual({ session: "2099-03-01-tw" });
    expect(comingBody({ session: "x".repeat(65) })).toBeNull();
    expect(comingAnswer({ ok: true })).toEqual({ ok: true, at: null });
    expect(comingAnswer({ ok: false, error: "weird" })).toEqual({ ok: false, error: "generic" });
    expect(comingAnswer("nope")).toEqual({ ok: false, error: "generic" });
  });
});

// Running late (the booking app's customer features round, 2026-11-19, item 1: _ltrAt, _rlWin, _rlMin, _stcHtml; rentals
// 20261119600100): where there is a time to turn up, from two hours before it until an hour after the start.
describe("Running late", () => {
  // the Saturday ride gathers at 05:45 and starts at 06:15 in Riyadh on 7 March 2099
  const SGO = Date.parse("2099-03-07T02:45:00Z"), SST = Date.parse("2099-03-07T03:15:00Z");
  const satL = (o: Record<string, unknown> = {}) => entry(sat, { approval: "approved", late_min: null, late_at: null, ...o });
  const ws = ticketSession({ id: "2099-03-03-ws", session_date: "2099-03-03", event_kind: "community", ride_kind: "workshop", needs_approval: false, hide_queue: false, bike_slots: '{"_time":"18:00 - 20:00"}', paid_ride: true })!;

  it("counts from the gathering of a ride that gathers or the start where everyone starts together, never the circuit or the pool", () => {
    expect(lateFrom(sat)).toBe(SGO);
    expect(lateFrom(ws)).toBe(Date.parse("2099-03-03T15:00:00Z"));
    for (const k of ["event", "yoga", "defe5k"]) expect(lateFrom({ ...ws, kind: k as TicketSession["kind"] }), k).toBe(Date.parse("2099-03-03T15:00:00Z"));
    expect(lateFrom(jcc)).toBeNull();
    expect(lateFrom(swim)).toBeNull();
    expect(lateFrom({ ...sat, kind: "petromin", gathers: false })).toBeNull();
    expect(lateFrom({ ...sat, times: null })).toBeNull();
  });
  it("may be said from two hours before the time to turn up until an hour after the start", () => {
    const m = { st: SST };
    expect(lateWindow(sat, m, SGO - 2 * H - 1)).toBe(false);
    expect(lateWindow(sat, m, SGO - 2 * H)).toBe(true);
    expect(lateWindow(sat, m, SST + H - 1)).toBe(true);
    expect(lateWindow(sat, m, SST + H)).toBe(false);
    expect(lateWindow(jcc, { st: ST }, GO)).toBe(false);
  });
  it("is the party's answer when it was given for this date", () => {
    const m = { go: SGO };
    expect(lateSaid({ lateMin: 20, lateAt: new Date(SGO - 3 * H).toISOString() }, m)).toBe(20);
    expect(lateSaid({ lateMin: 20, lateAt: new Date(SGO - 3 * H - 1).toISOString() }, m)).toBe(0);
    expect(lateSaid({ lateMin: null, lateAt: null }, m)).toBe(0);
    expect(lateSaid({}, m)).toBe(0);
  });
  it("is a third answer beside I'm coming and Can't come, then alone after the start", () => {
    const rows = [satL()];
    expect(stillComing(rows, sat, SGO - 2 * H - 1)).toEqual({ ask: true, ok: false, late: 0, lateOn: false, sessionId: sat.id, bookingId: "q1abcdef" });
    expect(stillComing(rows, sat, SGO - 2 * H)).toEqual({ ask: true, ok: false, late: 0, lateOn: true, sessionId: sat.id, bookingId: "q1abcdef" });
    expect(stillComing(rows, sat, SST)).toEqual({ ask: false, ok: false, late: 0, lateOn: true, sessionId: sat.id, bookingId: "q1abcdef" });
    expect(stillComing(rows, sat, SST + H)).toBeNull();
    // said: the chip, which counts as coming (booking_late stamps coming_at)
    const said = [satL({ late_min: 20, late_at: new Date(SGO - H).toISOString(), coming_at: new Date(SGO - H).toISOString() })];
    expect(stillComing(said, sat, SGO - 30 * 60e3)).toMatchObject({ ask: true, ok: true, late: 20, lateOn: true });
    expect(stillComing(said, sat, SST + 30 * 60e3)).toMatchObject({ ask: false, late: 20, lateOn: true });
  });
  it("offers nothing on the circuit, from a read without the columns, to a rider checked in or on a ride called off", () => {
    expect(stillComing([entry(jcc, { late_min: null, late_at: null })], jcc, ST)).toBeNull();
    expect(stillComing([entry(sat, { approval: "approved" })], sat, SST)).toBeNull();
    expect(stillComing([entry(sat, { approval: "approved" })], sat, SGO - H)?.lateOn).toBe(false);
    expect(stillComing([satL(), satL({ id: "q2abcdef", status: "active" })], sat, SST)).toBeNull();
    expect(stillComing([satL()], { ...sat, calledOff: true }, SST)).toBeNull();
    expect(stillComing([satL({ status: "waitlist", queue_num: null })], sat, SST)).toBeNull();
  });
  it("reads 10, 20 or 30 minutes and when off the row, only when the read has the columns", () => {
    expect("lateMin" in ticketRow(rawRow(jcc))!).toBe(false);
    expect(ticketRow({ ...rawRow(jcc), late_min: "30", late_at: "2099-03-01T17:00:00Z" })).toMatchObject({ lateMin: 30, lateAt: "2099-03-01T17:00:00Z" });
    expect(ticketRow({ ...rawRow(jcc), late_min: 25, late_at: "2099-03-01T17:00:00Z" })).toMatchObject({ lateMin: null });
    expect(ticketRow({ ...rawRow(jcc), late_min: null, late_at: null })).toMatchObject({ lateMin: null, lateAt: null });
  });
  it("reads its body and the database's answer safely", () => {
    expect(lateBody({ session: "2099-03-07", min: 20 })).toEqual({ session: "2099-03-07", min: 20 });
    expect(lateBody({ session: "2099-03-07", min: null })).toEqual({ session: "2099-03-07", min: null });
    for (const b of [{ session: "2099-03-07", min: 15 }, { session: "2099-03-07" }, { session: "a b", min: 10 }, { session: "2099-03-07", min: "10" }, null]) expect(lateBody(b), JSON.stringify(b)).toBeNull();
    expect(lateAnswer({ ok: true, late_min: 20, late_at: "2099-03-07T02:00:00Z", coming_at: "2099-03-07T02:00:00Z", n: 2 })).toEqual({ ok: true, min: 20, at: "2099-03-07T02:00:00Z", coming: "2099-03-07T02:00:00Z" });
    expect(lateAnswer({ ok: true, late_min: null, late_at: null, coming_at: null })).toEqual({ ok: true, min: null, at: null, coming: null });
    expect(lateAnswer({ ok: false, error: "closed" })).toEqual({ ok: false, error: "closed" });
    expect(lateAnswer({ ok: false, error: "denied" })).toEqual({ ok: false, error: "signin" });
    expect(lateAnswer({ ok: false, error: "bad" })).toEqual({ ok: false, error: "generic" });
    expect(lateAnswer(null)).toEqual({ ok: false, error: "generic" });
  });
  it("has its words in every language, the booking app's own in English and Arabic, never about riding", () => {
    for (const l of LOCALE_CODES) {
      const w = COMING_WORDS[l];
      for (const k of ["late", "lateAsk", "lateMin", "lateChip", "onTime", "noMore", "noPlace", "close"] as const) expect(w[k], `${l}.${k}`).toMatch(/\S/);
      expect(w.lateMin, l).toContain("{0}");
      expect(w.lateChip, l).toContain("{0}");
    }
    expect(comingWords("en")).toMatchObject({ late: "Running late", lateAsk: "How late will you be?", lateChip: "Running late, about {0} min", onTime: "I’m on time", noMore: "Too late to change this now", noPlace: "This booking no longer holds a place" });
    expect(comingWords("ar")).toMatchObject({ late: "سأتأخر", lateChip: "سأتأخر نحو {0} دقيقة", onTime: "سأصل في الموعد" });
  });

  const cardOf = (session: TicketSession, rows: TicketRow[], now: number, locale = "en") => renderToStaticMarkup(createElement(TicketCard, {
    locale, today: session.date, rows, session, name: "Saturday Social Ride", cue: null, t: serverLocalize(TICKET, locale), gather: "Gathering", start: "Start", typeName: (x: string) => x,
    links: { edit: null, manage: "https://book.example.test/?tab=bookings", place: null, bookings: "https://book.example.test/my-bookings" }, now,
  }));
  const satCard = (rows: TicketRow[], now: number, locale = "en") => cardOf(sat, rows, now, locale);
  it("draws three buttons, then Running late alone after the start, and the chip once said, with its pop-up", () => {
    const three = satCard([satL()], SGO - H);
    expect(three).toContain('class="tk-stc rl-3" role="group" aria-label="Are you still coming?"');
    expect(three).toMatch(/I’m coming<\/button><button type="button" class="tk-btn" aria-haspopup="dialog">Running late<\/button><a class="tk-btn"/);
    expect(three).toMatch(/<dialog class="tk-dlg tk-rl-dlg" aria-labelledby="[^"]+">/);
    expect(three).toContain(">How late will you be?</h2>");
    expect(three).toContain('aria-pressed="false">10 min</button>');
    expect(three).not.toContain("I’m on time");
    const alone = satCard([satL()], SST + 10 * 60e3);
    expect(alone).toContain('class="tk-stc rl-one"');
    expect(alone).not.toContain("I’m coming");
    const chip = satCard([satL({ late_min: 20, late_at: new Date(SGO - H).toISOString(), coming_at: new Date(SGO - H).toISOString() })], SGO - 30 * 60e3);
    expect(chip).toMatch(/<button type="button" class="tk-rl-chip" aria-haspopup="dialog"><svg[^>]*>.*?<\/svg><span>Running late, about 20 min<\/span><\/button>/);
    expect(chip).toContain('aria-pressed="true">20 min</button>');
    expect(chip).toContain('class="tk-rl-ontime">I’m on time</button>');
    expect(chip).not.toContain("I’m coming");
    // a yes, then the chip of the yes beside Running late
    expect(satCard([satL({ coming_at: new Date(SGO - 3 * H).toISOString() })], SGO - H)).toMatch(/class="tk-stc rl-ok"><span class="tk-stc-ok">.*Coming<\/span><button type="button" class="tk-btn" aria-haspopup="dialog">Running late/);
  });
  it("speaks the page's language, and offers nothing on the circuit", () => {
    const ar = satCard([satL({ late_min: 10, late_at: new Date(SGO - H).toISOString() })], SGO - 30 * 60e3, "ar");
    expect(ar).toContain("سأتأخر نحو 10 دقيقة");
    expect(ar).toContain("كم ستتأخر؟");
    expect(cardOf(jcc, [entry(jcc, { late_min: null, late_at: null })], GO - H)).not.toContain("Running late");
  });
});

describe("api/account/late", () => {
  const TOKEN = "a1b2c3d4e5f6a7b8c9d0";
  const HEADERS = { origin: "https://micromobility.sa", cookie: `mm_acct=c1~${TOKEN}`, "content-type": "application/json" };
  const post = (body: unknown, headers: Record<string, string> = HEADERS) =>
    LATE(new Request("https://micromobility.sa/api/account/late", { method: "POST", headers, body: JSON.stringify(body) }));
  const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
  beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("says it through booking_late with the cookie's id and token, and takes it back with null", async () => {
    const f = vi.fn(async () => json({ ok: true, late_min: 20, late_at: "2099-03-07T02:00:00+00:00", coming_at: "2099-03-07T02:00:00+00:00", n: 2 }));
    vi.stubGlobal("fetch", f);
    const res = await post({ session: "2099-03-07", min: 20 });
    expect([res.status, res.headers.get("cache-control"), await res.json()]).toEqual([200, "no-store, private", { ok: true, min: 20, at: "2099-03-07T02:00:00+00:00", coming: "2099-03-07T02:00:00+00:00" }]);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://example.supabase.co/rest/v1/rpc/booking_late");
    expect(JSON.parse(String(init.body))).toEqual({ p_id: "c1", p_token: TOKEN, p_session: "2099-03-07", p_min: 20 });
    vi.stubGlobal("fetch", vi.fn(async () => json({ ok: true, late_min: null, late_at: null, coming_at: null })));
    await post({ session: "2099-03-07", min: null });
  });
  it("refuses another site, a missing cookie and a body it cannot read without touching the database", async () => {
    const f = vi.fn(async () => json({ ok: true }));
    vi.stubGlobal("fetch", f);
    expect((await post({ session: "2099-03-07", min: 10 }, { ...HEADERS, origin: "https://evil.example" })).status).toBe(403);
    expect(await (await post({ session: "2099-03-07", min: 10 }, { origin: HEADERS.origin })).json()).toEqual({ ok: false, error: "signin" });
    for (const b of [{}, { session: "2099-03-07", min: 5 }, { session: "a b", min: 10 }, null]) expect((await post(b)).status, JSON.stringify(b)).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });
  it("says what the database answered", async () => {
    const said = async (answer: Response) => { vi.stubGlobal("fetch", vi.fn(async () => answer)); const r = await post({ session: "2099-03-07", min: 10 }); return [r.status, await r.json()]; };
    expect(await said(json({ ok: false, error: "closed" }))).toEqual([409, { ok: false, error: "closed" }]);
    expect(await said(json({ ok: false, error: "none" }))).toEqual([409, { ok: false, error: "none" }]);
    expect(await said(json({ ok: false, error: "denied" }))).toEqual([401, { ok: false, error: "signin" }]);
    expect(await said(json({ code: "PGRST202", message: "Could not find the function public.booking_late" }, 404))).toEqual([404, { ok: false, error: "absent" }]);
    expect(await said(json({ message: "boom" }, 500))).toEqual([502, { ok: false, error: "generic" }]);
  });
});
