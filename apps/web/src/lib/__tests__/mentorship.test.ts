import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactElement } from "react";
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { askYears, checkAsk, checkJoin, checkOffer, mentorCall, mentorFeedOf, mtAlert, mtErrKey } from "../mentorship";
import { readMentor } from "../member-hub-server";
import { GET, POST } from "../../app/api/account/mentor/route";
import Mentorship from "../../components/club/Mentorship";
import { communityWords, mentorWords } from "../../components/club/Community.words";

// The Mentorship programme on /club (the booking app's member-hub.js Mentorship block, da0602c2, and the anonymous mentees
// of a87dee98): a mentee is a number, a university and a field to other members; a name and a WhatsApp number cross only
// an accepted match.
const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;
const TOKEN = "a1b2c3d4e5f6a7b8c9d0";
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const FEED = {
  ok: true,
  ask: { num: 7, status: "open", university: "Effat University", field: "Architecture", city: "Jeddah", country: "SA", class_year: 2026, helps: ["cv", "ufo"], goal: "Design", gender_pref: "female",
    proposed: [{ id: "o1", links: ["uni"], helps: ["cv"], summary: "Same faculty" }], matches: [{ id: "o2", name: "Huda", wa: "+966 50 000 0003", at: "2026-11-01", links: ["field"], helps: [], summary: "", due: true }] },
  mentor: { university: "KAU", field: "Engineering", work: "Aramco", places: "Jeddah", helps: ["job"], about: "Hi" },
  profiles: [{ num: 12, university: "King Abdulaziz University", field: "Computer science", city: "Jeddah", goal: "secret", offered: null }, { num: 15, university: "Effat University", field: "Law", offered: "offered" }],
  offers: [{ id: "o3", num: 15, university: "Effat University", field: "Law", status: "offered", name: null, wa: null, due: false }, { id: "o4", num: 20, university: "UJ", field: "Med", status: "matched", name: "Omar", wa: "966500000004", due: false }],
};

describe("reading mentor_feed", () => {
  it("keeps the member's own request, their mentor profile, the open profiles (number, university and field only) and their offers", () => {
    const f = mentorFeedOf({ status: 200, data: FEED })!;
    expect(f.ask).toMatchObject({ num: 7, status: "open", country: "SA", classYear: 2026, helps: ["cv"], genderPref: "female" });
    expect(f.ask?.matches[0]).toEqual({ id: "o2", name: "Huda", wa: "966500000003", due: true, summary: "", links: ["field"] });
    expect(f.mentor).toMatchObject({ university: "KAU", helps: ["job"] });
    expect(f.profiles).toEqual([{ num: 12, university: "King Abdulaziz University", field: "Computer science", offered: null }, { num: 15, university: "Effat University", field: "Law", offered: "offered" }]);
    expect(JSON.stringify(f.profiles)).not.toContain("secret"); // anything more the database ever sent stays out
    expect(f.offers.map((o) => [o.num, o.status, o.name])).toEqual([[15, "offered", ""], [20, "matched", "Omar"]]);
    expect(mtAlert(f)).toEqual({ k: "offered" });
    expect(mtAlert({ ...f, ask: { ...f.ask!, proposed: [] } })).toEqual({ k: "check", name: "Huda" });
  });
  it("draws no card for a refusal or a database without the programme", async () => {
    for (const r of [{ status: 200, data: { ok: false, error: "member" } }, { status: 404, data: null }, { status: 0, data: null }]) expect(mentorFeedOf(r)).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    const f = vi.fn(async () => json(FEED));
    vi.stubGlobal("fetch", f);
    expect((await readMentor({ id: "c1", token: TOKEN }))?.profiles).toHaveLength(2);
    expect(JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toEqual({ p_id: "c1", p_token: TOKEN });
    vi.unstubAllEnvs(); vi.unstubAllGlobals();
  });
});

describe("the forms", () => {
  it("check what the app checks before sending", () => {
    expect(checkAsk({ university: "E", field: "", city: " ", country: "", classYear: 2026, helps: [], goal: "", genderPref: "any", ok: false }))
      .toEqual({ uni: "mtFill", field: "mtFill", city: "mtFill", country: "mtFill", want: "mtPickOne", ok: "mtTick" });
    expect(checkJoin({ university: "KAU", field: "Eng", work: "", places: "", helps: ["cv"], about: "x", ok: true })).toEqual({});
    expect(checkOffer({ num: 1, links: [], helps: ["cv"], note: "" })).toEqual({ links: "mtPickOne", note: "mtFill" });
    expect(askYears(2026, 0)).toEqual([2025, 2026, 2027, 2028, 2029]);
    expect(askYears(2026, 2022)).toEqual([2022, 2025, 2026, 2027, 2028, 2029]); // a waiting request's year is kept
  });
  it("send each act to its function, cut as the database takes it, and refuse anything else", () => {
    expect(mentorCall({ act: "ask", university: " Effat ", field: "Arch", city: "Jeddah", country: "SA", classYear: 2026, helps: ["cv", "cv", "ufo"], goal: "", genderPref: "x", ok: true }))
      .toEqual({ fn: "mentor_ask", args: { p_university: "Effat", p_field: "Arch", p_city: "Jeddah", p_country: "SA", p_class_year: 2026, p_helps: ["cv"], p_goal: null, p_gender_pref: "any", p_ok: true } });
    expect(mentorCall({ act: "ask", country: "sa" })?.args.p_country).toBe("");
    expect(mentorCall({ act: "offer", num: 12, links: ["uni", "city"], helps: ["job"], note: "n" })).toEqual({ fn: "mentor_offer", args: { p_num: 12, p_links: ["uni"], p_helps: ["job"], p_note: "n" } });
    expect(mentorCall({ act: "join", university: "KAU", field: "E", helps: [], about: "a", ok: "yes" })?.args.p_ok).toBe(false);
    expect(mentorCall({ act: "leave", offer: null })).toEqual({ fn: "mentor_leave", args: { p_offer: null } });
    expect(mentorCall({ act: "check", offer: "o2", answer: "help" })).toEqual({ fn: "mentor_check", args: { p_offer: "o2", p_answer: "help" } });
    for (const b of [{ act: "drop" }, { act: "check", offer: "o2", answer: "maybe" }, { act: "answer", offer: "o1" }, { act: "offer", num: 0 }, { act: "leave", offer: "a b" }]) expect(mentorCall(b), JSON.stringify(b)).toBeNull();
    expect([mtErrKey("gone"), mtErrKey("own"), mtErrKey("exists"), mtErrKey("limit"), mtErrKey("consent")]).toEqual(["mtGone", "mtGone", "mtExists", "mtLimit", "err"]);
  });
});

describe("api/account/mentor", () => {
  beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  const HEADERS = { origin: "https://micromobility.sa", cookie: `mm_acct=c1~${TOKEN}`, "content-type": "application/json" };
  const post = (body: unknown, headers: Record<string, string> = HEADERS) => POST(new Request("https://micromobility.sa/api/account/mentor", { method: "POST", headers, body: JSON.stringify(body) }));
  it("writes with the account's own id and token, then answers the programme as the database now holds it", async () => {
    const f = vi.fn(async (url: string) => (url.endsWith("/mentor_feed") ? json(FEED) : json({ ok: true })));
    vi.stubGlobal("fetch", f);
    const r = await post({ act: "offer", num: 12, links: ["uni"], helps: ["cv"], note: "Same faculty" });
    expect(r.status).toBe(200);
    expect((await r.json()).feed.profiles).toHaveLength(2);
    const calls = f.mock.calls as unknown as [string, RequestInit][];
    expect(calls.map(([u]) => u.split("/").pop())).toEqual(["mentor_offer", "mentor_feed"]);
    expect(JSON.parse(String(calls[0][1].body))).toEqual({ p_id: "c1", p_token: TOKEN, p_num: 12, p_links: ["uni"], p_helps: ["cv"], p_note: "Same faculty" });
    const g = await GET(new Request("https://micromobility.sa/api/account/mentor", { headers: { cookie: `mm_acct=c1~${TOKEN}` } }));
    expect((await g.json()).ok).toBe(true);
  });
  it("takes only this site's pages and a signed-in account, and says each refusal in the database's word", async () => {
    const f = vi.fn(async () => json({ ok: true }));
    vi.stubGlobal("fetch", f);
    expect((await post({ act: "quit" }, { ...HEADERS, origin: "https://evil.example" })).status).toBe(403);
    expect((await post({ act: "quit" }, { ...HEADERS, cookie: "" })).status).toBe(401);
    expect((await post({ act: "drop" })).status).toBe(400);
    expect(f).not.toHaveBeenCalled();
    const at = async (a: Response) => { vi.stubGlobal("fetch", vi.fn(async () => a.clone())); const r = await post({ act: "quit" }); return [r.status, (await r.json()).error]; };
    expect(await at(json({ ok: false, error: "gone" }))).toEqual([409, "gone"]);
    expect(await at(json({ ok: false, error: "limit" }))).toEqual([409, "limit"]);
    expect(await at(json({ ok: false, error: "denied" }))).toEqual([401, "signin"]);
    expect(await at(json({ code: "PGRST202", message: "Could not find the function" }, 404))).toEqual([404, "absent"]);
    expect(await at(json({ message: "boom" }, 503))).toEqual([502, "generic"]);
  });
});

describe("the card", () => {
  const w = { ...mentorWords(communityWords("en")), cancel: "Cancel" };
  it("says what waits first, and offers the ways in the member does not have yet", () => {
    const f = mentorFeedOf({ status: 200, data: FEED })!;
    const html = renderToStaticMarkup(createElement(Mentorship, { feed: f, locale: "en", w }));
    expect(html).toContain("Mentorship</h3>");
    expect(html).toContain("Help a member starting university");
    expect(html).toContain("Students looking for a mentor: 2");
    expect(html).toContain("A member offered to help you");
    expect(html).not.toContain("Register as a mentor"); // a mentor already
    expect(html).not.toContain("Register as a mentee"); // a request already
    expect(html).toContain('class="club-hub-btn club-hub-primary">See the students</button>');
    const none = renderToStaticMarkup(createElement(Mentorship, { feed: { ask: null, mentor: null, profiles: [], offers: [] }, locale: "en", w }));
    expect(none).toContain("Register as a mentor");
    expect(none).toContain("Register as a mentee");
    expect(none).not.toContain("Students looking for a mentor:");
  });
});
