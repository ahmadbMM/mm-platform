import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactElement } from "react";
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { clubLine, hubDay, hubFeedOf, inviteCodeOf, inviteText, lastAndAhead, pickShown, recapLeads, tipOf, volunteerHref, yearFrom } from "../hub-feed";
import { readFirstFive, readHubFeed, readInviteCode } from "../member-hub-server";
import { firstFiveTab } from "../first-five";
import { memberArea } from "../members";
import { POST as LEVEL } from "../../app/api/account/hub-level/route";
import { GET as PHOTO } from "../../app/api/account/hub-photo/route";
import { COMMUNITY_WORDS, communityWords, mentorWords } from "../../components/club/Community.words";
import { ClubGoalCard, ReportCard, SeasonGoalCard, TipCard, VolunteerCallCard } from "../../components/club/HubCards";
import { LOCALES } from "../../i18n/locales";

// The booking app's Community tab cards on /club (member-hub.js, 2026-11-11 to 2026-11-18): its one read, hub_feed, and
// what the members' area draws from it; never its club numbers or any session's riders (the owner, 2026-11-13).
const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;
const TOKEN = "a1b2c3d4e5f6a7b8c9d0";
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const FEED = {
  ok: true, today: "2026-11-19",
  me: { kind: "level", levels: [2, 4, 6], target: 4, chosen: false, n: 1, ends_on: "2026-11-30", sats: 4 },
  club: { scope: "saturday", target: 40, n: 44, mine: 3, from: "2026-11-01", ends_on: "2026-11-30", next: { date: "2026-11-21", target: 12 } },
  goals: [{ id: "goal_ramadan_2027", name: "Ramadan challenge", name_ar: "تحدي رمضان", target: 4, n: 4, ends_on: "2026-12-09", badge: { slug: "ramadan_2027", icon: "crescent", color: "gold" } }],
  numbers: { last: "2026-11-15", last_riders: 873, last_rides: 891, month: 3107, all: 54021, since: "2025-01-04" },
  post: { id: "post-1", line: "A calm sea.", line_ar: "بحر هادئ.", riders: 871, rides: 889, first_rides: 113, leads: 117, volunteers: 119, prev_riders: 802, mine: 2, date: "2026-11-15", img: true },
  announce: [{ text: { en: "Hello" } }], volunteer: "s-vol", birthday: true, awarded: ["x"],
  year: { year: 2026, full: false, sessions: 14, saturdays: 9, first: "2026-03-07", kinds: ["saturday", "rental", "swim", "rental"], busiest: "2026-10", sats_held: 30, club: 24019, club_first: "2026-02-07", badges: 3 },
  going: { "s-sat": { n: 457, first: 129 } },
};

describe("reading hub_feed", () => {
  it("keeps the member's own challenge, the season challenges, the club goal, the report, the call and the year", () => {
    const f = hubFeedOf({ status: 200, data: FEED })!;
    expect(f.today).toBe("2026-11-19");
    expect(f.me).toEqual({ kind: "level", levels: [2, 4, 6], target: 4, chosen: false, n: 1, endsOn: "2026-11-30" });
    expect(f.goals).toEqual([{ id: "goal_ramadan_2027", name: "Ramadan challenge", nameAr: "تحدي رمضان", target: 4, n: 4, endsOn: "2026-12-09", badge: { icon: "crescent", color: "gold" } }]);
    expect(f.club).toEqual({ name: "", nameAr: "", target: 40, n: 44, mine: 3, endsOn: "2026-11-30", next: { date: "2026-11-21", target: 12 } });
    expect(f.post).toEqual({ id: "post-1", date: "2026-11-15", line: "A calm sea.", lineAr: "بحر هادئ.", img: true, mine: 2 });
    expect(f.volunteer).toBe("s-vol");
    expect(f.year).toMatchObject({ year: 2026, sessions: 14, saturdays: 9, satsHeld: 30, kinds: ["saturday", "jcc", "swim"], busiest: "2026-10", clubFirst: "2026-02-07" });
  });
  it("never carries the club's numbers, the report's counts, the year's club total or any session's riders", () => {
    const s = JSON.stringify(hubFeedOf({ status: 200, data: FEED }));
    for (const n of ["873", "891", "3107", "54021", "24019", "457", "871", "889", "113", "117", "119", "129", "802", "numbers", "going", "riders", "announce", "awarded"]) expect(s, n).not.toContain(n);
  });
  it("draws nothing for a refusal, a database without it or no answer", () => {
    for (const r of [{ status: 200, data: { ok: false, error: "member" } }, { status: 200, data: { ok: false, error: "denied" } }, { status: 404, data: null }, { status: 0, data: null }, { status: 200, data: null }])
      expect(hubFeedOf(r), JSON.stringify(r)).toBeNull();
    // a member with none of them: no card
    expect(hubFeedOf({ status: 200, data: { ok: true, today: "2026-11-19", me: { kind: null }, goals: [], club: null, post: null, volunteer: null, year: null } }))
      .toEqual({ today: "2026-11-19", me: null, goals: [], club: null, post: null, volunteer: null, year: null });
  });
  it("asks hub_feed with the account's own id and token and no entry point, so the app's open count is untouched", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    const f = vi.fn(async () => json(FEED));
    vi.stubGlobal("fetch", f);
    expect((await readHubFeed({ id: "c1", token: TOKEN }))?.me?.kind).toBe("level");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://example.supabase.co/rest/v1/rpc/hub_feed");
    expect(JSON.parse(String(init.body))).toEqual({ p_id: "c1", p_token: TOKEN });
    vi.stubGlobal("fetch", vi.fn(async () => json({ ok: true, code: "INV7Q2" })));
    expect(await readInviteCode({ id: "c1", token: TOKEN })).toBe("INV7Q2");
    vi.unstubAllEnvs(); vi.unstubAllGlobals();
  });
});

describe("the cards' rules, as the app has them", () => {
  it("offers the level pick until it is picked or done", () => {
    const me = hubFeedOf({ status: 200, data: FEED })!.me!;
    expect(pickShown(me)).toBe(true);
    expect(pickShown({ ...me, chosen: true })).toBe(false);
    expect(pickShown({ ...me, n: 4 })).toBe(false);
    expect(pickShown({ ...me, kind: "first" })).toBe(false);
  });
  it("says so far under two thirds, then what is left, then reached", () => {
    const g = { name: "", nameAr: "", target: 30, n: 10, mine: 0, endsOn: "2026-11-30", next: null };
    expect(clubLine(g)).toEqual({ k: "soFar", n: 10 });
    expect(clubLine({ ...g, n: 20 })).toEqual({ k: "toGo", n: 10 });
    expect(clubLine({ ...g, n: 30 })).toEqual({ k: "hit" });
  });
  it("turns the tip of the week each week, one of twelve", () => {
    expect(tipOf("2026-11-19")).toBe(Math.floor(Date.parse("2026-11-19T00:00:00Z") / 6048e5) % 12);
    expect(new Set(Array.from({ length: 12 }, (_, i) => tipOf(new Date(Date.UTC(2026, 0, 1 + 7 * i)).toISOString().slice(0, 10)))).size).toBe(12);
  });
  it("leads with the report of the member's own ride on its day and the next, only with nothing booked ahead", () => {
    const post = { id: "p", date: "2026-11-15", line: "", lineAr: "", img: false, mine: null };
    const at = (d: string) => Date.parse(`${d}T12:00:00+03:00`);
    expect(recapLeads(post, "2026-11-15", false, at("2026-11-15"))).toBe(true);
    expect(recapLeads(post, "2026-11-15", false, at("2026-11-16"))).toBe(true);
    expect(recapLeads(post, "2026-11-15", false, at("2026-11-17"))).toBe(false);
    expect(recapLeads(post, "2026-11-15", true, at("2026-11-15"))).toBe(false);
    expect(recapLeads(post, "2026-11-08", false, at("2026-11-15"))).toBe(false);
    expect(recapLeads(null, "2026-11-15", false, at("2026-11-15"))).toBe(false);
    const rows = [{ status: "done", session_date: "2026-11-15" }, { status: "done", session_date: "2026-10-01" }, { status: "cancelled", session_date: "2026-11-20" }];
    expect(lastAndAhead(rows, "2026-11-16")).toEqual({ last: "2026-11-15", ahead: false });
    expect(lastAndAhead([...rows, { status: "waiting", session_date: "2026-11-21" }], "2026-11-16")).toEqual({ last: "2026-11-15", ahead: true });
  });
  it("words the year's first month, the portal's call and the invitation as the app does", () => {
    const y = hubFeedOf({ status: 200, data: FEED })!.year!;
    expect(yearFrom(y, "en")).toBe("February");
    expect(yearFrom({ ...y, clubFirst: "2026-01-03" }, "en")).toBe("");
    expect(hubDay("2026-11-30", "en")).toBe("30 Nov 2026");
    expect(volunteerHref("s vol")).toBe("https://volunteer.micromobility.sa/#o/s%20vol");
    expect(inviteText(COMMUNITY_WORDS.en.invMsg, "INV7Q2", "ar")).toBe("Hi! I ride with the MicroMobility community in Jeddah and I would love you to join us on a Saturday social ride. Please fill in this form to apply: https://micromobility.sa/community/registration?inv=INV7Q2&lang=ar");
    expect(inviteCodeOf({ status: 200, data: { ok: true, code: "<x>" } })).toBeNull();
  });
});

describe("the first five rides", () => {
  const S = (kind: "saturday" | "swim") => ({ kind, freeRide: false });
  const row = (i: number, sid: string, status = "done") => ({ id: `e${i}`, session_id: sid, session_date: `2026-10-${String(10 + i).padStart(2, "0")}`, status, queue_num: 1, paid: true, price: 0 });
  it("stand in the challenge's place under five rides, from none at all", () => {
    expect(firstFiveTab([], new Map())).toEqual({ n: 0, tg: 5 });
    const two = [row(1, "a"), row(2, "b")];
    expect(firstFiveTab(two, new Map([["a", S("saturday")], ["b", S("saturday")]]))).toEqual({ n: 2, tg: 5 });
    const five = [1, 2, 3, 4, 5].map((i) => row(i, `s${i}`));
    expect(firstFiveTab(five, new Map(five.map((r) => [r.session_id, S("saturday")])))).toBeNull();
  });
  it("leave the challenge to a member who has only finished sessions without a bike", () => {
    expect(firstFiveTab([row(1, "p")], new Map([["p", S("swim")]]))).toBeNull();
  });
  it("count only once every finished booking's session came back", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubGlobal("fetch", vi.fn(async () => json([{ id: "a", ride_kind: "saturday", event_kind: "community" }])));
    expect(await readFirstFive({ id: "c1", token: TOKEN }, [row(1, "a"), row(2, "b")])).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => json([{ id: "a", ride_kind: "saturday", event_kind: "community" }, { id: "b", ride_kind: "saturday", event_kind: "community" }])));
    expect(await readFirstFive({ id: "c1", token: TOKEN }, [row(1, "a"), row(2, "b")])).toEqual({ n: 2, tg: 5 });
    expect(await readFirstFive({ id: "c1", token: TOKEN }, null)).toBeNull();
    vi.unstubAllEnvs(); vi.unstubAllGlobals();
  });
});

describe("api/account/hub-level", () => {
  beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  const HEADERS = { origin: "https://micromobility.sa", cookie: `mm_acct=c1~${TOKEN}`, "content-type": "application/json" };
  const post = (body: unknown, headers: Record<string, string> = HEADERS) => LEVEL(new Request("https://micromobility.sa/api/account/hub-level", { method: "POST", headers, body: JSON.stringify(body) }));
  it("picks through hub_pick_level with the account's id and token", async () => {
    const f = vi.fn(async () => json({ ok: true }));
    vi.stubGlobal("fetch", f);
    const r = await post({ level: 6 });
    expect([r.status, await r.json()]).toEqual([200, { ok: true, level: 6 }]);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://example.supabase.co/rest/v1/rpc/hub_pick_level");
    expect(JSON.parse(String(init.body))).toEqual({ p_id: "c1", p_token: TOKEN, p_level: 6 });
  });
  it("takes only this site's pages, a signed-in account and a whole level, and says each refusal", async () => {
    const f = vi.fn(async () => json({ ok: true }));
    vi.stubGlobal("fetch", f);
    expect((await post({ level: 4 }, { ...HEADERS, origin: "https://evil.example" })).status).toBe(403);
    expect((await post({ level: 4 }, { ...HEADERS, cookie: "" })).status).toBe(401);
    for (const b of [{ level: "4" }, { level: 2.5 }, { level: 0 }, {}]) expect((await post(b)).status, JSON.stringify(b)).toBe(400);
    expect(f).not.toHaveBeenCalled();
    const at = async (a: Response) => { vi.stubGlobal("fetch", vi.fn(async () => a.clone())); const r = await post({ level: 4 }); return [r.status, (await r.json()).error]; };
    expect(await at(json({ ok: false, error: "chosen" }))).toEqual([409, "chosen"]);
    expect(await at(json({ ok: false, error: "level" }))).toEqual([400, "refused"]);
    expect(await at(json({ ok: false, error: "member" }))).toEqual([403, "member"]);
    expect(await at(json({ ok: false, error: "denied" }))).toEqual([401, "signin"]);
    expect(await at(json({ code: "PGRST202", message: "Could not find the function" }, 404))).toEqual([404, "absent"]);
    expect(await at(json({ message: "boom" }, 500))).toEqual([502, "generic"]);
  });
});

describe("api/account/hub-photo", () => {
  beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  const get = (post: string, cookie = `mm_acct=c1~${TOKEN}`) => PHOTO(new Request(`https://micromobility.sa/api/account/hub-photo?post=${post}`, { headers: { cookie } }));
  it("sends the report's photo as a JPEG to a signed-in member, kept by that browser alone", async () => {
    const f = vi.fn(async () => json("data:image/jpeg;base64,/9j/4AA="));
    vi.stubGlobal("fetch", f);
    const r = await get("post-1");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/jpeg");
    expect(r.headers.get("cache-control")).toBe("private, max-age=600");
    expect([...new Uint8Array(await r.arrayBuffer())].slice(0, 2)).toEqual([0xff, 0xd8]);
    expect(JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toEqual({ p_id: "c1", p_token: TOKEN, p_post: "post-1" });
  });
  it("is nothing signed out, for a strange id, or when the database gives no photo", async () => {
    const f = vi.fn(async () => json(null));
    vi.stubGlobal("fetch", f);
    expect((await get("post-1", "")).status).toBe(404);
    expect((await get("a%20b")).status).toBe(404);
    expect(f).toHaveBeenCalledTimes(0);
    expect((await get("post-1")).status).toBe(404);
    vi.stubGlobal("fetch", vi.fn(async () => json("data:image/png;base64,AAAA")));
    expect((await get("post-1")).status).toBe(404);
  });
});

describe("the cards", () => {
  const f = hubFeedOf({ status: 200, data: FEED })!;
  const w = communityWords("en");
  it("draw the season challenge done with its medal and Share, the club goal with the member's share and next target", () => {
    const s = renderToStaticMarkup(createElement(SeasonGoalCard, { g: f.goals[0], locale: "en", w, shareLabel: w.kMile, first: "Sara" }));
    expect(s).toContain("Season challenge</h3>");
    expect(s).toContain("bdg-m");
    expect(s).toMatch(/<strong>Done<\/strong> · 4 of 4, until 9 Dec 2026/);
    expect(s).toContain(">Share</span>");
    const c = renderToStaticMarkup(createElement(ClubGoalCard, { g: f.club!, locale: "en", w }));
    expect(c).toContain("40 Saturday rides this month");
    expect(c).toContain("The club reached it");
    expect(c).toContain("You: 3 of them");
    expect(c).toMatch(/Next Saturday<\/span><strong><bdi>21 Nov 2026/);
    expect(c).toMatch(/Target<\/span><strong><bdi>12/);
    expect(c).not.toContain("44"); // the club's count is the bar alone, as the app draws it once reached
  });
  it("draw the report with its photo and the member's own Saturdays, the tip, and the call for volunteers", () => {
    const r = renderToStaticMarkup(createElement(ReportCard, { p: f.post!, locale: "ar", w: communityWords("ar") }));
    expect(r).toContain("تقرير السبت");
    expect(r).toContain('src="/api/account/hub-photo?post=post-1"');
    expect(r).toContain("بحر هادئ.");
    const t = renderToStaticMarkup(createElement(TipCard, { today: "2026-11-19", w }));
    expect(t).toContain("Tip of the week</h3>");
    expect(t).toContain(w[`tip${tipOf("2026-11-19")}` as keyof typeof w]);
    const v = renderToStaticMarkup(createElement(VolunteerCallCard, { id: "s-vol", w }));
    expect(v).toContain('href="https://volunteer.micromobility.sa/#o/s-vol" target="_blank" rel="noopener">Volunteer</a>');
  });
  it("stand in the members' area where the app's tab has them, with no head count", async () => {
    const { default: MembersArea } = await import("@/components/club/MembersArea");
    const a = memberArea({ status: 200, data: { ok: true, member: true, first_name: "Sara", credits: 0, tier: 0, next: 100, rides: 6, group_rides: 4, last: [], upcoming: [], announcements: [] }, message: "" });
    if (!a.ok || !a.member) throw new Error("not a member");
    const props = { locale: "en", L: "en" as const, area: a, tierNames: ["Rider", "Pro", "Legend"] as [string, string, string], nameOf: () => "", bookAt: () => "", today: "2026-11-19", empty: "None" };
    const html = renderToStaticMarkup(createElement(MembersArea, { ...props, hub: f, invite: "INV7Q2", mentor: { ask: null, mentor: null, profiles: [], offers: [] } }));
    const at = (s: string) => { const i = html.indexOf(s); expect(i, s).toBeGreaterThan(-1); return i; };
    const order = ["club-hub-yr-h", "club-up-h", "club-hub-me-h", "Season challenge", "club-hub-club-h", "club-hub-report-h", "club-hub-mt-h", "club-hub-vol-h", "club-hub-inv"].map(at);
    expect(order).toEqual([...order].sort((x, y) => x - y));
    for (const n of ["873", "3107", "54021", "24019", "457", "871"]) expect(html, n).not.toContain(n);
    expect(html).not.toContain("club-hub-tip"); // a report shows
    // with the first five rides, the path takes the challenge's place; with the report leading, it comes before the card
    const p5 = renderToStaticMarkup(createElement(MembersArea, { ...props, hub: f, p5: { n: 2, tg: 5 }, recap: true }));
    expect(p5).toContain("Your first five rides");
    expect(p5).not.toContain("club-hub-me-h");
    expect(p5.indexOf("club-hub-report-h")).toBeLessThan(p5.indexOf("club-cardviz"));
    expect(p5.split("club-hub-report-h").length).toBe(3); // one report (its id and its aria-labelledby)
    // without the read: none of its cards
    expect(renderToStaticMarkup(createElement(MembersArea, props))).not.toContain("club-hub");
  });
});

describe("the words", () => {
  it("say every card in each of the site's languages, with their values in place", () => {
    const keys = Object.keys(COMMUNITY_WORDS.en);
    for (const { code } of LOCALES) {
      const w = COMMUNITY_WORDS[code];
      expect(Object.keys(w).sort(), code).toEqual([...keys].sort());
      for (const k of keys) {
        const v = w[k as keyof typeof w], ph = (s: string) => (s.match(/\{\d\}/g) || []).sort().join();
        expect(v.trim().length, `${code}.${k}`).toBeGreaterThan(0);
        expect(ph(v), `${code}.${k}`).toBe(ph(COMMUNITY_WORDS.en[k as keyof typeof w]));
      }
    }
  });
  it("are the booking app's own in its languages", () => {
    expect(COMMUNITY_WORDS.ar.goalYou).toBe("تحديك");
    expect(COMMUNITY_WORDS.fr.goalAll).toBe("Objectif de la communauté");
    expect(COMMUNITY_WORDS.bn.invBtn).toBe("বন্ধুকে শনিবারের সোশ্যাল রাইডে আমন্ত্রণ জানান");
    expect(Object.keys(mentorWords(COMMUNITY_WORDS.en)).every((k) => /^(mt|hp|lk)/.test(k) || ["close", "err", "palestine"].includes(k))).toBe(true);
  });
});
