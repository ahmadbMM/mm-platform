import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, isValidElement, type ReactElement } from "react";
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import ExperienceSteps from "@/components/experiences/ExperienceSteps";
import BookingFlow from "@/components/experiences/BookingFlow";
import { mfAt, mfHeld } from "../members-first";
import { resetRides, resetSessionColumns, toSession } from "../rides";
import { resetSiteContent } from "../site";
import { MEMBERS_FIRST_WORDS, membersFirstWords } from "../../components/experiences/MembersFirst.words";
import { LOCALES } from "../../i18n/locales";
import ExperiencesPage from "../../app/[locale]/experiences/page";
import EventsPage from "../../app/[locale]/events/page";

// Members book first (the user, 2026-11-18; rentals 6a6444d4, migration 20261118210800), on Experiences and Events as the
// booking app shows it: until sessions.public_at a member sees "Members first" and books, anyone else sees the date held,
// "Members book first" and "Everyone from <day time>"; every visitor's Details say it. The site books none of these itself.
const jar = vi.hoisted(() => ({ account: "", member: false }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (n === "mm_acct" && jar.account ? { name: n, value: jar.account } : undefined) }) }));
const states = vi.hoisted(() => ({ queue: [] as unknown[] }));
vi.mock("react", async (importOriginal) => {
  const R = await importOriginal<typeof import("react")>();
  return { ...R, useState: ((v: unknown) => R.useState(states.queue.length ? states.queue.shift() : v)) as typeof R.useState };
});
const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;

const AHEAD = "2099-11-19T06:00:00Z"; // 9 AM in Jeddah, the day before the session
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
const db = (sessions: unknown[]) => vi.fn(async (url: string, init?: RequestInit) => {
  if (url.includes("/rpc/list_sessions")) return json(sessions);
  if (url.includes("/rpc/my_bookings")) return json([]);
  if (url.includes("/rpc/community_member")) return json(jar.member);
  if (url.includes("/rpc/customer_profile")) return json(jar.account ? [{ id: "c1", name: "Sara Ali" }] : []); // staging's page reads the account
  if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": "0-0/0" } });
  return json([]);
});
type Props = Parameters<typeof ExperienceSteps>[0];
const experiences = async (sessions: unknown[], locale = "en") => {
  resetRides();
  const f = db(sessions);
  vi.stubGlobal("fetch", f);
  const page = await ExperiencesPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) });
  const props = (findAll(page, ExperienceSteps)[0] as ReactElement<Props>).props;
  return { props, dates: props.events.flatMap((e) => e.sessions), f };
};
const draw = (props: Props, ...first: unknown[]) => {
  states.queue = [...first];
  try { return renderToStaticMarkup(createElement(ExperienceSteps, props)); } finally { states.queue = []; }
};
const dateStep = (props: Props) => draw(props, 2, props.events.find((e) => e.sessions.some((s) => s.id === POOL.id)));
// Staging's Experiences is its own booking flow (BookingFlow), which books on the site: what it hands its flow, and the
// flow opened on the event of the date
type FlowProps = Parameters<typeof BookingFlow>[0];
const flow = async (sessions: unknown[], locale = "en") => {
  resetRides();
  const f = db(sessions);
  vi.stubGlobal("fetch", f);
  const page = await ExperiencesPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) });
  const props = (findAll(page, BookingFlow)[0] as ReactElement<FlowProps>).props;
  return { props, dates: props.events.flatMap((e) => e.sessions), f };
};
const flowDates = (props: FlowProps) => renderToStaticMarkup(createElement(BookingFlow, { ...props, start: { ev: props.events.find((e) => e.sessions.some((s) => s.id === POOL.id))?.key ?? null, session: null } }));
const eventsPage = async (sessions: unknown[], locale = "en") => {
  resetRides();
  vi.stubGlobal("fetch", db(sessions));
  const page = await EventsPage({ params: Promise.resolve({ locale }) });
  return renderToStaticMarkup((page.props as { children: ReactElement }).children);
};

beforeEach(() => {
  resetRides(); resetSiteContent(); resetSessionColumns();
  jar.account = ""; jar.member = false; states.queue = [];
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("the window (lib/members-first.ts)", () => {
  it("lasts until public_at, and holds a visitor who is not a member", () => {
    const now = Date.parse("2099-11-19T05:00:00Z");
    expect(mfAt({ publicAt: AHEAD }, now)).toBe(Date.parse(AHEAD));
    expect(mfAt({ publicAt: AHEAD }, Date.parse(AHEAD))).toBe(0);
    expect(mfAt({ publicAt: "soon" }, now)).toBe(0);
    expect(mfAt({}, now)).toBe(0);
    expect(mfHeld({ publicAt: AHEAD }, false, now)).toBe(true);
    expect(mfHeld({ publicAt: AHEAD }, true, now)).toBe(false);
  });
  it("is read with the row, as riders may read it", async () => {
    expect(toSession(POOL)?.publicAt).toBe(AHEAD);
    expect("publicAt" in toSession({ ...POOL, public_at: null })!).toBe(false);
    expect("publicAt" in toSession({ ...POOL, public_at: undefined })!).toBe(false);
    const { f } = await flow([POOL]); // staging: its own booking flow
    expect(f.mock.calls.map((c) => String(c[0])).find((u) => u.includes("/rpc/list_sessions"))).toContain(",public_at&");
  });
  it("is left out on a database without the column, which holds nobody", async () => {
    resetRides();
    const old = vi.fn(async (url: string) => (url.includes("/rpc/list_sessions") ? (url.includes("public_at") ? json({ code: "42703", message: "column list_sessions.public_at does not exist" }, 400) : json([{ ...POOL, public_at: undefined }])) : json([])));
    vi.stubGlobal("fetch", old);
    const page = await ExperiencesPage({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({}) });
    const dates = (findAll(page, BookingFlow)[0] as ReactElement<FlowProps>).props.events.flatMap((e) => e.sessions); // staging: its own booking flow
    expect(dates.find((s) => s.id === POOL.id)?.mf).toBeUndefined();
  });
});

describe("Experiences", () => {
  // staging's Experiences page is its own booking flow; ported when staging's page takes main's date step and its Details (its date cards hold the date: staging's booking flow, below)
  it.skip("holds the date from a visitor who is not a member: its status behind a lock, when everyone may under its time, not a choice", async () => {
    const { props, dates } = await experiences([POOL]);
    const d = dates.find((s) => s.id === POOL.id)!;
    expect(d.mf).toEqual({ at: Date.parse(AHEAD), held: true, everyone: "Everyone from Thursday · 19 Nov 2099 · 9 AM" });
    expect(d.info.mf).toEqual({ label: "Members book first", text: "Everyone from Thursday · 19 Nov 2099 · 9 AM" });
    const html = dateStep(props);
    const card = /<button type="button" class="sc-card[^"]*"[^>]*data-id="2099-11-20-p".*?<\/button>/.exec(html)?.[0] ?? "";
    expect(card).toMatch(/class="sc-card ev-swim closed/);
    expect(card).toContain('disabled=""');
    expect(card).toMatch(/<span class="sc-spots closed mf"><svg[^]*?<\/svg><span>Members book first<\/span><\/span>/);
    expect(card).toMatch(/<span class="sc-meta sc-mf-l"><svg[^]*?<\/svg><bdi>Everyone from Thursday · 19 Nov 2099 · 9 AM<\/bdi><\/span>/);
  });
  // staging's Experiences page is its own booking flow; ported when staging's page takes main's date step and its Details (its date cards hold the date: staging's booking flow, below)
  it.skip("gives a member the mark and the date to book", async () => {
    jar.account = ACCOUNT; jar.member = true;
    const { props, dates } = await experiences([POOL]);
    expect(dates.find((s) => s.id === POOL.id)?.mf?.held).toBe(false);
    const card = /<button type="button" class="sc-card[^"]*"[^>]*data-id="2099-11-20-p".*?<\/button>/.exec(dateStep(props))?.[0] ?? "";
    expect(card).not.toContain("closed");
    expect(card).not.toContain('disabled=""');
    expect(card).toMatch(/<span class="sc-spots mf"><svg[^]*?<\/svg><span>Members first<\/span><\/span>/);
    expect(card).not.toContain("sc-mf-l");
  });
  // staging's Experiences page is its own booking flow; ported when staging's page takes main's date step and its Details (its date cards hold the date: staging's booking flow, below)
  it.skip("says a booking window not open yet first, and nothing once everyone may book", async () => {
    const { props } = await experiences([POOL]);
    const win = { ...props, events: props.events.map((e) => ({ ...e, sessions: e.sessions.map((s) => ({ ...s, opens: "Booking opens Thu 19 Nov" })) })) };
    const card = /<button type="button" class="sc-card[^"]*"[^>]*data-id="2099-11-20-p".*?<\/button>/.exec(dateStep(win))?.[0] ?? "";
    expect(card).toContain("Booking opens Thu 19 Nov");
    expect(card).not.toContain("Members book first");
    const { dates } = await experiences([{ ...POOL, public_at: "2020-01-01T00:00:00Z" }]);
    expect(dates.find((s) => s.id === POOL.id)?.mf).toBeUndefined();
    expect(dates.find((s) => s.id === POOL.id)?.info.mf).toBeUndefined();
  });
  // staging's Experiences page is its own booking flow; ported when staging's page takes main's date step and its Details (its date cards hold the date: staging's booking flow, below)
  it.skip("speaks Arabic", async () => {
    const { dates, props } = await experiences([POOL], "ar");
    expect(props.text.mf).toEqual({ mark: "للأعضاء أولًا", status: "الحجز للأعضاء أولًا" });
    expect(dates.find((s) => s.id === POOL.id)?.mf?.everyone).toMatch(/^للجميع من /);
  });
});

// Staging's booking flow books on the site, so a date held from a visitor who is not a member takes the booking window's path:
// greyed, "Members book first" behind a lock, when everyone may under its time, and nothing chooses it (the database refuses
// such a booking anyway: MEMBERS_FIRST). A member sees "Members first" on the date and chooses it.
describe("staging's booking flow (BookingFlow)", () => {
  const EVERYONE = "Everyone from Thursday · 19 Nov 2099 · 9 AM";
  it("holds the date from a visitor who is not a member: its status behind a lock, when everyone may under its time, not a choice", async () => {
    for (const [account, member] of [["", false], [ACCOUNT, false]] as const) {
      jar.account = account; jar.member = member;
      const { props, dates } = await flow([POOL]);
      const d = dates.find((s) => s.id === POOL.id)!;
      expect(d.mf, account).toEqual({ held: true, label: "Members book first", everyone: EVERYONE });
      expect(d.opens, account).toBe(EVERYONE); // nothing chooses it (BookingFlow pick, the address's ?session= too)
      const card = /<div class="sc-card ev-swim closed"[^>]*>.*?<\/div>/.exec(flowDates(props))?.[0] ?? "";
      expect(card, account).toContain('aria-disabled="true"');
      expect(card, account).toMatch(/<span class="sc-spots closed mf"><svg[^]*?<\/svg>Members book first<\/span>/);
      expect(card, account).toMatch(new RegExp(`<span class="sc-meta sc-mf-l"><svg[^]*?</svg><bdi>${EVERYONE}</bdi></span>`));
    }
  });
  it("gives a member the mark and the date to choose", async () => {
    jar.account = ACCOUNT; jar.member = true;
    const { props, dates } = await flow([POOL]);
    const d = dates.find((s) => s.id === POOL.id)!;
    expect(d.mf).toEqual({ held: false, label: "Members first", everyone: EVERYONE });
    expect(d.opens).toBeNull();
    const card = /<button type="button" class="sc-card ev-swim[^"]*"[^>]*data-id="2099-11-20-p".*?<\/button>/.exec(flowDates(props))?.[0] ?? "";
    expect(card).not.toContain("closed");
    expect(card).toMatch(/<span class="sc-spots mf"><svg[^]*?<\/svg>Members first<\/span>/);
    expect(card).not.toContain("sc-mf-l");
  });
  it("says nothing once everyone may book, and speaks Arabic", async () => {
    const { dates } = await flow([{ ...POOL, public_at: "2020-01-01T00:00:00Z" }]);
    expect(dates.find((s) => s.id === POOL.id)?.mf).toBeUndefined();
    expect(dates.find((s) => s.id === POOL.id)?.opens).toBeNull();
    const ar = (await flow([POOL], "ar")).dates.find((s) => s.id === POOL.id)!;
    expect(ar.mf).toMatchObject({ held: true, label: "الحجز للأعضاء أولًا" });
    expect(ar.mf?.everyone).toMatch(/^للجميع من /);
    expect(ar.opens).toBe(ar.mf?.everyone);
  });
});

describe("Events", () => {
  it("tags the date and, in place of Book, says when everyone may to a visitor who is not a member", async () => {
    const html = await eventsPage([POOL]);
    expect(html).toContain('<em class="mf warn">Members book first</em>');
    expect(html).toMatch(/<span class="pg-opens pg-wait"><svg[^]*?<\/svg><span>Everyone from Thursday · 19 Nov 2099 · 9 AM<\/span><\/span>/);
    expect(html).toContain("pg-event is-closed");
  });
  it("gives a member the mark and Book", async () => {
    jar.account = ACCOUNT; jar.member = true;
    const html = await eventsPage([POOL]);
    expect(html).toContain('<em class="mf">Members first</em>');
    expect(html).not.toContain("Everyone from");
    expect(html).toMatch(/<a href="[^"]*session=2099-11-20-p[^"]*">/);
  });
});

describe("the words", () => {
  it("are the booking app's in the languages it speaks, and there in all 16", () => {
    for (const l of LOCALES) {
      const w = MEMBERS_FIRST_WORDS[l.code];
      for (const v of Object.values(w)) expect(v.trim(), l.code).not.toBe("");
      expect(w.everyone.split("{0}").length, l.code).toBe(2);
      expect(Object.values(w).join(" "), l.code).not.toMatch(/\p{Extended_Pictographic}|[०-९০-৯٠-٩۰-۹]/u);
    }
    expect(MEMBERS_FIRST_WORDS.fr).toEqual({ mark: "Membres en priorité", status: "Les membres réservent en premier", everyone: "Ouvert à tous dès {0}" });
    expect(MEMBERS_FIRST_WORDS.bn.everyone).toBe("{0} থেকে সবার জন্য");
    expect(membersFirstWords("xx")).toBe(MEMBERS_FIRST_WORDS.en);
  });
});
