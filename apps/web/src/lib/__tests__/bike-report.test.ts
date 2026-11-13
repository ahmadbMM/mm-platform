import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactElement } from "react";
// The site has no @types/react-dom; this test needs one function of it (as tickets.test.ts does).
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { BRP_AFTER_MS, BRP_FAULTS, BRP_QUIET_MS, bikeReport, bikeReportAnswer, bikeReportBody, brpChipUntil, reportEnd, reportRows, rowBikes } from "../bike-report";
import { ticketRow, ticketSession, type TicketRow, type TicketSession } from "../tickets";
import { POST } from "../../app/api/account/bike-report/route";
import TicketCard from "@/components/booking/TicketCard";
import { T as TICKET } from "@/components/booking/tickets.text";
import { BIKE_REPORT_WORDS, bikeReportWords } from "@/components/booking/BikeReport.words";
import { LOCALE_CODES } from "@/i18n/locales";
import { serverLocalize } from "@/i18n/dicts";

const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;

// "Report a bike problem" on My Account's ticket (the booking app's new features F15, 2026-11-13: _brpEnd, _brpRows,
// _brpHtml, bike-report.js): checked in with a bike, until 3 hours after the session; a report leaves a quiet chip for
// ten minutes.
const M = 6e4, H = 3600e3;
const jcc = ticketSession({ id: "2099-03-01", session_date: "2099-03-01", event_kind: null, ride_kind: null, needs_approval: null, hide_queue: null, bike_slots: '{"_time":"21:00 - 23:00","_collect":"20:15"}', meet_url: null, paid_ride: null })!;
const swim = ticketSession({ id: "2099-03-02-tw", session_date: "2099-03-02", event_kind: "community", ride_kind: "swim", needs_approval: false, bike_slots: '{"_time":"18:00 - 19:30"}' })!;
const late = ticketSession({ id: "2099-03-03", session_date: "2099-03-03", bike_slots: '{"_time":"22:00 - 01:00"}' })!;
// 23:00 in Riyadh on 1 March 2099: the night's last time
const END = Date.parse("2099-03-01T20:00:00Z");
const entry = (s: TicketSession, o: Record<string, unknown> = {}) =>
  ticketRow({ id: "q1abcdef", session_id: s.id, session_date: s.date, session_day: "Sunday", status: "active", queue_num: 4, price: 75, paid: true, name: "Ann", type_preference: "Road", assigned_bike_id: "b1", bike_report_at: null, ...o })!;

describe("who may report, and until when (_brpEnd, _brpRows)", () => {
  it("reads the session's last time, an end before its start being the next day's", () => {
    expect(reportEnd(jcc)).toBe(END);
    expect(reportEnd(late)).toBe(Date.parse("2099-03-03T22:00:00Z"));
    expect(reportEnd({ ...jcc, times: null })).toBe(Date.parse("2099-03-01T08:00:00Z")); // 9 to 11 without times
    expect(reportEnd({ ...jcc, times: ["19:00", "19:00"] })).toBe(Date.parse("2099-03-01T16:00:00Z")); // one time is its own end
  });
  it("takes rows checked in or done with a bike, until 3 hours after the last time", () => {
    expect(reportRows([entry(jcc)], jcc, END + BRP_AFTER_MS - 1).map((r) => r.id)).toEqual(["q1abcdef"]);
    expect(reportRows([entry(jcc)], jcc, END + BRP_AFTER_MS)).toEqual([]);
    expect(reportRows([entry(jcc, { status: "done" })], jcc, END)).toHaveLength(1);
    expect(reportRows([entry(jcc, { status: "waiting" })], jcc, END)).toEqual([]);
    expect(reportRows([entry(jcc, { assigned_bike_id: null })], jcc, END)).toEqual([]); // no bike handed over (or their own)
    expect(reportRows([ticketRow(entryRaw())!], jcc, END)).toEqual([]); // a read without the column
    expect(reportRows([entry(jcc)], undefined, END)).toEqual([]);
    expect(reportRows([entry(swim)], swim, Date.parse("2099-03-02T16:00:00Z"))).toEqual([]); // never on a session without bikes
  });
  it("lists every bike of the account's riders on the booking", () => {
    const party = [entry(jcc, { assigned_bike_id: '["b1","b2"]' }), entry(jcc, { id: "q2abcdef", name: "Sam", assigned_bike_id: "b3" })];
    expect(rowBikes(party[0])).toEqual(["b1", "b2"]);
    expect(bikeReport(party, jcc, END)?.options).toEqual([
      { booking: "q1abcdef", bike: "b1", who: "Ann" }, { booking: "q1abcdef", bike: "b2", who: "Ann" }, { booking: "q2abcdef", bike: "b3", who: "Sam" },
    ]);
    expect(bikeReport([entry(jcc, { status: "waiting" })], jcc, END)).toBeNull();
  });
});

const entryRaw = () => ({ id: "q1abcdef", session_id: jcc.id, session_date: jcc.date, session_day: "Sunday", status: "active", queue_num: 4, price: 75, paid: true, name: "Ann", type_preference: "Road", assigned_bike_id: "b1" });

describe("the chip after a report (_brpHtml)", () => {
  it("stands ten minutes after every booking reported, then gives way to the button", () => {
    const at = END - H;
    const one = bikeReport([entry(jcc, { bike_report_at: new Date(at).toISOString() })], jcc, at + M)!;
    expect(one.reported).toEqual({ q1abcdef: at });
    expect(brpChipUntil(["q1abcdef"], one.reported, at + M)).toBe(at + BRP_QUIET_MS);
    expect(brpChipUntil(["q1abcdef"], one.reported, at + BRP_QUIET_MS)).toBeNull();
    expect(brpChipUntil(["q1abcdef"], {}, at)).toBeNull();
    expect(brpChipUntil([], {}, at)).toBeNull();
  });
  it("keeps the button while another rider of the party has not reported", () => {
    const at = END - H;
    expect(brpChipUntil(["q1abcdef", "q2abcdef", "q1abcdef"], { q1abcdef: at }, at + M)).toBeNull();
    expect(brpChipUntil(["q1abcdef", "q2abcdef"], { q1abcdef: at, q2abcdef: at + 2 * M }, at + 3 * M)).toBe(at + BRP_QUIET_MS);
    expect(brpChipUntil(["constructor"], {}, at)).toBeNull();
  });
});

describe("its words", () => {
  it("are in every language, the faults' and the booking app's own in English and Arabic", () => {
    expect(Object.keys(BIKE_REPORT_WORDS).sort()).toEqual([...LOCALE_CODES].sort());
    for (const l of LOCALE_CODES) for (const k of ["btn", "sent", "bike", "note", "send", "close", "pick", "err", ...BRP_FAULTS] as const) expect(BIKE_REPORT_WORDS[l][k], `${l}.${k}`).toMatch(/\S/);
    expect(bikeReportWords("en")).toMatchObject({ btn: "Report a bike problem", sent: "Problem reported", tyre: "Tyre", note: "Note (optional)", send: "Send report" });
    expect(bikeReportWords("ar").btn).toBe("الإبلاغ عن مشكلة في الدراجة");
    expect(bikeReportWords("xx")).toBe(BIKE_REPORT_WORDS.en);
    expect([...BRP_FAULTS]).toEqual(["brakes", "gears", "tyre", "chain", "saddle", "lights", "other"]);
  });
});

describe("on the ticket", () => {
  const card = (rows: TicketRow[], now: number, o: { locale?: string; past?: boolean; names?: Map<string, string | null>; today?: string } = {}) => renderToStaticMarkup(createElement(TicketCard, {
    locale: o.locale ?? "en", today: o.today ?? "2099-03-01", rows, session: jcc, name: "Circuit night", cue: null, t: serverLocalize(TICKET, o.locale ?? "en"), gather: "Gathering", start: "Start", typeName: (x: string) => x,
    links: { edit: null, manage: "https://book.example.test/?tab=bookings", place: null }, now, past: o.past, bikeNames: o.names ?? null,
  }));
  it("shows the button on the live ticket and on tonight's past card, with a centred pop-up of the faults and a note", () => {
    const html = card([entry(jcc)], END - H);
    expect(html).toMatch(/<div class="tk-brp"><button type="button" class="tk-btn">Report a bike problem<\/button><dialog class="tk-dlg tk-brp-dlg"/);
    for (const f of ["Brakes", "Gears", "Tyre", "Chain", "Saddle", "Lights", "Other"]) expect(html).toContain(`<span>${f}</span>`);
    expect(html).toMatch(/<textarea[^>]*maxLength="300"/);
    expect(html).toContain(">Send report</button>");
    expect(html).not.toContain(">Bike</p>"); // one bike: nothing to choose
    expect(card([entry(jcc, { status: "done" })], END + H, { past: true })).toContain("Report a bike problem");
    expect(card([entry(jcc)], END + BRP_AFTER_MS)).not.toContain("tk-brp");
  });
  it("asks which bike when the booking holds more than one, by name, else by number, with the rider when several", () => {
    const party = [entry(jcc, { assigned_bike_id: '["b1","b2"]' }), entry(jcc, { id: "q2abcdef", queue_num: 5, name: "Sam", assigned_bike_id: "b3" })];
    const html = card(party, END - H, { names: new Map([["b1", "B-12"], ["b3", "B-40"]]) });
    expect(html).toContain(">Bike</p>");
    expect(html).toContain("<bdi>B-12</bdi> · <bdi>Ann</bdi>");
    expect(html).toContain("<bdi>Bike 2</bdi> · <bdi>Ann</bdi>");
    expect(html).toContain("<bdi>B-40</bdi> · <bdi>Sam</bdi>");
  });
  it("is one quiet chip for ten minutes after a report", () => {
    const at = END - H;
    const html = card([entry(jcc, { bike_report_at: new Date(at).toISOString() })], at + 5 * M);
    expect(html).toMatch(/<span class="tk-brp-ok"><svg[^>]*>.*?<\/svg>Problem reported<\/span>/);
    expect(html).not.toContain("<dialog");
    expect(card([entry(jcc, { bike_report_at: new Date(at).toISOString() })], at + BRP_QUIET_MS)).toContain("Report a bike problem");
  });
  it("speaks the page's language", () => {
    const html = card([entry(jcc)], END - H, { locale: "ur" });
    expect(html).toContain("سائیکل کی خرابی کی اطلاع دیں");
    expect(html).toContain("<span>بریک</span>");
  });
});

describe("api/account/bike-report", () => {
  const TOKEN = "a1b2c3d4e5f6a7b8c9d0";
  const HEADERS = { origin: "https://micromobility.sa", cookie: `mm_acct=c1~${TOKEN}`, "content-type": "application/json" };
  const post = (body: unknown, headers: Record<string, string> = HEADERS) =>
    POST(new Request("https://micromobility.sa/api/account/bike-report", { method: "POST", headers, body: JSON.stringify(body) }));
  const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
  beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("sends the report through bike_report with the cookie's id and token", async () => {
    const f = vi.fn(async () => json({ ok: true, at: "2099-03-01T19:00:00+00:00" }));
    vi.stubGlobal("fetch", f);
    const res = await post({ booking: "q1abcdef", bike: "b2", fault: "tyre", note: "  Flat   at the back  " });
    expect([res.status, res.headers.get("cache-control"), await res.json()]).toEqual([200, "no-store, private", { ok: true, at: "2099-03-01T19:00:00+00:00" }]);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://example.supabase.co/rest/v1/rpc/bike_report");
    expect(JSON.parse(String(init.body))).toEqual({ p_id: "c1", p_token: TOKEN, p_booking: "q1abcdef", p_fault: "tyre", p_note: "Flat at the back", p_bike: "b2" });
    await post({ booking: "q1abcdef", fault: "other", note: "   " });
    expect(JSON.parse(String((f.mock.calls[1] as unknown as [string, RequestInit])[1].body))).toMatchObject({ p_note: null, p_bike: null });
  });
  it("refuses another site, a missing cookie and a body it cannot read without touching the database", async () => {
    const f = vi.fn(async () => json({ ok: true }));
    vi.stubGlobal("fetch", f);
    expect((await post({ booking: "q1abcdef", fault: "tyre" }, { ...HEADERS, origin: "https://evil.example" })).status).toBe(403);
    expect(await (await post({ booking: "q1abcdef", fault: "tyre" }, { origin: HEADERS.origin })).json()).toEqual({ ok: false, error: "signin" });
    for (const b of [{}, { booking: "q1abcdef" }, { booking: "q1abcdef", fault: "seat" }, { booking: "a b", fault: "tyre" }, { booking: "q1abcdef", fault: "tyre", bike: "b 1" }, { booking: "q1abcdef", fault: "tyre", note: 5 }, null])
      expect((await post(b)).status, JSON.stringify(b)).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });
  it("says what the database answered: the limits, a booking or time it does not take, or failed", async () => {
    const said = async (answer: Response) => { vi.stubGlobal("fetch", vi.fn(async () => answer)); const r = await post({ booking: "q1abcdef", fault: "brakes" }); return [r.status, await r.json()]; };
    expect(await said(json({ ok: false, error: "limit", at: "2099-03-01T19:00:00+00:00" }))).toEqual([409, { ok: false, error: "limit" }]);
    expect(await said(json({ ok: false, error: "none" }))).toEqual([409, { ok: false, error: "none" }]);
    expect(await said(json({ ok: false, error: "closed" }))).toEqual([409, { ok: false, error: "closed" }]);
    expect(await said(json({ ok: false, error: "denied" }))).toEqual([401, { ok: false, error: "signin" }]);
    expect(await said(json({ ok: false, error: "fault" }))).toEqual([502, { ok: false, error: "generic" }]);
    expect(await said(json({ code: "PGRST202", message: "Could not find the function public.bike_report" }, 404))).toEqual([404, { ok: false, error: "absent" }]);
    expect(await said(json({ message: "boom" }, 500))).toEqual([502, { ok: false, error: "generic" }]);
  });
  it("reads its body and the database's answer safely", () => {
    expect(bikeReportBody({ booking: "q1", fault: "lights", note: "x".repeat(400) })?.note).toHaveLength(300);
    expect(bikeReportBody({ booking: "q1", fault: "chain", note: null, bike: null })).toEqual({ booking: "q1", fault: "chain", note: null, bike: null });
    expect(bikeReportAnswer({ ok: true })).toEqual({ ok: true, at: null });
    expect(bikeReportAnswer(null)).toEqual({ ok: false, error: "generic" });
  });
});
