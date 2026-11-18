import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, isValidElement, type ReactElement } from "react";
// The site has no @types/react-dom; this test needs one function of it (as rating.test.ts does).
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import ExperienceSteps, { type StepSession } from "@/components/experiences/ExperienceSteps";
import { dictOf } from "@/i18n/dicts";
import { TRANSLATED } from "@/i18n/locales";
import { infoPlaces } from "../event-info";
import { fewAtOf, fewOf, resetRides, toSession } from "../rides";
import { resetSiteContent } from "../site";
import ExperiencesPage from "../../app/[locale]/experiences/page";

// cookies() is a request's; here it holds the account's cookie a test sets, or none.
const jar = vi.hoisted(() => ({ account: "" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (n === "mm_acct" && jar.account ? { name: n, value: jar.account } : undefined) }) }));
// The steps open on the event cards (useState(1)); a test draws a later step by handing the component's first states in
// order: the step, the event. Each render takes them once.
const states = vi.hoisted(() => ({ queue: [] as unknown[] }));
vi.mock("react", async (importOriginal) => {
  const R = await importOriginal<typeof import("react")>();
  return { ...R, useState: ((v: unknown) => R.useState(states.queue.length ? states.queue.shift() : v)) as typeof R.useState };
});
const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;

// Few spots left (the user, 2026-11-15: "in the farmhouse session show everywhere that there are few spots remaining on
// the event card too"), on the website as in the booking app (_sessFew): staff switch it on a session (bike_slots._few),
// and its date card, its Featured card and its Details say "Few spots left", on a ride staff approve too, which never
// counts its places out loud. A count of three or fewer still says itself where a ride counts.

const comm = (id: string, kind: string, slots: string, more: Record<string, unknown> = {}) => ({
  id, session_date: id.slice(0, 10), status: "open", event_kind: "community", ride_kind: kind, title: null, open_to_all: false, paid_ride: false,
  needs_approval: true, hide_queue: true, capacity: 130, bike_slots: slots, location: null, meet_url: null, description: null,
  cancelled_at: null, draft: false, opens_at: null, ...more,
});
const FH = comm("2099-11-19-fh", "farm", '{"_time":"16:30 - 20:30","_few":1}', { title: "The Farmhouse Night", location: "Farmhouse, Dhahban" });
const SAT = comm("2099-11-21", "saturday", '{"_time":"05:45 - 06:15"}', { capacity: 40 });
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
  if (url.includes("/rpc/community_member")) return json(!!jar.account);
  if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": "0-0/0" } });
  return json([]);
});
type Props = Parameters<typeof ExperienceSteps>[0];
const experiences = async (sessions: unknown[], locale = "en") => {
  resetRides();
  vi.stubGlobal("fetch", db(sessions));
  const page = await ExperiencesPage({ params: Promise.resolve({ locale }) });
  const props = (findAll(page, ExperienceSteps)[0] as ReactElement<Props>).props;
  return { props, dates: props.events.flatMap((e) => e.sessions) };
};
const draw = (props: Props, ...first: unknown[]) => {
  states.queue = [...first];
  try { return renderToStaticMarkup(createElement(ExperienceSteps, props)); } finally { states.queue = []; }
};
const dateStep = (props: Props, key = "community") => draw(props, 2, props.events.find((e) => e.key === key));
const FEW = '<span class="sc-spots low">Few spots left</span>';

beforeEach(() => {
  resetRides(); resetSiteContent();
  jar.account = ACCOUNT; states.queue = [];
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("which dates say it (lib/rides.ts fewOf)", () => {
  it("an open date staff marked, its settings as JSON text or an object; never a full one or one closed", () => {
    expect(fewOf(FH)).toBe(true);
    expect(fewOf({ ...FH, bike_slots: { _time: "16:30 - 20:30", _few: 1 } })).toBe(true);
    expect(fewOf({ ...FH, bike_slots: '{"_time":"16:30 - 20:30"}' })).toBe(false);
    expect(fewOf({ ...FH, bike_slots: '{"_few":0}' })).toBe(false);
    expect(fewOf({ ...FH, bike_slots: "not json" })).toBe(false);
    expect(fewOf({ ...FH, status: "full" })).toBe(false);
    expect(fewOf({ ...FH, status: "closed" })).toBe(false);
    expect(toSession(FH)).toMatchObject({ id: FH.id, kind: "farm", approval: true, few: true });
    expect("few" in toSession(SAT)!).toBe(false);
  });
});

describe("Details (lib/event-info.ts infoPlaces)", () => {
  const t = { waitlist: "Waitlist", left1: "{0} spot left", leftN: "{0} spots left", fbk: "Fully booked", few: "Few spots left" };
  it("says it on a ride staff approve, where nothing was said before", () => {
    expect(infoPlaces({ approval: true, full: false, left: null, few: true }, t)).toBe("Few spots left");
    expect(infoPlaces({ approval: true, full: false, left: null }, t)).toBeNull();
  });
  it("says it in place of a long count, and keeps a count of three or fewer, the waitlist and Fully booked", () => {
    expect(infoPlaces({ approval: false, full: false, left: 30, few: true }, t)).toBe("Few spots left");
    expect(infoPlaces({ approval: false, full: false, left: null, few: true }, t)).toBe("Few spots left");
    expect(infoPlaces({ approval: false, full: false, left: 2, few: true }, t)).toBe("2 spots left");
    expect(infoPlaces({ approval: false, full: false, left: 0, few: true }, t)).toBe("Waitlist");
    expect(infoPlaces({ approval: false, full: true, left: null, few: true }, t)).toBe("Waitlist");
    expect(infoPlaces({ approval: true, full: false, left: null, fbk: true, few: true }, t)).toBe("Fully booked");
    expect(infoPlaces({ approval: false, full: false, left: 30, few: true, kind: "vlap" }, t)).toBe("Few spots left");
    expect(infoPlaces({ approval: false, full: false, left: 30 }, t)).toBe("30 spots left");
  });
});

describe("Experiences", () => {
  it("gives the marked date its flag and its Details the words; the date beside it has neither", async () => {
    const { props, dates } = await experiences([FH, SAT]);
    const by = Object.fromEntries(dates.map((s) => [s.id, s]));
    expect(by[FH.id]).toMatchObject({ few: true });
    expect(by[FH.id].info.places).toBe("Few spots left");
    expect("few" in by[SAT.id]).toBe(false);
    expect(by[SAT.id].info.places ?? null).toBeNull();
    expect(props.text.few).toBe("Few spots left");
  });
  it("draws it on the farm's date card and on its Featured card, and not on the Saturday ride's", async () => {
    const { props } = await experiences([FH, SAT]);
    const html = dateStep(props);
    const fh = /<button type="button" class="sc-card[^"]*sc-farm[^"]*".*?<\/button>/.exec(html)?.[0] ?? "";
    expect(fh).toContain(FEW);
    expect(html.match(/Few spots left/g)).toHaveLength(1);
    const feat = /<section class="xs-feat".*?<\/section>/.exec(draw(props))?.[0] ?? "";
    expect(feat).toContain(FEW);
  });
  it("says the visitor's own place, or the waitlist, over it", async () => {
    const { props } = await experiences([FH]);
    const with_ = (o: Partial<StepSession>) => dateStep({ ...props, events: props.events.map((e) => ({ ...e, sessions: e.sessions.map((s) => ({ ...s, ...o })) })) });
    expect(with_({ full: true })).not.toContain("Few spots left");
    expect(with_({ held: "rsv" })).not.toContain("Few spots left");
  });
  it("says it in Arabic", async () => {
    const { props, dates } = await experiences([FH, SAT], "ar");
    expect(props.text.few).toBe("أماكن قليلة متبقية");
    expect(dates.find((s) => s.id === FH.id)?.info.places).toBe("أماكن قليلة متبقية");
  });
});

describe("the words", () => {
  // the booking app's fewSpots, word for word in the languages it speaks
  const APP: Record<string, string> = {
    bn: "অল্প কয়েকটি জায়গা বাকি", es: "Quedan pocas plazas", fr: "Plus que quelques places", hi: "कुछ ही जगहें बचीं",
    ne: "थोरै ठाउँ मात्र बाँकी", pt: "Poucas vagas restantes", tl: "Kaunting puwesto na lang", ur: "چند ہی جگہیں باقی",
  };
  it("are the booking app's in the languages it speaks", () => {
    for (const [code, want] of Object.entries(APP)) expect(dictOf(code)!["Few spots left"], code).toBe(want);
  });
  it("are said in every language the site translates, short, with no emoji", () => {
    for (const code of TRANSLATED) {
      const v = dictOf(code)!["Few spots left"];
      expect(v?.trim(), code).toBeTruthy();
      expect(v.length, `${code} ${v}`).toBeLessThanOrEqual(30);
      expect(v, code).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});

// Few spots left turns itself on (the user's pick 4 of the staff Bookings round, 2026-11-18: "Automatic Few spots left.
// The switch turns itself on once places left drop to a number staff set"), as the booking app's _sessFew: staff set
// bike_slots._fewAt, and once the places left reach it the date says Few spots left. A ride staff approve counts its own
// places (spots, else capacity) less the requests holding one, a waitlisted request not; a ride nobody approves counts
// as its "N spots left" does, and only when its capacity is set.
describe("automatic (bike_slots._fewAt)", () => {
  const taken = (by: Record<string, number>) => vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/rpc/list_sessions")) return json(rows);
    if (url.includes("/rpc/my_bookings")) return json([]);
    if (url.includes("/rpc/community_member")) return json(!!jar.account);
    if (init?.method === "HEAD") {
      const id = /session_id=eq\.([^&]+)/.exec(url)?.[1] ?? "";
      return new Response(null, { status: 200, headers: { "content-range": `0-0/${by[id] ?? 0}` } });
    }
    return json([]);
  });
  let rows: unknown[] = [];
  const page = async (list: unknown[], by: Record<string, number>) => {
    rows = list; resetRides();
    const f = taken(by);
    vi.stubGlobal("fetch", f);
    const p = await ExperiencesPage({ params: Promise.resolve({ locale: "en" }) });
    const props = (findAll(p, ExperienceSteps)[0] as ReactElement<Props>).props;
    const heads = f.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === "HEAD").map((c) => String(c[0]));
    return { by: Object.fromEntries(props.events.flatMap((e) => e.sessions).map((s) => [s.id, s])), heads };
  };
  const FA = comm("2099-11-19-fh", "farm", '{"_time":"16:30 - 20:30","_fewAt":10}', { title: "The Farmhouse Night", capacity: 130, spots: 40 });
  const JCC = (id: string, slots: string, more: Record<string, unknown> = {}) => ({
    id, session_date: id.slice(0, 10), status: "open", event_kind: null, ride_kind: null, title: null, open_to_all: false, paid_ride: false,
    capacity: 20, bike_slots: slots, location: null, meet_url: null, description: null, cancelled_at: null, draft: false, opens_at: null, ...more,
  });

  it("reads the number: a whole number 1-999 on an open date whose switch is off", () => {
    expect(fewAtOf('{"_fewAt":10}')).toBe(10);
    expect(fewAtOf({ _fewAt: 999 })).toBe(999);
    for (const v of ['{"_fewAt":0}', '{"_fewAt":1000}', '{"_fewAt":2.5}', '{"_fewAt":"x"}', "{}", "not json", null]) expect(fewAtOf(v)).toBe(0);
    expect(toSession(FA)).toMatchObject({ fewAt: 10, spots: 40 });
    expect("few" in toSession(FA)!).toBe(false);
    expect("fewAt" in toSession({ ...FA, status: "full" }, true)!).toBe(false);
    expect("fewAt" in toSession(FH)!).toBe(false); // the switch already says it
  });

  it("a ride staff approve: on once its own places less the requests holding one reach the number, a waitlisted one not counted", async () => {
    const on = await page([FA], { [FA.id]: 30 }); // 40 - 30 = 10
    expect(on.by[FA.id]).toMatchObject({ few: true });
    expect(on.by[FA.id].info.places).toBe("Few spots left");
    expect(on.heads).toHaveLength(1);
    expect(on.heads[0]).toContain(`session_id=eq.${FA.id}&status=not.in.(cancelled,removed,noshow,waitlist)`);
    const off = await page([FA], { [FA.id]: 29 }); // 11 left
    expect("few" in off.by[FA.id]).toBe(false);
    expect(off.by[FA.id].info.places ?? null).toBeNull(); // a ride staff approve never says its count
    const cap = await page([{ ...FA, spots: null }], { [FA.id]: 125 }); // no places of its own: the capacity, 130 - 125
    expect(cap.by[FA.id]).toMatchObject({ few: true });
  });

  it("a ride nobody approves: at the number its N spots left reaches, only with its capacity set", async () => {
    const A = JCC("2099-11-20", '{"_time":"21:00 - 23:00","_fewAt":5}');
    const on = await page([A], { [A.id]: 15 }); // 20 - 15 = 5
    expect(on.by[A.id]).toMatchObject({ few: true });
    expect(on.by[A.id].info.places).toBe("Few spots left");
    expect(on.heads[0]).toContain("status=not.in.(cancelled,removed,noshow)&");
    const off = await page([A], { [A.id]: 14 });
    expect("few" in off.by[A.id]).toBe(false);
    expect(off.by[A.id].info.places).toBe("6 spots left");
    const noCap = await page([{ ...A, capacity: null }], { [A.id]: 8 }); // 12 by default, 4 left, but nothing set to count from
    expect("few" in noCap.by[A.id]).toBe(false);
    const three = await page([A], { [A.id]: 18 }); // a count of three or fewer still says itself
    expect(three.by[A.id].info.places).toBe("2 spots left");
  });

  it("never on a full date, nor without the number", async () => {
    const A = JCC("2099-11-20", '{"_time":"21:00 - 23:00","_fewAt":5}');
    const full = await page([{ ...A, status: "full" }], { [A.id]: 20 });
    expect("few" in full.by[A.id]).toBe(false);
    const none = await page([{ ...FA, bike_slots: '{"_time":"16:30 - 20:30"}' }], { [FA.id]: 39 });
    expect("few" in none.by[FA.id]).toBe(false);
    expect(none.heads).toHaveLength(0); // a ride staff approve without the number is not counted at all
  });
});
