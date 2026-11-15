import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, isValidElement, type ReactElement } from "react";
// The site has no @types/react-dom; this test needs one function of it (as rating.test.ts does).
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import ExperienceSteps, { type StepSession } from "@/components/experiences/ExperienceSteps";
import { dictOf } from "@/i18n/dicts";
import { TRANSLATED } from "@/i18n/locales";
import { infoPlaces } from "../event-info";
import { fewOf, resetRides, toSession } from "../rides";
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
