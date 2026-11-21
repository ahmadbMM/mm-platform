import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactElement } from "react";
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { RSG_ERR, rsgAnswer, rsgRow, rsgRows, rsgText } from "../ride-suggestions";
import { readSuggestions } from "../member-hub-server";
import { memberArea } from "../members";
import { POST } from "../../app/api/account/suggestions/route";
import SuggestRide from "../../components/club/SuggestRide";
import { MEMBER_HUB_WORDS, suggestWords } from "../../components/club/MemberHub.words";
import { LOCALES } from "../../i18n/locales";

// Suggest a ride on /club, as the booking app's member-hub.js has it (_rsgCardHtml, _rsgPageHtml, _rsgRowHtml, _rsgSend;
// rentals 7aa8a97b and migration 20261118210500, 2026-11-18).
const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;
const TOKEN = "a1b2c3d4e5f6a7b8c9d0";
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const ROW = { id: 7, kind: "breakfast", body: "Try the bakery at the north end", status: "planned", reply: "Next month", at: "2026-11-17T20:00:00Z", day: "2026-11-17" };

describe("reading a suggestion", () => {
  it("reads the member's own rows, an unknown kind as Something else and an unknown status as Sent", () => {
    expect(rsgRow(ROW)).toEqual({ id: 7, kind: "breakfast", body: "Try the bakery at the north end", status: "planned", reply: "Next month", day: "2026-11-17" });
    expect(rsgRow({ id: 8, kind: "spaceship", body: "x", status: "closed", reply: null, at: "2026-11-01T08:00:00Z" })).toEqual({ id: 8, kind: "other", body: "x", status: "sent", reply: "", day: "2026-11-01" });
    expect(rsgRow({ kind: "route" })).toBeNull();
    expect(rsgRows({ status: 200, data: { ok: true, rows: [ROW, null, { id: "x" }] } })?.map((r) => r.id)).toEqual([7]);
    expect(rsgRows({ status: 200, data: { ok: true, rows: [] } })).toEqual([]); // a member with none: the card, and no list
    for (const r of [{ status: 200, data: { ok: false, error: "denied" } }, { status: 404, data: null }, { status: 0, data: null }, { status: 200, data: { ok: true } }])
      expect(rsgRows(r), JSON.stringify(r)).toBeNull();
  });
  it("sends 3 to 500 characters, trimmed, and says each refusal in its own words", () => {
    expect(rsgText("  ok!  ")).toBe("ok!");
    expect(rsgText("ab")).toBeNull();
    expect(rsgText("x".repeat(501))).toBeNull();
    expect(rsgText(5)).toBeNull();
    expect(RSG_ERR).toEqual({ day: "rsgDay", open: "rsgOpenMax", invalid: "rsgShort", member: "rsgMember" });
    expect(rsgAnswer({ ok: true, row: ROW })).toMatchObject({ ok: true, row: { id: 7 } });
    expect(rsgAnswer({ ok: false, error: "day" })).toEqual({ ok: false, error: "day" });
    expect(rsgAnswer({ ok: true })).toEqual({ ok: false, error: "generic" });
  });
});

describe("readSuggestions", () => {
  beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("asks ride_suggestions_mine with the account's own id and token, and draws no card without the function", async () => {
    const f = vi.fn(async () => json({ ok: true, rows: [ROW] }));
    vi.stubGlobal("fetch", f);
    expect((await readSuggestions({ id: "c1", token: TOKEN }))?.[0].id).toBe(7);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://example.supabase.co/rest/v1/rpc/ride_suggestions_mine");
    expect(JSON.parse(String(init.body))).toEqual({ p_id: "c1", p_token: TOKEN });
    vi.stubGlobal("fetch", vi.fn(async () => json({ code: "PGRST202", message: "Could not find the function" }, 404)));
    expect(await readSuggestions({ id: "c1", token: TOKEN })).toBeNull();
  });
});

describe("api/account/suggestions", () => {
  beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  const HEADERS = { origin: "https://micromobility.sa", cookie: `mm_acct=c1~${TOKEN}`, "content-type": "application/json" };
  const post = (body: unknown, headers: Record<string, string> = HEADERS) =>
    POST(new Request("https://micromobility.sa/api/account/suggestions", { method: "POST", headers, body: JSON.stringify(body) }));
  const db = (answer: Response) => vi.fn(async () => answer.clone());
  it("sends through ride_suggest with the account's id and token, and answers the row the database kept", async () => {
    const f = db(json({ ok: true, row: { ...ROW, id: 9, kind: "route", status: "sent", reply: null } }));
    vi.stubGlobal("fetch", f);
    const r = await post({ kind: "route", body: "  Along the corniche to the north  " });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, row: { id: 9, kind: "route", status: "sent", reply: "" } });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://example.supabase.co/rest/v1/rpc/ride_suggest");
    expect(JSON.parse(String(init.body))).toEqual({ p_id: "c1", p_token: TOKEN, p_kind: "route", p_body: "Along the corniche to the north" });
  });
  it("takes only this site's pages, a signed-in account, a known kind and 3 to 500 characters, asking the database nothing otherwise", async () => {
    const f = db(json({ ok: true, row: ROW }));
    vi.stubGlobal("fetch", f);
    expect((await post({ kind: "route", body: "abc" }, { ...HEADERS, origin: "https://evil.example" })).status).toBe(403);
    expect((await post({ kind: "route", body: "abc" }, { ...HEADERS, cookie: "" })).status).toBe(401);
    for (const b of [{ kind: "ufo", body: "abc" }, { kind: "route", body: "ab" }, { kind: "route" }, null]) {
      const r = await post(b);
      expect([r.status, await r.json()], JSON.stringify(b)).toEqual([400, { ok: false, error: "invalid" }]);
    }
    expect(f).not.toHaveBeenCalled();
  });
  it("says each refusal of the database as its own", async () => {
    const at = async (answer: Response) => { vi.stubGlobal("fetch", db(answer)); const r = await post({ kind: "idea", body: "Night ride" }); return [r.status, (await r.json()).error]; };
    expect(await at(json({ ok: false, error: "day" }))).toEqual([429, "day"]);
    expect(await at(json({ ok: false, error: "open" }))).toEqual([429, "open"]);
    expect(await at(json({ ok: false, error: "member" }))).toEqual([403, "member"]);
    expect(await at(json({ ok: false, error: "invalid" }))).toEqual([400, "invalid"]);
    expect(await at(json({ ok: false, error: "denied" }))).toEqual([401, "signin"]);
    expect(await at(json({ ok: false, error: "what" }))).toEqual([502, "generic"]);
    expect(await at(json({ message: "boom" }, 500))).toEqual([502, "generic"]);
    expect(await at(json({ code: "PGRST202", message: "Could not find the function" }, 404))).toEqual([404, "absent"]);
  });
});

describe("the card", () => {
  it("is its name and its button until opened", () => {
    const html = renderToStaticMarkup(createElement(SuggestRide, { locale: "en", rows: [rsgRow(ROW)!], words: suggestWords("en") }));
    expect(html).toMatch(/<h3 id="[^"]+-h"><svg[^]*?<\/svg> Suggest a ride<\/h3>/);
    expect(html).toContain('<button type="button" class="club-int-btn club-rsg-open" aria-expanded="false">Make a suggestion</button>');
    expect(html).not.toContain("<textarea"); // the form and the list open on the tap
    expect(renderToStaticMarkup(createElement(SuggestRide, { locale: "ar", rows: [], words: suggestWords("ar") }))).toContain("اقترح جولة</h3>");
  });
  it("stands in the Club part, after the Sessions part's announcements and interests (2026-11-20)", async () => {
    const { default: MembersArea } = await import("@/components/club/MembersArea");
    const a = memberArea({ status: 200, data: { ok: true, member: true, first_name: "Sara", credits: 0, tier: 0, next: 100, rides: 1, group_rides: 1, last: [], upcoming: [], announcements: [{ text: "Hello" }] }, message: "" });
    if (!a.ok || !a.member) throw new Error("not a member");
    const props = { locale: "en", L: "en" as const, area: a, tierNames: ["Rider", "Pro", "Legend"] as [string, string, string], nameOf: () => "", bookAt: () => "", today: "2026-11-18", empty: "None" };
    const html = renderToStaticMarkup(createElement(MembersArea, { ...props, suggestions: [], interests: { saved: true, keys: ["road"], suggested: [], offered: ["road"] } }));
    expect(html.indexOf('class="club-ann"')).toBeLessThan(html.indexOf('class="club-int"'));
    expect(html.indexOf('class="club-int"')).toBeLessThan(html.indexOf('id="club-pane-club"'));
    expect(html.indexOf('id="club-pane-club"')).toBeLessThan(html.indexOf('class="club-rsg"'));
    expect(renderToStaticMarkup(createElement(MembersArea, { ...props, suggestions: null }))).not.toContain("club-rsg");
  });
  it("has its words in all 16 languages, the booking app's own where it speaks them", () => {
    for (const l of LOCALES) {
      const w = suggestWords(l.code);
      for (const [k, v] of Object.entries(w)) expect(v.trim(), `${l.code} ${k}`).not.toBe("");
      expect(Object.values(w).join(" "), l.code).not.toMatch(/\p{Extended_Pictographic}|[०-९০-৯٠-٩۰-۹]/u);
      expect(w.rsgDay, l.code).toContain("3");
      expect(w.rsgOpenMax, l.code).toContain("10");
    }
    expect(MEMBER_HUB_WORDS.ar.rsgPlanned).toBe("ضمن الخطة");
    expect(MEMBER_HUB_WORDS.es.rsgKBreakfast).toBe("Sitio para desayunar");
    expect(MEMBER_HUB_WORDS.tl.rsgClose).toBe("Isara");
  });
});
