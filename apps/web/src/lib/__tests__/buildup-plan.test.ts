import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactElement } from "react";
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { bupSession, buildupPlan, dayPlus, ksaDay, saturdays, type BupBooking, type BupSession } from "../buildup-plan";
import { readBuildup } from "../member-hub-server";
import { resetSessionColumns } from "../rides";
import BuildupPlan from "../../components/club/BuildupPlan";
import { MEMBER_HUB_WORDS } from "../../components/club/MemberHub.words";
import { LOCALES } from "../../i18n/locales";

// The Build-up plan on /club, as the booking app's member-hub.js _bupHtml has it (rentals 239b4538, 36051d1a and the
// integration's _bwOpen(s, 1), 2026-11-18): tests/buildup-plan.spec.ts there, case by case.
const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;
const TODAY = "2026-11-18"; // a Wednesday

const ses = (o: Partial<BupSession> & { id: string; date: string }): BupSession => ({
  kind: "saturday", status: "open", title: null, titleAr: null, bup: false, fbk: false, cancelled: false, draft: false, gender: null, ...o,
});
const EV = ses({ id: "2026-12-13-ev", date: "2026-12-13", kind: "event", title: "T100 Triathlon Prep", bup: true });
const map = (...l: BupSession[]) => new Map(l.map((s) => [s.id, s]));
const book = (sessionId: string, status: string, registeredAt = "2026-11-01T09:00:00Z"): BupBooking => ({ sessionId, status, registeredAt });
const always = () => true;

describe("the days", () => {
  it("counts days, lists the Saturdays both ends included, and reads a booking's day in Riyadh", () => {
    expect(dayPlus("2026-11-18", 7)).toBe("2026-11-25");
    expect(dayPlus("2026-12-13", -56)).toBe("2026-10-18");
    expect(saturdays("2026-11-18", "2026-12-12")).toEqual(["2026-11-21", "2026-11-28", "2026-12-05", "2026-12-12"]);
    expect(saturdays("2026-11-21", "2026-11-21")).toEqual(["2026-11-21"]); // today on a Saturday counts
    expect(saturdays("2026-11-22", "2026-11-27")).toEqual([]);
    expect(saturdays("nope", "2026-11-27")).toEqual([]);
    expect(ksaDay("2026-10-30T22:00:00Z")).toBe("2026-10-31"); // past 21:00 UTC is the next day in Jeddah
    expect(ksaDay("")).toBe("");
  });
});

describe("buildupPlan", () => {
  const SATS = [
    ses({ id: "2026-10-31", date: "2026-10-31" }), ses({ id: "2026-11-07", date: "2026-11-07" }), ses({ id: "2026-11-14", date: "2026-11-14" }),
    ses({ id: "2026-11-21", date: "2026-11-21" }), ses({ id: "2026-11-28", date: "2026-11-28" }), ses({ id: "2026-12-05", date: "2026-12-05" }),
  ];
  const MINE = [
    book(EV.id, "waiting", "2026-10-30T22:00:00Z"),
    book("2026-10-31", "done"), book("2026-11-07", "active"), book("2026-11-21", "waiting"), book("2026-11-28", "waitlist"),
  ];
  it("counts the Saturdays to go and says each Saturday from the booking's day, as the app's rows do", () => {
    const p = buildupPlan(MINE, map(EV, ...SATS), TODAY, null, always);
    expect(p?.ev.id).toBe(EV.id);
    expect(p?.togo).toBe(4);
    expect(p?.rows).toEqual([
      { date: "2026-10-31", state: "done" }, // ridden
      { date: "2026-11-07", state: "done" }, // checked in on a day gone
      { date: "2026-11-14", state: "past" }, // gone, not ridden: the date alone
      { date: "2026-11-21", state: "held" },
      { date: "2026-11-28", state: "wl" },
      { date: "2026-12-05", state: "book", book: "2026-12-05" },
      { date: "2026-12-12", state: "soon" }, // no session yet: Not open yet
    ]);
  });
  it("starts eight weeks before the event at the latest, and lists the last eight Saturdays at most", () => {
    const early = [book(EV.id, "active", "2026-08-01T09:00:00Z")];
    const p = buildupPlan(early, map(EV), TODAY, null, always);
    expect(p?.rows.map((r) => r.date)).toEqual(["2026-10-24", "2026-10-31", "2026-11-07", "2026-11-14", "2026-11-21", "2026-11-28", "2026-12-05", "2026-12-12"]);
  });
  it("says Fully booked, Cancelled or Not open yet when there is nothing to book", () => {
    const at = (l: BupSession[], gender: "male" | "female" | null = null, open = always) =>
      buildupPlan([book(EV.id, "waiting")], map(EV, ...l), TODAY, gender, open)?.rows.find((r) => r.date === "2026-12-05");
    const d = { id: "2026-12-05", date: "2026-12-05" };
    expect(at([ses({ ...d, status: "full" })])?.state).toBe("full");
    expect(at([ses({ ...d, status: "closed", fbk: true })])?.state).toBe("full"); // Full, no waitlist
    expect(at([ses({ ...d, status: "closed" })])?.state).toBe("soon");
    expect(at([ses({ ...d, cancelled: true })])?.state).toBe("cancel"); // every session that day called off
    expect(at([ses({ ...d, cancelled: true }), ses({ id: "2026-12-05-b", date: "2026-12-05", status: "closed" })])?.state).toBe("soon");
    expect(at([ses({ ...d, draft: true })])?.state).toBe("soon");
    expect(at([ses(d)], null, () => false)?.state).toBe("soon"); // its booking window not open yet
    expect(at([ses({ ...d, gender: "female" })], "male")?.state).toBe("soon"); // a ride for the other gender
    expect(at([ses({ ...d, gender: "female", status: "full" })], "male")?.state).toBe("soon");
    expect(at([ses({ ...d, gender: "female" })], "female")).toEqual({ date: "2026-12-05", state: "book", book: "2026-12-05" });
    expect(at([ses({ ...d, gender: "female" })], null)?.state).toBe("soon"); // no gender on file
  });
  it("takes the nearest held place on a marked event still to come, never a waitlist, a Saturday ride or one called off", () => {
    const later = ses({ id: "2027-01-10-ev", date: "2027-01-10", kind: "vlap", bup: true });
    expect(buildupPlan([book(later.id, "active"), book(EV.id, "waiting")], map(EV, later), TODAY, null, always)?.ev.id).toBe(EV.id);
    for (const [b, s] of [
      [book(EV.id, "waitlist"), EV], [book(EV.id, "cancelled"), EV], [book(EV.id, "done"), EV],
      [book(EV.id, "waiting"), { ...EV, bup: false }], [book(EV.id, "waiting"), { ...EV, kind: "saturday" as const }],
      [book(EV.id, "waiting"), { ...EV, cancelled: true }], [book(EV.id, "waiting"), { ...EV, date: TODAY }],
    ] as const) expect(buildupPlan([b], map(s), TODAY, null, always), JSON.stringify([b, s])).toBeNull();
    expect(buildupPlan([book("nope", "waiting")], map(EV), TODAY, null, always)).toBeNull();
  });
  it("stays until the last Saturday before the event has passed, and never says 0", () => {
    const fri = { ...EV, date: "2026-11-27" }; // six days ahead: this Saturday is the last
    expect(buildupPlan([book(EV.id, "waiting")], map(fri), TODAY, null, always)?.togo).toBe(1);
    const sun = { ...EV, date: "2026-11-22" }; // a Sunday event two days after a Saturday: that Saturday is bookable
    const p = buildupPlan([book(EV.id, "waiting")], map(sun, ses({ id: "2026-11-21", date: "2026-11-21" })), TODAY, null, always);
    expect(p?.togo).toBe(1);
    expect(p?.rows.at(-1)).toEqual({ date: "2026-11-21", state: "book", book: "2026-11-21" });
    const thu = { ...EV, date: "2026-11-19" }; // tomorrow, no Saturday left before it: no card
    expect(buildupPlan([book(EV.id, "waiting")], map(thu), TODAY, null, always)).toBeNull();
    expect(buildupPlan([book(EV.id, "waiting")], map(EV), "bad", null, always)).toBeNull();
  });
});

describe("bupSession", () => {
  it("reads a sessions row: the mark, Full no waitlist, called off, a draft and one gender", () => {
    expect(bupSession({ id: "x", session_date: "2026-12-13", status: "open", ride_kind: "vlap", event_kind: "community", title: " Victory Lap ", title_ar: "فيكتوري لاب", bike_slots: '{"_bup":1,"_time":"16:30 - 17:15"}' }))
      .toEqual({ id: "x", date: "2026-12-13", kind: "vlap", status: "open", title: "Victory Lap", titleAr: "فيكتوري لاب", bup: true, fbk: false, cancelled: false, draft: false, gender: null });
    const s = bupSession({ id: "2026-12-05", session_date: "2026-12-05", status: "closed", event_kind: "community", bike_slots: { _fbk: 1 }, cancelled_at: "2026-12-01T00:00:00Z", draft: true, gender_only: "female" });
    expect(s && [s.kind, s.fbk, s.cancelled, s.draft, s.gender, s.bup]).toEqual(["saturday", true, true, true, "female", false]);
    expect(bupSession({ id: "x", session_date: "soon" })).toBeNull();
    expect(bupSession({ session_date: "2026-12-05" })).toBeNull();
  });
});

describe("readBuildup", () => {
  const TOKEN = "a1b2c3d4e5f6a7b8c9d0";
  beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); resetSessionColumns(); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
  const ROWS = [
    { id: "q1", session_id: EV.id, session_date: EV.date, status: "waiting", registered_at: "2026-11-01T09:00:00Z" },
    { id: "q2", session_id: "2026-11-21", session_date: "2026-11-21", status: "waiting", registered_at: "2026-11-02T09:00:00Z" },
  ];
  const EVROW = { id: EV.id, session_date: EV.date, status: "open", title: "T100 Triathlon Prep", ride_kind: "event", event_kind: "community", bike_slots: { _bup: 1 } };
  const SATROWS = [
    { id: "2026-11-21", session_date: "2026-11-21", status: "open", ride_kind: null, event_kind: "community", bike_slots: {} },
    { id: "2026-11-28", session_date: "2026-11-28", status: "full", ride_kind: null, event_kind: "community", bike_slots: {} },
    { id: "2026-11-29-y", session_date: "2026-11-29", status: "open", ride_kind: "yoga", event_kind: "community", bike_slots: {} },
  ];
  const fx = (events: unknown[] = [EVROW]) => vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/rpc/my_bookings")) return json(ROWS);
    if (url.includes("/rpc/list_sessions?") && url.includes("id=in.")) return json(events);
    if (url.includes("/rpc/list_sessions?") && url.includes("event_kind=eq.community")) return json(SATROWS);
    return json({ code: "PGRST202", message: String(init?.body) }, 404);
  });
  it("reads the member's bookings, then the held sessions, then the Saturdays up to the day before the event, all with the account's token", async () => {
    const f = fx();
    vi.stubGlobal("fetch", f);
    const p = await readBuildup({ id: "c1", token: TOKEN }, TODAY, null, always);
    expect(p?.ev.title).toBe("T100 Triathlon Prep");
    expect(p?.rows.map((r) => [r.date, r.state])).toEqual([["2026-11-07", "past"], ["2026-11-14", "past"], ["2026-11-21", "held"], ["2026-11-28", "full"], ["2026-12-05", "soon"], ["2026-12-12", "soon"]]);
    const urls = f.mock.calls.map((c) => String(c[0]));
    expect(urls).toHaveLength(3);
    expect(urls[1]).toContain(`id=in.(${EV.id},2026-11-21)`); // only the places held still to come
    expect(urls[2]).toContain("session_date=gte.2026-11-01&session_date=lte.2026-12-12");
    for (const c of f.mock.calls.slice(1)) expect(JSON.parse(String((c as unknown as [string, RequestInit])[1].body))).toEqual({ p_id: "c1", p_token: TOKEN });
  });
  it("reads no Saturdays when no held session is marked, and draws nothing for a failed read", async () => {
    const f = fx([{ ...EVROW, bike_slots: {} }]);
    vi.stubGlobal("fetch", f);
    expect(await readBuildup({ id: "c1", token: TOKEN }, TODAY, null, always)).toBeNull();
    expect(f).toHaveBeenCalledTimes(2);
    vi.stubGlobal("fetch", vi.fn(async () => json({ message: "boom" }, 500)));
    expect(await readBuildup({ id: "c1", token: TOKEN }, TODAY, null, always)).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await readBuildup({ id: "c1", token: TOKEN }, TODAY, null, always)).toBeNull();
  });
});

describe("the card", () => {
  const plan = buildupPlan([book(EV.id, "waiting", "2026-10-30T22:00:00Z"), book("2026-10-31", "done")],
    map(EV, ses({ id: "2026-10-31", date: "2026-10-31" }), ses({ id: "2026-11-21", date: "2026-11-21" })), TODAY, null, always);
  const draw = (locale: string, p = plan) => renderToStaticMarkup(createElement(BuildupPlan, { locale, plan: p!, name: "T100 Triathlon Prep", bookAt: (id: string) => `https://book.example.test/?session=${id}` }));
  it("draws the event, its date, the Saturdays to go and a row a Saturday, Book opening the booking app on that ride", () => {
    const html = draw("en");
    expect(html).toContain('<h3 id="club-bup-h"><svg');
    expect(html).toContain("Build-up plan</h3>");
    expect(html).toContain("<strong><bdi>T100 Triathlon Prep</bdi></strong><span><bdi>13 Dec 2026</bdi></span>");
    expect(html).toContain('<p class="club-bup-n">4 Saturdays to go</p>');
    expect(html).toContain('<ul class="club-bup-l" aria-label="Saturday rides">');
    expect(html).toMatch(/<li class="done" data-state="done"><span class="club-bup-d"><bdi>31 Oct<\/bdi><\/span><span class="club-bup-s"><svg[^]*?<\/svg>Done<\/span><\/li>/);
    expect(html).toContain('<li class="past" data-state="past"><span class="club-bup-d"><bdi>7 Nov</bdi></span></li>');
    expect(html).toContain('<a class="club-bup-go" href="https://book.example.test/?session=2026-11-21">Book <svg');
    expect(html).toContain('<li data-state="soon"><span class="club-bup-d"><bdi>12 Dec</bdi></span><span class="club-bup-s">Not open yet</span></li>');
  });
  it("sits in the members' area right after the card, before the rides", async () => {
    const { default: MembersArea } = await import("@/components/club/MembersArea");
    const { memberArea } = await import("../members");
    const a = memberArea({ status: 200, data: { ok: true, member: true, first_name: "Sara", credits: 0, tier: 0, next: 100, rides: 1, group_rides: 1, last: [], upcoming: [] }, message: "" });
    if (!a.ok || !a.member) throw new Error("not a member");
    const props = { locale: "en", L: "en" as const, area: a, tierNames: ["Rider", "Pro", "Legend"] as [string, string, string], nameOf: () => "Saturday Social Ride",
      bookAt: (id: string, kind: string | null) => `https://book.example.test/?ev=${kind}&session=${id}`, today: TODAY, empty: "None" };
    const html = renderToStaticMarkup(createElement(MembersArea, { ...props, bup: { plan: plan!, name: "T100 Triathlon Prep" } }));
    const at = (x: string) => html.indexOf(x);
    expect(at('class="club-mine-next"')).toBeLessThan(at('class="club-bup"'));
    expect(at('class="club-bup"')).toBeLessThan(at('class="club-att"'));
    expect(html).toContain('href="https://book.example.test/?ev=saturday&amp;session=2026-11-21"');
    expect(renderToStaticMarkup(createElement(MembersArea, { ...props, bup: null }))).not.toContain("club-bup");
  });
  it("says one Saturday in its own words, and speaks Arabic", () => {
    const one = draw("en", { ...plan!, togo: 1 });
    expect(one).toContain('<p class="club-bup-n">1 Saturday to go</p>');
    const ar = draw("ar");
    expect(ar).toContain("خطة الاستعداد</h3>");
    expect(ar).toContain('<p class="club-bup-n">أيام السبت المتبقية: 4</p>');
    expect(ar).toContain("احجز");
  });
  it("has its words in all 16 languages, the booking app's own where it speaks them, Latin digits", () => {
    for (const l of LOCALES) {
      const w = MEMBER_HUB_WORDS[l.code];
      expect(w.bupN.split("{0}").length, l.code).toBe(2);
      if (l.code !== "ar") expect(w.bupOne, l.code).toContain("1"); // Arabic says one Saturday in words
      expect(Object.values(w).join(" "), l.code).not.toMatch(/[०-९০-৯٠-٩۰-۹]/);
    }
    expect(MEMBER_HUB_WORDS.fr.bupN).toBe("{0} samedis restants");
    expect(MEMBER_HUB_WORDS.ur.bup).toBe("تیاری کا منصوبہ");
    expect(MEMBER_HUB_WORDS.bn.bupOne).toBe("1টি শনিবার বাকি");
    expect(MEMBER_HUB_WORDS.tl.bupFull).toBe("Puno na");
  });
});
