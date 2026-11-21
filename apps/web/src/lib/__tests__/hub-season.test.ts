import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactElement } from "react";
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { ramadanOf, seasonKind } from "../hub-season";
import { readSeason } from "../member-hub-server";
import { memberArea } from "../members";
import { badgeList, type BadgeData } from "../ride-record";
import { GLYPH } from "../../components/account/badge-glyphs";
import Medal from "../../components/account/Medal";
import SeasonCard from "../../components/club/SeasonCard";
import { MEMBER_HUB_WORDS } from "../../components/club/MemberHub.words";
import { LOCALES } from "../../i18n/locales";

// The Ramadan season, as the booking app has it (member-hub.js _ssnRam, _ssnKind, _ssnHtml, _ssnArt and BDG_GLYPH.crescent;
// rentals a715c478 and migration 20261118210900, 2026-11-18): the badges' crescent, and /club's card and night-blue look.
const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;
const TOKEN = "a1b2c3d4e5f6a7b8c9d0";
const SEASON = { ok: true, today: "2027-01-10", ramadan: { year: 2027, starts_on: "2027-02-08", ends_on: "2027-03-09", eid_on: "2027-03-10" } };

describe("the dates", () => {
  it("reads hub_season's Ramadan, and nothing from a refusal, a missing function or dates that do not hold", () => {
    expect(ramadanOf({ status: 200, data: SEASON })).toEqual({ from: "2027-02-08", to: "2027-03-09", eid: "2027-03-10" });
    expect(ramadanOf({ status: 200, data: { ok: true, ramadan: null } })).toBeNull();
    expect(ramadanOf({ status: 200, data: { ok: false, error: "member" } })).toBeNull();
    expect(ramadanOf({ status: 404, data: null })).toBeNull();
    expect(ramadanOf({ status: 200, data: { ok: true, ramadan: { starts_on: "2027-03-09", ends_on: "2027-02-08", eid_on: "2027-03-10" } } })).toBeNull();
    expect(ramadanOf({ status: 200, data: { ok: true, ramadan: { starts_on: "2027-02-08", ends_on: "2027-03-09", eid_on: "2027-03-09" } } })).toBeNull();
  });
  it("wears Ramadan from its first day to its last, Eid on its first three days, and nothing else", () => {
    const r = ramadanOf({ status: 200, data: SEASON });
    expect(["2027-02-07", "2027-02-08", "2027-03-09", "2027-03-10", "2027-03-12", "2027-03-13"].map((d) => seasonKind(r, d)))
      .toEqual(["", "ramadan", "ramadan", "eid", "eid", ""]);
    expect(seasonKind(null, "2027-02-10")).toBe("");
  });
});

describe("readSeason", () => {
  beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("asks hub_season with the account's own id and token, and says nothing without the function", async () => {
    const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
    const f = vi.fn(async () => json(SEASON));
    vi.stubGlobal("fetch", f);
    expect(await readSeason({ id: "c1", token: TOKEN })).toEqual({ from: "2027-02-08", to: "2027-03-09", eid: "2027-03-10" });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://example.supabase.co/rest/v1/rpc/hub_season");
    expect(JSON.parse(String(init.body))).toEqual({ p_id: "c1", p_token: TOKEN });
    vi.stubGlobal("fetch", vi.fn(async () => json({ code: "PGRST202", message: "Could not find the function" }, 404)));
    expect(await readSeason({ id: "c1", token: TOKEN })).toBeNull();
  });
});

describe("the card and the look", () => {
  it("says Ramadan Kareem or Eid Mubarak beside the drawn crescent and two lanterns, never an emoji", () => {
    const ram = renderToStaticMarkup(createElement(SeasonCard, { locale: "en", kind: "ramadan" }));
    expect(ram).toMatch(/^<div class="club-ssn club-ssn-ramadan"><strong class="club-ssn-t">Ramadan Kareem<\/strong><svg class="club-ssn-art" viewBox="0 0 124 56" aria-hidden="true"/);
    expect(ram).toContain('<path class="hs-moon" d="M15.6 3.2A9.3 9.3 0 1 0 15.6 20.8 8.83 8.83 0 1 1 15.6 3.2Z"></path>');
    expect(ram.match(/class="hs-glass"/g)).toHaveLength(2);
    expect(renderToStaticMarkup(createElement(SeasonCard, { locale: "en", kind: "eid" }))).toContain(">Eid Mubarak</strong>");
    expect(renderToStaticMarkup(createElement(SeasonCard, { locale: "ar", kind: "ramadan" }))).toContain(">رمضان كريم</strong>");
    expect(ram).not.toMatch(/\p{Extended_Pictographic}/u);
  });
  it("leads the members' area, which takes the season's look, and is gone outside it", async () => {
    const { default: MembersArea } = await import("@/components/club/MembersArea");
    const a = memberArea({ status: 200, data: { ok: true, member: true, first_name: "Sara", credits: 0, tier: 0, next: 100, rides: 1, group_rides: 1, last: [], upcoming: [] }, message: "" });
    if (!a.ok || !a.member) throw new Error("not a member");
    const props = { locale: "en", L: "en" as const, area: a, tierNames: ["Rider", "Pro", "Legend"] as [string, string, string], nameOf: () => "", bookAt: () => "", today: "2027-02-10", empty: "None" };
    const on = renderToStaticMarkup(createElement(MembersArea, { ...props, season: "ramadan" }));
    expect(on).toContain('<div class="club-mine club-members club-ssn-on"><h2>Your membership</h2>');
    expect(on).toContain('<div class="club-pane" id="club-pane-sess" data-part="sess"><div class="club-ssn club-ssn-ramadan">'); // it leads the Sessions part (2026-11-20)
    const off = renderToStaticMarkup(createElement(MembersArea, { ...props, season: "" }));
    expect(off).toContain('<div class="club-mine club-members"><h2>');
    expect(off).not.toContain("club-ssn");
  });
  it("has its words in all 16 languages, the booking app's own where it speaks them", () => {
    for (const l of LOCALES) for (const k of ["ssnRam", "ssnEid"] as const) expect(MEMBER_HUB_WORDS[l.code][k].trim(), `${l.code} ${k}`).not.toBe("");
    expect(MEMBER_HUB_WORDS.fr.ssnEid).toBe("Aïd Moubarak");
    expect(MEMBER_HUB_WORDS.bn.ssnRam).toBe("রমজান কারিম");
  });
});

describe("the season's badges", () => {
  const empty: BadgeData = { catalog: [], weeks: null, seasons: [], mine: [] };
  const RAM = { slug: "ramadan_2027", icon: "crescent", color: "blue", system: true, auto: true, held_only: true, name: "Ramadan 2027", name_ar: "رمضان 2027" };
  const EID = { slug: "eid_2027", icon: "lantern", color: "gold", system: true, auto: true, held_only: true, name: "Eid 2027", name_ar: "عيد 2027" };
  it("draw the crescent, with its star in the hollow, and the lantern", () => {
    expect(GLYPH.crescent).toContain('d="M15.6 3.2A9.3 9.3 0 1 0 15.6 20.8 8.83 8.83 0 1 1 15.6 3.2Z"');
    expect(GLYPH.crescent).toContain('class="o"');
    expect(renderToStaticMarkup(createElement(Medal, { icon: "crescent", color: "blue" }))).toContain("M15.6 3.2A9.3 9.3");
    expect(GLYPH.lantern).toBeTruthy();
  });
  it("show to those who hold them, drawn as the catalogue says, and to nobody else", () => {
    const held = badgeList([], new Map(), { ...empty, catalog: [RAM, EID], mine: [{ ...RAM, at: "2027-02-20" }] }, "2027-02-21", null);
    expect(held.find((x) => x.slug === "ramadan_2027")).toMatchObject({ on: true, icon: "crescent", color: "blue" });
    expect(held.find((x) => x.slug === "eid_2027")).toBeUndefined();
    expect(badgeList([], new Map(), { ...empty, catalog: [RAM, EID] }, "2027-02-21", null).some((x) => x.slug === "ramadan_2027" || x.slug === "eid_2027")).toBe(false);
  });
});
