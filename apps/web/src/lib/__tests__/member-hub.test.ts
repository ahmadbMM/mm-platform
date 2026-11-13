import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactElement } from "react";
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { hubMonthOf, hubPlanOf, monthDue, monthName, planAfter, planBoxes, type HubMonth, type HubPlan } from "../member-hub";
import { readMemberHub } from "../member-hub-server";
import { memberArea } from "../members";
import { POST } from "../../app/api/account/plan/route";
import { MEMBER_HUB_WORDS, memberHubWords } from "../../components/club/MemberHub.words";
import { LOCALES } from "../../i18n/locales";

// Plan my Saturdays (F10) and My month (F13) in a member's area on /club, as the booking app's member-hub.js has them
// (_planHtml, _planTick, _monOk, _monKinds, _monPrev, _monHtml).
const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;
const ok = (data: unknown) => ({ status: 200, data });

const PLAN = {
  ok: true, today: "2026-11-13", month: "2026-11",
  days: [
    { date: "2026-11-07", on: true, past: true },
    { date: "2026-11-14", on: false, past: false },
    { date: "2026-11-21", on: true, past: false },
    { date: "2026-11-28", on: false, past: false },
  ],
};
const MONTH = {
  ok: true, show: true, today: "2026-12-27", from: "2026-12-26", month: "2026-12-01",
  sessions: 7, saturdays: 3, badges: 1,
  kinds: [{ k: "yoga", n: 1 }, { k: "saturday", n: 3 }, { k: "rental", n: 1 }, { k: "jcc", n: 1 }, { k: "zzz", n: 4 }, { k: "swim", n: 0 }, { k: "blood", n: 1 }, null],
  prev: { month: "2026-11-01", sessions: 4 },
};

describe("hubPlanOf", () => {
  it("reads the month's Saturdays, each ticked or not, a day already gone locked", () => {
    expect(hubPlanOf(ok(PLAN), "2026-11-13")).toEqual({ month: "2026-11", days: [
      { date: "2026-11-07", on: true, past: true },
      { date: "2026-11-14", on: false, past: false },
      { date: "2026-11-21", on: true, past: false },
      { date: "2026-11-28", on: false, past: false },
    ] });
  });
  it("locks a Saturday before today in Riyadh whatever the answer said, and drops a row that is not a day", () => {
    const p = hubPlanOf(ok({ ...PLAN, month: undefined, days: [...PLAN.days, { date: "nope", on: true }, null, "2026-11-30"] }), "2026-11-15");
    expect(p?.days.map((d) => [d.date, d.past])).toEqual([["2026-11-07", true], ["2026-11-14", true], ["2026-11-21", false], ["2026-11-28", false]]);
    expect(p?.month).toBe("2026-11"); // from the first day when the answer did not say
  });
  it("draws no card for a refusal, a database without the function, no answer, or no Saturday", () => {
    expect(hubPlanOf(ok({ ok: false, error: "member" }), "2026-11-13")).toBeNull();
    expect(hubPlanOf(ok({ ok: false, error: "denied" }), "2026-11-13")).toBeNull();
    expect(hubPlanOf({ status: 404, data: null }, "2026-11-13")).toBeNull();
    expect(hubPlanOf({ status: 0, data: null }, "2026-11-13")).toBeNull();
    expect(hubPlanOf(ok({ ok: true, days: [] }), "2026-11-13")).toBeNull();
    expect(hubPlanOf(ok({ ok: true }), "2026-11-13")).toBeNull();
    expect(hubPlanOf(ok(null), "2026-11-13")).toBeNull();
  });
});

describe("planAfter (a tap's outcome)", () => {
  const day = { date: "2026-11-14", on: true, past: false, n: "14", label: "Saturday 14 November" };
  it("keeps what the database answered", () => {
    expect(planAfter(day, true, { ok: true, on: true })).toEqual({ day, failed: false });
    expect(planAfter(day, true, { ok: true, on: false })).toEqual({ day: { ...day, on: false }, failed: false });
  });
  it("turns the box back on anything else, and locks a Saturday the database says is gone", () => {
    expect(planAfter(day, true, null)).toEqual({ day: { ...day, on: false }, failed: true });
    expect(planAfter({ ...day, on: false }, false, { ok: false, error: "generic" })).toEqual({ day: { ...day, on: true }, failed: true });
    expect(planAfter(day, true, { ok: false, error: "past" })).toEqual({ day: { ...day, on: false, past: true }, failed: true });
  });
});

describe("monthDue", () => {
  it("is the 26th to the month's end", () => {
    expect(["2026-12-01", "2026-12-25", "2026-12-26", "2026-12-31", "2027-02-28", "bad", ""].map(monthDue)).toEqual([false, false, true, true, true, false, false]);
  });
});

describe("hubMonthOf", () => {
  it("reads the member's month: kinds most first, the circuit's 'rental' as jcc, a kind the site does not know left out", () => {
    expect(hubMonthOf(ok(MONTH), "2026-12-27")).toEqual({
      month: "2026-12", sessions: 7, saturdays: 3, badges: 1,
      kinds: [{ k: "saturday", n: 3 }, { k: "jcc", n: 2 }, { k: "blood", n: 1 }, { k: "yoga", n: 1 }],
      prev: { month: "2026-11", x: 3 },
    });
  });
  it("checks on what came back what the app's _monOk checks", () => {
    const at = (m: Record<string, unknown>, today = "2026-12-27") => hubMonthOf(ok({ ...MONTH, ...m }), today);
    expect(at({})).not.toBeNull();
    expect(at({ show: false })).toBeNull();
    expect(at({ ok: false, error: "denied" })).toBeNull();
    expect(at({}, "2026-12-25")).toBeNull(); // before the 26th
    expect(at({ month: "2026-11-01" })).toBeNull(); // another month
    expect(at({ from: "2027-01-26" })).toBeNull(); // before its first day
    expect(at({ from: "" })).toBeNull();
    expect(at({ from: "2026-12-27" })).not.toBeNull(); // its first day
    expect(at({ sessions: 1 })).toBeNull(); // under two sessions
    expect(at({ sessions: "x" })).toBeNull();
    expect(hubMonthOf({ status: 404, data: null }, "2026-12-27")).toBeNull();
    expect(hubMonthOf({ status: 200, data: null }, "2026-12-27")).toBeNull();
  });
  it("compares with the member's own month before only when the database sends one", () => {
    const at = (prev: unknown, sessions = 7) => hubMonthOf(ok({ ...MONTH, sessions, prev }), "2026-12-27")?.prev;
    expect(at(null)).toBeNull();
    expect(at({ month: "2026-11-01", sessions: null })).toBeNull();
    expect(at({ month: "bad", sessions: 2 })).toBeNull();
    expect(at({ month: "2026-11-01", sessions: 9 })).toEqual({ month: "2026-11", x: -2 });
    expect(at({ month: "2026-11-01", sessions: 7 })).toEqual({ month: "2026-11", x: 0 });
    expect(at({ month: "2026-11-01", sessions: 0 }, 2)).toEqual({ month: "2026-11", x: 2 });
  });
  it("draws no list when no kind is known, and counts junk as nothing", () => {
    const m = hubMonthOf(ok({ ...MONTH, kinds: "x", saturdays: -2, badges: "y" }), "2026-12-27");
    expect(m && [m.kinds, m.saturdays, m.badges]).toEqual([[], 0, 0]);
  });
});

describe("the boxes and names, in the page's language", () => {
  it("give each Saturday its day's number and its whole date, and each month its name", () => {
    const b = planBoxes(hubPlanOf(ok(PLAN), "2026-11-13") as HubPlan, "en");
    expect(b.map((x) => [x.n, x.label])).toEqual([["7", "Saturday 7 November"], ["14", "Saturday 14 November"], ["21", "Saturday 21 November"], ["28", "Saturday 28 November"]]);
    expect(planBoxes(hubPlanOf(ok(PLAN), "2026-11-13") as HubPlan, "ar")[0].n).toBe("7"); // Latin digits in every language
    expect(monthName("2026-11", "en")).toBe("November");
    expect(monthName("2026-12", "en", true)).toBe("December 2026");
    expect(monthName("2026-12", "ar", true)).toMatch(/^ديسمبر 2026/);
  });
});

describe("the words", () => {
  it("are there in all 16 languages, each comparison with its month", () => {
    const keys = Object.keys(MEMBER_HUB_WORDS.en).sort();
    for (const l of LOCALES) {
      const w = MEMBER_HUB_WORDS[l.code];
      expect(w, l.code).toBeTruthy();
      expect(Object.keys(w).sort(), l.code).toEqual(keys);
      for (const k of keys) expect(w[k as keyof typeof w].trim(), `${l.code} ${k}`).not.toBe("");
      expect(w.vs.split("{0}").length, l.code).toBe(2);
      expect(Object.values(w).join(" "), l.code).not.toMatch(/\p{Extended_Pictographic}/u);
    }
    expect(memberHubWords("xx")).toBe(MEMBER_HUB_WORDS.en);
  });
  it("are the booking app's own where it speaks the language", () => {
    expect(MEMBER_HUB_WORDS.en).toEqual({ plan: "Plan my Saturdays", err: "We could not do that. Please try again.", month: "My month", sats: "Saturdays ridden", sessions: "Sessions", badges: "Badges earned", vs: "Sessions compared with {0}" });
    expect(MEMBER_HUB_WORDS.ar.plan).toBe("خطتي لأيام السبت");
    expect(MEMBER_HUB_WORDS.ar.vs).toBe("الأنشطة مقارنةً بشهر {0}");
    expect(MEMBER_HUB_WORDS.fr.month).toBe("Mon mois");
    expect(MEMBER_HUB_WORDS.bn.vs).toBe("{0}-এর তুলনায় সেশন");
  });
});

// The members' area with both pieces, as app/[locale]/club/page.tsx hands them over.
const AREA = {
  ok: true, member: true, first_name: "Sara", since: null, credits: 0, tier: 0, next: 100, rides: 3, group_rides: 1,
  last: [{ date: "2026-12-20", title: "", kind: "saturday", rated: true }],
  upcoming: [{ id: "2027-01-02", date: "2027-01-02", title: "", kind: "saturday", time: "05:45 - 06:15", booked: false }],
  birth_date: null, announcements: [],
};
async function area(locale: string, plan: HubPlan | null, month: HubMonth | null) {
  const { default: MembersArea } = await import("@/components/club/MembersArea");
  const a = memberArea({ status: 200, data: AREA, message: "" });
  if (!a.ok || !a.member) throw new Error("not a member");
  const names: Record<string, string> = { saturday: "Saturday Social Ride", jcc: "JCC night", blood: "Blood Donation", yoga: "Yoga" };
  return renderToStaticMarkup(createElement(MembersArea, {
    locale, L: locale === "ar" ? "ar" : "en", area: a, tierNames: ["Rider", "Pro", "Legend"], nameOf: () => "Saturday Social Ride",
    bookAt: (id: string) => `https://book.example.test/?session=${id}`, today: "2026-12-27", empty: "None",
    plan, month, kindName: (k) => names[k] ?? k,
  }));
}

describe("the members' area", () => {
  const plan = hubPlanOf(ok({ ...PLAN, month: "2026-12", days: [{ date: "2026-12-05", on: true, past: true }, { date: "2026-12-26", on: false, past: false }] }), "2026-12-26");
  const month = hubMonthOf(ok(MONTH), "2026-12-27");
  it("shows My month after the member's rides and Plan my Saturdays after the upcoming sessions", async () => {
    const html = await area("en", plan, month);
    const at = (s: string) => html.indexOf(s);
    expect(at('class="club-att"')).toBeLessThan(at('class="club-mon"'));
    expect(at('class="club-mon"')).toBeLessThan(at('class="club-up"'));
    expect(at('class="club-up"')).toBeLessThan(at('class="club-plan"'));
  });
  it("draws the member's month: its name, three tiles and the comparison, then the kinds most first", async () => {
    const html = await area("en", null, month);
    const mon = /<section class="club-mon".*?<\/section>/.exec(html)?.[0] ?? "";
    expect(mon).toContain('<h3 id="club-mon-h">My month</h3>');
    expect(mon).toContain("<bdi>December 2026</bdi>");
    expect(mon).toContain('<div data-mon="sats"><strong><bdi>3</bdi></strong><span>Saturdays ridden</span></div>');
    expect(mon).toContain('<div data-mon="sessions"><strong><bdi>7</bdi></strong><span>Sessions</span></div>');
    expect(mon).toContain('<div data-mon="badges"><strong><bdi>1</bdi></strong><span>Badges earned</span></div>');
    expect(mon).toContain('<div data-mon="prev"><strong><bdi dir="ltr">+3</bdi></strong><span>Sessions compared with November</span></div>');
    expect([...mon.matchAll(/data-kind="(\w+)"/g)].map((m) => m[1])).toEqual(["saturday", "jcc", "blood", "yoga"]);
    expect(mon).toContain("<span>JCC night</span><strong><bdi>2</bdi></strong>");
    expect(mon).not.toMatch(/share/i); // the app's Share draws through F12's pop-up, not on this page
    expect(html).not.toContain('class="club-plan"');
  });
  it("says a month down as -n, and no comparison without a month before", async () => {
    const down = await area("en", null, { ...(month as HubMonth), prev: { month: "2026-11", x: -2 } });
    expect(down).toContain('<bdi dir="ltr">-2</bdi>');
    const none = await area("en", null, { ...(month as HubMonth), prev: null });
    expect(none).not.toContain('data-mon="prev"');
  });
  it("draws this month's Saturdays as tick boxes, a Saturday gone locked", async () => {
    const html = await area("en", plan, null);
    const sec = /<section class="club-plan".*?<\/section>/.exec(html)?.[0] ?? "";
    expect(sec).toContain('<h3 id="club-plan-h">Plan my Saturdays</h3>');
    expect(sec).toContain('role="group" aria-label="Plan my Saturdays · December"');
    const boxes = sec.match(/<button[^>]*>.*?<\/button>/g) ?? [];
    expect(boxes).toHaveLength(2);
    expect(boxes[0]).toMatch(/role="checkbox" class="club-sat on" aria-checked="true" aria-label="Saturday 5 December" disabled=""/);
    expect(boxes[0]).toContain("<svg"); // its tick
    expect(boxes[0]).toContain("<bdi>5</bdi>");
    expect(boxes[1]).toMatch(/class="club-sat" aria-checked="false" aria-label="Saturday 26 December"/);
    expect(boxes[1]).not.toContain("disabled");
    expect(boxes[1]).not.toContain("<svg");
    expect(sec).not.toContain('role="alert"');
    expect(html).not.toContain('class="club-mon"');
  });
  it("speaks the page's language", async () => {
    const html = await area("ar", plan, month);
    expect(html).toContain('<h3 id="club-mon-h">شهري</h3>');
    expect(html).toContain('<h3 id="club-plan-h">خطتي لأيام السبت</h3>');
    expect(html).toContain("<span>الأوسمة المكتسبة</span>");
  });
  it("draws neither piece when its read gave nothing", async () => {
    const html = await area("en", null, null);
    expect(html).not.toContain("club-mon");
    expect(html).not.toContain("club-plan");
  });
});

const TOKEN = "a1b2c3d4e5f6a7b8c9d0";
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const db = (answers: Record<string, Response>) => vi.fn(async (url: string) => {
  const a = answers[url.split("/rpc/")[1]];
  return a ? a.clone() : json({ code: "PGRST202", message: "Could not find the function" }, 404);
});
const sent = (fx: ReturnType<typeof db>) => fx.mock.calls.map((c) => [String(c[0]).split("/rpc/")[1], JSON.parse(String((c as unknown as [string, RequestInit])[1].body))]);

describe("readMemberHub", () => {
  beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("asks hub_plan, and hub_month only from the 26th, with the account's own id and token", async () => {
    const early = db({ hub_plan: json(PLAN), hub_month: json(MONTH) });
    vi.stubGlobal("fetch", early);
    const a = await readMemberHub({ id: "c1", token: TOKEN }, "2026-12-13");
    expect(a.plan?.days).toHaveLength(4);
    expect(a.month).toBeNull();
    expect(sent(early)).toEqual([["hub_plan", { p_id: "c1", p_token: TOKEN }]]);
    const late = db({ hub_plan: json(PLAN), hub_month: json(MONTH) });
    vi.stubGlobal("fetch", late);
    const b = await readMemberHub({ id: "c1", token: TOKEN }, "2026-12-27");
    expect(b.month?.sessions).toBe(7);
    expect(sent(late).map((c) => c[0]).sort()).toEqual(["hub_month", "hub_plan"]);
    expect(sent(late).every((c) => c[1].p_id === "c1" && c[1].p_token === TOKEN)).toBe(true);
  });
  it("draws neither piece on a database without the functions", async () => {
    vi.stubGlobal("fetch", db({}));
    expect(await readMemberHub({ id: "c1", token: TOKEN }, "2026-12-27")).toEqual({ plan: null, month: null });
  });
});

describe("api/account/plan", () => {
  beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  const HEADERS = { origin: "https://micromobility.sa", cookie: `mm_acct=c1~${TOKEN}`, "content-type": "application/json" };
  const post = (body: unknown, headers: Record<string, string> = HEADERS) =>
    POST(new Request("https://micromobility.sa/api/account/plan", { method: "POST", headers, body: JSON.stringify(body) }));

  it("ticks and unticks a Saturday through hub_plan_set with the account's id and token", async () => {
    const fx = db({ hub_plan_set: json({ ok: true, date: "2026-11-21", on: true }) });
    vi.stubGlobal("fetch", fx);
    const r = await post({ date: "2026-11-21", on: true });
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store, private");
    expect(await r.json()).toEqual({ ok: true, date: "2026-11-21", on: true });
    vi.stubGlobal("fetch", db({ hub_plan_set: json({ ok: true, date: "2026-11-21", on: false }) }));
    expect(await (await post({ date: "2026-11-21", on: false })).json()).toEqual({ ok: true, date: "2026-11-21", on: false });
    expect(sent(fx)).toEqual([["hub_plan_set", { p_id: "c1", p_token: TOKEN, p_date: "2026-11-21", p_on: true }]]);
  });
  it("takes only this site's pages, a signed-in account and a day with a tick, asking the database nothing otherwise", async () => {
    const fx = db({ hub_plan_set: json({ ok: true, on: true }) });
    vi.stubGlobal("fetch", fx);
    expect((await post({ date: "2026-11-21", on: true }, { ...HEADERS, origin: "https://evil.example" })).status).toBe(403);
    const out = await post({ date: "2026-11-21", on: true }, { ...HEADERS, cookie: "" });
    expect([out.status, await out.json()]).toEqual([401, { ok: false, error: "signin" }]);
    for (const body of [{ date: "21/11/2026", on: true }, { date: "2026-11-21", on: "yes" }, { date: "2026-11-21" }, {}, null]) {
      const r = await post(body);
      expect([r.status, await r.json()], JSON.stringify(body)).toEqual([400, { ok: false, error: "refused" }]);
    }
    expect(fx).not.toHaveBeenCalled();
  });
  it("says each refusal of the database as its own", async () => {
    const at = async (answer: Response) => { vi.stubGlobal("fetch", db({ hub_plan_set: answer })); const r = await post({ date: "2026-11-07", on: true }); return [r.status, (await r.json()).error]; };
    expect(await at(json({ ok: false, error: "past" }))).toEqual([409, "past"]);
    expect(await at(json({ ok: false, error: "date" }))).toEqual([400, "refused"]);
    expect(await at(json({ ok: false, error: "member" }))).toEqual([403, "member"]);
    expect(await at(json({ ok: false, error: "denied" }))).toEqual([401, "signin"]);
    expect(await at(json({ ok: false, error: "what" }))).toEqual([502, "generic"]);
    expect(await at(json(null))).toEqual([502, "generic"]);
    expect(await at(json({ message: "boom" }, 500))).toEqual([502, "generic"]);
    expect(await at(json({ message: "nope" }, 400))).toEqual([502, "generic"]);
    vi.stubGlobal("fetch", db({}));
    const r = await post({ date: "2026-11-07", on: true });
    expect([r.status, (await r.json()).error]).toEqual([404, "absent"]);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    const n = await post({ date: "2026-11-07", on: true });
    expect([n.status, (await n.json()).error]).toEqual([502, "generic"]);
  });
});
