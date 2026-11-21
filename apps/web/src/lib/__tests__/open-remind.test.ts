import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, isValidElement, type ReactElement } from "react";
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import ExperienceSteps from "@/components/experiences/ExperienceSteps";
import RemindBell from "@/components/site/RemindBell";
import { REMIND_WORDS, remindWords } from "@/components/site/Remind.words";
import { remindable, remindAnswer, remindAt, remindBody, remindEv, remindIcs, remindIcsHref, remindMine, remindWhen } from "../open-remind";
import { resetRides, resetSessionColumns } from "../rides";
import { resetSiteContent } from "../site";
import { LOCALE_CODES } from "../../i18n/locales";
import ExperiencesPage from "../../app/[locale]/experiences/page";
import { GET as OPENS } from "../../app/api/booking-opens/route";
import { POST as REMIND } from "../../app/api/account/remind/route";

// Remind me when booking opens (the booking app's customer features round, 2026-11-19, item 2: _ormAt, _ormMay, _ormBtn,
// _ormOpen, _ormCal, _ormSet, _ormMine; rentals a1d2d564 + 1b77a032, migration 20261119600200), on Experiences.
const jar = vi.hoisted(() => ({ account: "", member: false }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (n === "mm_acct" && jar.account ? { name: n, value: jar.account } : undefined) }) }));
const states = vi.hoisted(() => ({ queue: [] as unknown[] }));
vi.mock("react", async (importOriginal) => {
  const R = await importOriginal<typeof import("react")>();
  return { ...R, useState: ((v: unknown) => R.useState(states.queue.length ? states.queue.shift() : v)) as typeof R.useState };
});
const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;

const AHEAD = "2099-11-19T06:00:00Z"; // 9 AM in Jeddah, the day before the session
const AT = Date.parse(AHEAD);
const POOL = {
  id: "2099-11-20-p", session_date: "2099-11-20", status: "open", event_kind: "community", ride_kind: "swim", title: "Pool session", open_to_all: true, paid_ride: true,
  needs_approval: false, hide_queue: true, capacity: 20, bike_slots: '{"_time":"18:00 - 19:30"}', location: null, meet_url: null, description: null,
  cancelled_at: null, draft: false, opens_at: null, public_at: AHEAD, gender_only: null,
};
const ACCOUNT = "c1~a1b2c3d4e5f6a7b8c9d0";
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
function findAll(n: unknown, type: unknown, out: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(n)) { for (const x of n) findAll(x, type, out); return out; }
  if (!isValidElement(n)) return out;
  if (n.type === type) out.push(n);
  findAll((n.props as { children?: unknown }).children, type, out);
  return out;
}
const db = (sessions: unknown[], o: { content?: unknown[]; satLink?: boolean } = {}) => vi.fn(async (url: string, init?: RequestInit) => {
  if (url.includes("/rpc/list_sessions")) return json(sessions);
  if (url.includes("/rpc/my_bookings")) return json([]);
  if (url.includes("/rpc/community_member")) return json(jar.member);
  if (url.includes("/rpc/saturday_link_only")) return json(o.satLink === true);
  if (url.includes("/rest/v1/site_content")) return json(o.content ?? []);
  if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": "0-0/0" } });
  return json([]);
});
type Props = Parameters<typeof ExperienceSteps>[0];
const experiences = async (sessions: unknown[], o: { content?: unknown[] } = {}) => {
  resetRides();
  vi.stubGlobal("fetch", db(sessions, o));
  const page = await ExperiencesPage({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({}) }); // staging: its page reads ?ev= too
  const props = (findAll(page, ExperienceSteps)[0] as ReactElement<Props>).props;
  return { props, dates: props.events.flatMap((e) => e.sessions) };
};
const draw = (props: Props, ...first: unknown[]) => {
  states.queue = [...first];
  try { return renderToStaticMarkup(createElement(ExperienceSteps, props)); } finally { states.queue = []; }
};
const dateStep = (props: Props) => draw(props, 2, props.events.find((e) => e.sessions.some((s) => s.id === POOL.id)));

beforeEach(() => {
  resetRides(); resetSiteContent(); resetSessionColumns();
  jar.account = ""; jar.member = false; states.queue = [];
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("when booking opens for this visitor (_ormAt)", () => {
  it("is the booking window's opening, or members book first's for a visitor it holds, whichever is later; 0 once open", () => {
    expect(remindAt({ opensAt: 5000 }, 1000)).toBe(5000);
    expect(remindAt({ opensAt: 5000, mf: { at: 9000, held: true } }, 1000)).toBe(9000);
    expect(remindAt({ opensAt: 5000, mf: { at: 9000, held: false } }, 1000)).toBe(5000);
    expect(remindAt({ opensAt: null, mf: { at: 9000, held: false } }, 1000)).toBe(0);
    expect(remindAt({ opensAt: 5000 }, 5000)).toBe(0);
    expect(remindAt({}, 1000)).toBe(0);
  });
});

describe("who may be reminded (_ormMay)", () => {
  const v = { member: false };
  it("is anyone on a date open to all that is not full and that they hold no place on", () => {
    expect(remindable({ kind: "swim", members: false }, v)).toBe(true);
    expect(remindable({ kind: "swim", members: false, full: true }, v)).toBe(false);
    expect(remindable({ kind: "swim", members: false, fbk: true }, v)).toBe(false);
    expect(remindable({ kind: "swim", members: false, held: "ok" }, v)).toBe(false);
  });
  it("is a member on a members' date, a Petromin night's tag holders and those who may book Victory Lap", () => {
    expect(remindable({ kind: "saturday", members: true }, v)).toBe(false);
    expect(remindable({ kind: "saturday", members: true }, { member: true })).toBe(true);
    expect(remindable({ kind: "petromin", members: true }, { member: false, petromin: true })).toBe(true);
    expect(remindable({ kind: "vlap", members: true }, { member: false, vlap: true })).toBe(true);
    expect(remindable({ kind: "vlap", members: true }, { member: false, petromin: true })).toBe(false);
  });
  it("is nobody on a Saturday ride taken by code alone", () => {
    expect(remindable({ kind: "saturday", members: true }, { member: true, satLink: true })).toBe(false);
    expect(remindable({ kind: "swim", members: false }, { member: false, satLink: true })).toBe(true);
  });
});

describe("the calendar file (_icsBody with _ormCal's event)", () => {
  const url = "https://experiences.micromobility.sa/?ev=community&session=2099-11-20-p&lang=en";
  const ics = remindIcs({ id: "2099-11-20-p", at: AT, title: "Booking opens: Pool; session, 2", url }, Date.parse("2099-11-01T00:00:00Z"));
  it("is one 15-minute event at the opening, UID opens-<session>, with an alarm then and ten minutes before", () => {
    const lines = ics.split("\r\n");
    expect(lines.slice(0, 6)).toEqual(["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MicroMobility//Bookings//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT"]);
    expect(lines).toContain("UID:opens-2099-11-20-p@micromobility.sa");
    expect(lines).toContain("DTSTART:20991119T060000Z");
    expect(lines).toContain("DTEND:20991119T061500Z");
    expect(lines).toContain(`SEQUENCE:${Date.parse("2099-11-01T00:00:00Z") / 1000}`);
    expect(lines.filter((x) => x.startsWith("TRIGGER:"))).toEqual(["TRIGGER:PT0M", "TRIGGER:-PT10M"]);
    expect(lines.at(-1)).toBe("END:VCALENDAR");
  });
  it("escapes its text and leads back to the booking app's date", () => {
    expect(ics).toContain("SUMMARY:Booking opens: Pool\\; session\\, 2");
    expect(ics).toContain(`URL:${url}`);
    expect(ics).toContain("DESCRIPTION:https://experiences.micromobility.sa/?ev=community&session=2099-11-20-p&lang=en");
  });
  it("opens the date under its event card in the booking app (_evOf)", () => {
    expect(["jcc", "snd96", "event", "runher", "vlap", "arena", "blood", "workshop", "saturday", "swim", "petromin", "yoga", "farm", "defe5k"].map(remindEv))
      .toEqual(["jcc", "snd96", "event", "runher", "vlap", "arena", "blood", "workshop", "community", "community", "community", "community", "community", "community"]);
    expect(remindIcsHref("2099-11-20-p", "ar")).toBe("/api/booking-opens?s=2099-11-20-p&l=ar");
  });
  it("says when in Riyadh, in the page's language", () => {
    expect(remindWhen(AT, "en")).toBe("Thu 19 Nov · 9 AM");
    expect(remindWhen(Date.parse("2099-11-19T15:30:00Z"), "en")).toBe("Thu 19 Nov · 6:30 PM");
    expect(remindWhen(AT, "ar")).toMatch(/19 نوفمبر · 9:00 ص$/);
    expect(remindWhen(NaN, "en")).toBe("");
  });
});

describe("its words", () => {
  it("are in every language, the booking app's own in English and Arabic", () => {
    expect(Object.keys(REMIND_WORDS).sort()).toEqual([...LOCALE_CODES].sort());
    for (const l of LOCALE_CODES) {
      for (const [k, v] of Object.entries(REMIND_WORDS[l])) expect(v, `${l}.${k}`).toMatch(/\S/);
      expect(REMIND_WORDS[l].opens, l).toContain("{0}");
      expect(REMIND_WORDS[l].icsT, l).toContain("{0}");
    }
    expect(remindWords("en")).toMatchObject({ btn: "Remind me", set: "Reminder set", opens: "Booking opens {0}", cal: "Add to my calendar", upd: "Tell me in Updates", rm: "Remove reminder", icsT: "Booking opens: {0}" });
    expect(remindWords("ar")).toMatchObject({ btn: "ذكّرني", upd: "أخبرني في التحديثات" });
    expect(remindWords("xx")).toBe(REMIND_WORDS.en);
  });
});

// staging: Experiences is staging's own booking flow (BookingFlow), not main's ExperienceSteps, and has no Remind me yet
describe.skip("on Experiences", () => {
  it("rings a date members book first for a visitor it holds, at everyone's time, never for a member", async () => {
    const { props, dates } = await experiences([POOL]);
    expect(dates.find((s) => s.id === POOL.id)?.orm).toEqual({ at: AT, when: "Thu 19 Nov · 9 AM" });
    expect(props.signedIn).toBe(false);
    expect(props.text.remind?.btn).toBe("Remind me");
    const html = dateStep(props);
    expect(html).toContain('class="sc-wrap ev-swim has-about has-orm"');
    expect(html).toMatch(/<button type="button" class="orm-btn" aria-haspopup="dialog" aria-label="Remind me · Pool session · [^"]+"><svg[^>]*>.*?<\/svg><span>Remind me<\/span><\/button>/);
    expect(html).toContain(">Booking opens Thu 19 Nov · 9 AM</h2>");
    expect(html).toContain('href="/api/booking-opens?s=2099-11-20-p&amp;l=en"');
    expect(html).not.toContain("Tell me in Updates"); // signed out: the calendar alone
    jar.account = ACCOUNT; jar.member = true;
    const m = await experiences([POOL]);
    expect(m.dates.find((s) => s.id === POOL.id)?.orm).toBeUndefined();
    expect(dateStep(m.props)).not.toContain("orm-btn");
  });
  it("offers Updates to a signed-in visitor, and rings no date that is full or open to them", async () => {
    jar.account = ACCOUNT;
    const { props, dates } = await experiences([POOL, { ...POOL, id: "2099-11-20-p2", status: "full" }, { ...POOL, id: "2099-11-20-p3", public_at: null }]);
    expect(props.signedIn).toBe(true);
    expect(dates.find((s) => s.id === "2099-11-20-p2")?.orm).toBeUndefined();
    expect(dates.find((s) => s.id === "2099-11-20-p3")?.orm).toBeUndefined();
    expect(dateStep(props)).toContain("Tell me in Updates");
  });
  it("rings a date the booking window holds, at its opening", async () => {
    const day = new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10);
    const { dates } = await experiences([{ ...POOL, id: `${day}-p`, session_date: day, public_at: null }], { content: [{ key: "booking.window", value: { days: 7, at: "09:00" } }] });
    const want = Date.parse(`${new Date(Date.parse(`${day}T00:00:00Z`) - 7 * 864e5).toISOString().slice(0, 10)}T06:00:00Z`);
    expect(dates.find((s) => s.id === `${day}-p`)?.orm?.at).toBe(want);
  });
  it("speaks the page's language and offers Updates to a signed-in visitor, with a Close of its own", () => {
    states.queue = [];
    const bell = (at: number) => renderToStaticMarkup(createElement(RemindBell, { id: POOL.id, at, when: "Thu 19 Nov · 9 AM", label: "Pool session · Friday · 20 Nov", href: "/x", signedIn: true, words: remindWords("ar") }));
    const html = bell(AT);
    expect(html).toContain(">ذكّرني</span>");
    expect(html).toContain("أخبرني في التحديثات");
    expect(html).toContain('aria-label="إغلاق"');
  });
});

describe("api/booking-opens", () => {
  const get = (q: string, headers: Record<string, string> = {}) => OPENS(new Request(`https://micromobility.sa/api/booking-opens?${q}`, { headers }));
  it("writes the date's opening as a calendar file from the session's own row", async () => {
    vi.stubGlobal("fetch", db([POOL]));
    const res = await get("s=2099-11-20-p&l=en");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe('inline; filename="micromobility-opens-20991120.ics"');
    expect(res.headers.get("cache-control")).toBe("no-store, private");
    const body = await res.text();
    expect(body).toContain("DTSTART:20991119T060000Z");
    expect(body).toContain("SUMMARY:Booking opens: Pool session");
    expect(body).toContain("URL:https://experiences.micromobility.sa/?ev=community&session=2099-11-20-p&lang=en");
    expect(body).toContain("UID:opens-2099-11-20-p@micromobility.sa");
  });
  it("speaks the page's language, a circuit night by the booking app's ride name", async () => {
    const jcc = { ...POOL, id: "2099-11-20", event_kind: null, ride_kind: null, title: null, open_to_all: null, bike_slots: '{"_time":"21:00 - 23:00"}' };
    vi.stubGlobal("fetch", db([jcc]));
    const body = await (await get("s=2099-11-20&l=ar")).text();
    expect(body).toContain("SUMMARY:يفتح الحجز: جولة MicroMobility");
    expect(body).toContain("?ev=jcc&session=2099-11-20&lang=ar");
  });
  it("sends a date it cannot remind of back to the page the link was on, else Experiences", async () => {
    vi.stubGlobal("fetch", db([POOL, { ...POOL, id: "2099-11-20-f", status: "full" }]));
    const back = async (q: string, headers: Record<string, string> = {}) => { const r = await get(q, headers); return [r.status, r.headers.get("location")]; };
    expect(await back("s=nope&l=en")).toEqual([303, "https://micromobility.sa/experiences"]);
    expect(await back("s=a%20b")).toEqual([303, "https://micromobility.sa/experiences"]);
    expect(await back("s=2099-11-20-f&l=en", { referer: "https://micromobility.sa/experiences?x=1" })).toEqual([303, "https://micromobility.sa/experiences?x=1"]);
    expect(await back("s=nope", { referer: "https://evil.example/" })).toEqual([303, "https://micromobility.sa/experiences"]);
    // open to a member already: nothing to remind of
    jar.member = true;
    expect(await back(`s=${POOL.id}&l=en`, { cookie: `mm_acct=${ACCOUNT}` })).toEqual([303, "https://micromobility.sa/experiences"]);
  });
  it("never names a Farm House Night to someone who is not a member, nor a Saturday ride taken by code alone", async () => {
    const farm = { ...POOL, id: "2099-11-20-fh", ride_kind: "farm", title: "Farm House Night", open_to_all: false };
    vi.stubGlobal("fetch", db([farm]));
    expect((await get("s=2099-11-20-fh")).status).toBe(303);
    const sat = { ...POOL, id: "2099-11-21", session_date: "2099-11-21", ride_kind: "saturday", title: "Saturday ride", open_to_all: true };
    vi.stubGlobal("fetch", db([sat], { satLink: true }));
    expect((await get("s=2099-11-21")).status).toBe(303);
  });
});

describe("api/account/remind", () => {
  const TOKEN = "a1b2c3d4e5f6a7b8c9d0";
  const HEADERS = { origin: "https://micromobility.sa", cookie: `mm_acct=c1~${TOKEN}`, "content-type": "application/json" };
  const post = (body: unknown, headers: Record<string, string> = HEADERS) =>
    REMIND(new Request("https://micromobility.sa/api/account/remind", { method: "POST", headers, body: JSON.stringify(body) }));
  it("reads the asks through open_reminders_mine and sets one through open_reminder_set, with the cookie's id and token", async () => {
    const f = vi.fn(async (url: string) => (url.includes("open_reminders_mine") ? json({ ok: true, ids: ["2099-11-20-p", 5, "a b"] }) : json({ ok: true, on: true, at: AHEAD })));
    vi.stubGlobal("fetch", f);
    const mine = await post({ op: "mine" });
    expect([mine.status, mine.headers.get("cache-control"), await mine.json()]).toEqual([200, "no-store, private", { ok: true, ids: ["2099-11-20-p"] }]);
    expect(await (await post({ op: "set", session: "2099-11-20-p", on: true })).json()).toEqual({ ok: true, on: true });
    const calls = f.mock.calls as unknown as [string, RequestInit][];
    expect(calls[0][0]).toBe("https://example.supabase.co/rest/v1/rpc/open_reminders_mine");
    expect(JSON.parse(String(calls[0][1].body))).toEqual({ p_id: "c1", p_token: TOKEN });
    expect(calls[1][0]).toBe("https://example.supabase.co/rest/v1/rpc/open_reminder_set");
    expect(JSON.parse(String(calls[1][1].body))).toEqual({ p_id: "c1", p_token: TOKEN, p_session: "2099-11-20-p", p_on: true });
  });
  it("refuses another site, a missing cookie and a body it cannot read without touching the database", async () => {
    const f = vi.fn(async () => json({ ok: true }));
    vi.stubGlobal("fetch", f);
    expect((await post({ op: "mine" }, { ...HEADERS, origin: "https://evil.example" })).status).toBe(403);
    expect(await (await post({ op: "mine" }, { origin: HEADERS.origin })).json()).toEqual({ ok: false, error: "signin" });
    for (const b of [{}, { op: "set", session: "2099-11-20-p" }, { op: "set", session: "a b", on: true }, { op: "set", session: "x", on: "yes" }, null]) expect((await post(b)).status, JSON.stringify(b)).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });
  it("says what the database answered", async () => {
    const said = async (answer: Response, body: unknown = { op: "set", session: "2099-11-20-p", on: true }) => { vi.stubGlobal("fetch", vi.fn(async () => answer)); const r = await post(body); return [r.status, await r.json()]; };
    for (const e of ["none", "booked", "open", "limit"]) expect(await said(json({ ok: false, error: e }))).toEqual([409, { ok: false, error: e }]);
    expect(await said(json({ ok: false, error: "denied" }))).toEqual([401, { ok: false, error: "signin" }]);
    expect(await said(json({ ok: false, error: "denied" }), { op: "mine" })).toEqual([401, { ok: false, error: "signin" }]);
    expect(await said(json({ code: "PGRST202", message: "Could not find the function public.open_reminder_set" }, 404))).toEqual([404, { ok: false, error: "absent" }]);
    expect(await said(json({ message: "boom" }, 500), { op: "mine" })).toEqual([502, { ok: false, error: "generic" }]);
  });
  it("reads its body and the database's answers safely", () => {
    expect(remindBody({ op: "mine", session: "x" })).toEqual({ op: "mine" });
    expect(remindBody({ op: "set", session: "2099-11-20-p", on: false })).toEqual({ op: "set", session: "2099-11-20-p", on: false });
    expect(remindAnswer({ ok: true, on: false })).toEqual({ ok: true, on: false });
    expect(remindAnswer({ ok: false, error: "weird" })).toEqual({ ok: false, error: "generic" });
    expect(remindMine({ ok: true, ids: "x" })).toEqual({ ok: false, error: "generic" });
    expect(remindMine(null)).toEqual({ ok: false, error: "generic" });
  });
});
