import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactElement } from "react";
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { myRecords, FLEET_TYPES } from "../my-records";
import { loadBikeTypes, loadRecordSessions } from "../ride-record-data";
import type { RecordSession } from "../ride-record";
import { ticketRow, type TicketRow } from "../tickets";
import MyRecords from "../../components/account/MyRecords";
import { RECORDS_WORDS, recordsWords } from "../../components/account/Records.words";
import { LOCALES } from "../../i18n/locales";

// My records on Stats, as the booking app's _recHtml counts them (rentals d971a564, tests/my-records.spec.ts there).
const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;
let n = 0;
const row = (session_id: string, status: string, o: Record<string, unknown> = {}): TicketRow =>
  ticketRow({ id: `q${++n}`, session_id, session_date: session_id.slice(0, 10), status, queue_num: 3, type_preference: "Road", ...o }) as TicketRow;
const sat = (id: string, route: string | null = null): [string, RecordSession] => [id, { kind: "saturday", freeRide: true, route }];
const jcc = (id: string, route: string | null = null): [string, RecordSession] => [id, { kind: "jcc", freeRide: false, route }];
const swim = (id: string): [string, RecordSession] => [id, { kind: "swim", freeRide: false, route: null }];

describe("myRecords", () => {
  it("needs two finished sessions, checked in or done, one a session", () => {
    const S = new Map([sat("2026-11-07"), sat("2026-11-14")]);
    expect(myRecords([row("2026-11-07", "done")], S)).toBeNull();
    expect(myRecords([row("2026-11-07", "done"), row("2026-11-07", "done", { queue_num: 4 })], S)).toBeNull(); // a party is one session
    expect(myRecords([row("2026-11-07", "done"), row("2026-11-14", "waiting"), row("2026-11-21", "waitlist")], S)).toBeNull();
    expect(myRecords([row("2026-11-07", "done"), row("2026-11-14", "active")], S)).not.toBeNull();
  });
  it("counts the longest run of weeks with a Saturday ride, from 2, with the month it ended, the first of equal runs", () => {
    const S = new Map([sat("2026-09-05"), sat("2026-09-12"), sat("2026-09-19"), sat("2026-10-17"), sat("2026-10-24"), sat("2026-10-31"), sat("2026-11-14")]);
    const R = ["2026-09-05", "2026-09-12", "2026-09-19", "2026-10-17", "2026-10-24", "2026-10-31", "2026-11-14"].map((d) => row(d, "done"));
    expect(myRecords(R, S)?.sat).toEqual({ n: 3, end: "2026-09-19" }); // two runs of 3: the first
    expect(myRecords([...R, row("2026-11-07", "done")], new Map([...S, sat("2026-11-07")]))?.sat).toEqual({ n: 5, end: "2026-11-14" });
    // a circuit night is no Saturday ride, and one Saturday is no run
    expect(myRecords([row("2026-11-07", "done"), row("2026-11-11", "done")], new Map([sat("2026-11-07"), jcc("2026-11-11")]))?.sat).toBeNull();
  });
  it("finds the best month of any kind, from 2, the earliest of a tie", () => {
    const S = new Map([sat("2026-10-03"), swim("2026-10-05-p"), sat("2026-11-07"), jcc("2026-11-11")]);
    const R = [row("2026-10-03", "done"), row("2026-10-05-p", "done", { type_preference: "None" }), row("2026-11-07", "done"), row("2026-11-11", "active")];
    expect(myRecords(R, S)?.month).toEqual({ n: 2, ym: "2026-10" });
    expect(myRecords([row("2026-10-03", "done"), row("2026-11-07", "done")], S)?.month).toBeNull();
  });
  it("counts the fleet's types ridden on bike sessions, a booking for no type by the bike handed over", () => {
    const S = new Map([jcc("2026-11-01"), jcc("2026-11-02"), jcc("2026-11-03"), jcc("2026-11-04"), jcc("2026-11-05"), swim("2026-11-06-p")]);
    const R = [
      row("2026-11-01", "done", { type_preference: "Road" }), row("2026-11-02", "done", { type_preference: "Hybrid" }),
      row("2026-11-03", "done", { type_preference: "Any", assigned_bike_id: "b-9" }), row("2026-11-04", "done", { type_preference: "Own" }),
      row("2026-11-05", "done", { type_preference: "Gravel" }), row("2026-11-06-p", "done", { type_preference: "Mountain" }),
    ];
    expect(myRecords(R, S)?.types).toBe(2); // Road, Hybrid; Own and Gravel are not the fleet's, the pool no bike session
    expect(myRecords(R, S, (id) => (id === "b-9" ? "Road Carbon" : null))?.types).toBe(3);
    expect(FLEET_TYPES).toHaveLength(5);
  });
  it("counts the routes of finished sessions, from 1, and draws no card with no tile", () => {
    const S = new Map([jcc("2026-11-01", "corniche-loop"), jcc("2026-11-02", "corniche-loop"), jcc("2026-11-03", "obhur-run")]);
    expect(myRecords(["2026-11-01", "2026-11-02", "2026-11-03"].map((d) => row(d, "done")), S)?.routes).toBe(2);
    expect(myRecords([row("2026-10-01", "done", { type_preference: "Own" }), row("2026-11-02", "done", { type_preference: "Own" })], new Map([jcc("2026-10-01"), jcc("2026-11-02")]))).toBeNull();
  });
});

describe("what the record reads for it", () => {
  const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
  beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
  afterEach(() => vi.unstubAllEnvs());
  it("reads each session's route, and a database without the column without it", async () => {
    const rows = [{ id: "2026-11-01", ride_kind: null, event_kind: "jcc", bike_slots: null, route_slug: "corniche-loop" }];
    const f = vi.fn(async () => json(rows));
    expect((await loadRecordSessions(["2026-11-01"], null, f as unknown as typeof fetch)).get("2026-11-01")?.route).toBe("corniche-loop");
    expect(String((f.mock.calls[0] as unknown as [string])[0])).toContain("route_slug");
    const old = vi.fn(async (url: string) => (url.includes("route_slug") ? json({ code: "42703", message: "column sessions.route_slug does not exist" }, 400) : json([{ id: "2026-11-01", event_kind: "jcc" }])));
    const m = await loadRecordSessions(["2026-11-01"], null, old as unknown as typeof fetch);
    expect(m.get("2026-11-01")).toMatchObject({ kind: "jcc" });
    expect(m.get("2026-11-01")?.route).toBeUndefined();
  });
  it("reads the bikes' types in one go, and leaves a failed read unknown", async () => {
    const f = vi.fn(async () => json([{ id: "b-9", type: "Road Carbon" }, { id: "b-1" }]));
    const t = await loadBikeTypes(["b-9", "b-1", "b-9", "bad id"], f as unknown as typeof fetch);
    expect([...t]).toEqual([["b-9", "Road Carbon"]]);
    expect(String((f.mock.calls[0] as unknown as [string])[0])).toBe("https://example.supabase.co/rest/v1/bikes?select=id,type&id=in.(b-9,b-1)");
    expect((await loadBikeTypes(["b-9"], vi.fn(async () => json({}, 500)) as unknown as typeof fetch)).size).toBe(0);
    const none = vi.fn();
    expect((await loadBikeTypes([], none as unknown as typeof fetch)).size).toBe(0);
    expect(none).not.toHaveBeenCalled();
  });
});

describe("the card", () => {
  const recs = { sat: { n: 3, end: "2026-09-19" }, month: { n: 4, ym: "2026-10" }, types: 3, routes: 2 };
  it("draws four tiles: a number, its name, and the month where it has one", () => {
    const html = renderToStaticMarkup(createElement(MyRecords, { locale: "en", recs }));
    expect(html).toContain('<p class="myr-h">My records</p>');
    expect(html).toContain('<div class="rec-t" data-rec="sat"><b class="rec-n"><bdi>3</bdi></b><span class="rec-l">Saturdays in a row</span><span class="rec-v"><bdi>September 2026</bdi></span></div>');
    expect(html).toContain('<div class="rec-t" data-rec="month"><b class="rec-n"><bdi>4</bdi></b><span class="rec-l">Sessions in your best month</span><span class="rec-v"><bdi>October 2026</bdi></span></div>');
    expect(html).toContain('<div class="rec-t" data-rec="types"><b class="rec-n"><bdi>3 of 5</bdi></b><span class="rec-l">Bike types tried</span></div>');
    expect(html).toContain('<div class="rec-t" data-rec="routes"><b class="rec-n"><bdi>2</bdi></b><span class="rec-l">Routes ridden</span></div>');
    const two = renderToStaticMarkup(createElement(MyRecords, { locale: "en", recs: { sat: null, month: null, types: 1, routes: 0 } }));
    expect(two.match(/class="rec-t"/g)).toHaveLength(1);
    expect(renderToStaticMarkup(createElement(MyRecords, { locale: "en", recs: { sat: null, month: null, types: 0, routes: 0 } }))).toBe("");
  });
  it("speaks Arabic and Urdu, the count of types where their grammar puts it", () => {
    expect(renderToStaticMarkup(createElement(MyRecords, { locale: "ar", recs }))).toContain("<bdi>3 من 5</bdi>");
    expect(renderToStaticMarkup(createElement(MyRecords, { locale: "ur", recs }))).toContain("<bdi>5 میں سے 3</bdi>");
  });
  it("has its words in all 16 languages, the booking app's own where it speaks them", () => {
    const keys = Object.keys(RECORDS_WORDS.en).sort();
    for (const l of LOCALES) {
      const w = RECORDS_WORDS[l.code];
      expect(Object.keys(w).sort(), l.code).toEqual(keys);
      for (const k of keys) expect(w[k as keyof typeof w].trim(), `${l.code} ${k}`).not.toBe("");
      expect(w.of.includes("{0}") && w.of.includes("{1}"), l.code).toBe(true);
      expect(Object.values(w).join(" "), l.code).not.toMatch(/\p{Extended_Pictographic}|[०-९০-৯٠-٩۰-۹]/u);
    }
    expect(RECORDS_WORDS.ar.title).toBe("أرقامي القياسية");
    expect(RECORDS_WORDS.fr.sat).toBe("Samedis d’affilée");
    expect(RECORDS_WORDS.bn.of).toBe("{1}টির মধ্যে {0}টি");
    expect(recordsWords("xx")).toBe(RECORDS_WORDS.en);
  });
});
