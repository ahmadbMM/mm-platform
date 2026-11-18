import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, isValidElement, type ReactElement } from "react";
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import BookingFlow from "@/components/experiences/BookingFlow";
import { resetRides } from "../rides";
import { resetSiteContent } from "../site";
import ExperiencesPage from "../../app/[locale]/experiences/page";

// The Experiences booking flow's event cards say the caps the database enforces through {riders} and {seats} (jccNote,
// evNote), filled as main's Experiences fills them: left as written they reached the rider as "{riders}" (bug hunt
// 2026-11-10, web13-1). No account cookie here unless a test signs one in (jar.account).
const jar = vi.hoisted(() => ({ account: "" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (n === "mm_acct" && jar.account ? { name: n, value: jar.account } : undefined) }) }));
const SIGNED = "c1~a1b2c3d4e5f6a7b8c9d0";
const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const JCC = { id: "2099-11-08", session_date: "2099-11-08", day: "Sunday", status: "open", event_kind: null, ride_kind: null, title: null, capacity: 40, bike_slots: '{"_time":"21:00 - 23:00"}', location: "JCC", meet_url: null };
const EV = { id: "2099-11-09-ev", session_date: "2099-11-09", day: "Monday", status: "open", event_kind: "community", ride_kind: "event", title: "Talk", open_to_all: true, paid_ride: true, price: 40, capacity: 30, bike_slots: '{"_time":"19:00 - 21:00"}' };

function findAll(n: unknown, type: unknown, out: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(n)) { for (const x of n) findAll(x, type, out); return out; }
  if (!isValidElement(n)) return out;
  if (n.type === type) out.push(n);
  findAll((n.props as { children?: unknown }).children, type, out);
  return out;
}

beforeEach(() => {
  resetRides(); resetSiteContent();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).includes("/rpc/list_sessions")) return json([JCC, EV]);
    if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": "0-0/0" } });
    return json([]);
  }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); jar.account = ""; });

describe("the Experiences booking flow's event cards", () => {
  for (const locale of ["en", "ar", "de"]) {
    it(`say the caps, never the placeholders (${locale})`, async () => {
      const page = await ExperiencesPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({ ev: "community" }) });
      const flow = findAll(page, BookingFlow)[0] as ReactElement<Parameters<typeof BookingFlow>[0]>;
      const events = flow.props.events;
      expect(events.map((e) => e.key)).toEqual(expect.arrayContaining(["jcc", "event"]));
      for (const e of events) expect(e.note).not.toMatch(/\{(riders|seats)\}/);
      if (locale === "en") {
        expect(events.find((e) => e.key === "jcc")!.note).toMatch(/^Up to 3 riders per account/);
        expect(events.find((e) => e.key === "event")!.note).toContain("Up to 5 seats per booking");
      }
    });
  }
});

// The hand merge of main's bcb648e6 (2026-11-13). Yoga (ride_kind 'yoga', 2026-11-12) is a kind of its own in lib/rides.ts
// now: this booking flow has no step for it (lib/booking.ts NO_BIKE), so its date is listed inside the community card, as
// main's page lists it, and hands over to the booking app (BookSession.handoff, bug hunt 2026-11-18, stg-diff0-2); it is
// never read as a Saturday ride. A session's Arabic name (sessions.title_ar, 2026-11-13) names it on the Arabic page, as
// main's page and Events name it.
describe("the Experiences booking flow after main's yoga and Arabic names", () => {
  const comm = (id: string, kind: string, more: Record<string, unknown> = {}) => ({
    id, session_date: id.slice(0, 10), status: "open", event_kind: "community", ride_kind: kind, title: null, open_to_all: false, paid_ride: false,
    needs_approval: false, capacity: 15, bike_slots: '{"_time":"16:00 - 17:30"}', location: null, meet_url: null, ...more,
  });
  const YG = comm("2099-11-21-yg", "yoga", { location: "SILKDEER", meet_url: "https://maps.app.goo.gl/TfCSEPEPxA4C5f7d7" });
  const SAT = comm("2099-11-16", "saturday", { title: "Sunrise Ride", title_ar: " جولة الشروق ", needs_approval: true, capacity: 40, bike_slots: '{"_time":"05:45 - 06:15"}' });
  // `answers`: what the account's checks say when one is signed in (community_member, petromin_member)
  const flowOf = async (sessions: unknown[], locale: string, answers: Record<string, unknown> = {}) => {
    resetRides();
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/rpc/list_sessions")) return json(sessions);
      if (String(url).includes("/rpc/customer_profile")) return json([{ id: "c1", name: "Sara Ali", gender: "female" }]);
      const fn = /\/rpc\/([a-z_]+)/.exec(String(url))?.[1] ?? "";
      if (fn in answers) return json(answers[fn]);
      if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": "0-0/0" } });
      return json([]);
    }));
    const page = await ExperiencesPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({ ev: "community" }) });
    return (findAll(page, BookingFlow)[0] as ReactElement<Parameters<typeof BookingFlow>[0]>).props;
  };

  it("lists a yoga date inside the community card, handed to the booking app, and reads none as a Saturday ride", async () => {
    for (const locale of ["en", "ar"]) {
      const { events, routes } = await flowOf([YG, SAT, JCC], locale);
      expect(events.map((e) => e.key), locale).toEqual(["jcc", "community"]); // this flow's own order of cards
      const dates = events.flatMap((e) => e.sessions);
      expect(dates.map((s) => [s.id, s.kind]), locale).toEqual([["2099-11-08", "jcc"], ["2099-11-16", "saturday"], ["2099-11-21-yg", "yoga"]]);
      // booked in the booking app on the community card and that date; the Saturday ride is booked here
      expect(dates.find((s) => s.kind === "yoga")!.handoff, locale).toMatch(new RegExp(`[?&]lang=${locale}&ev=community&session=2099-11-21-yg$`));
      expect(dates.find((s) => s.kind === "saturday")!.handoff ?? null, locale).toBeNull();
      expect(Object.keys(routes ?? {}), locale).not.toContain("2099-11-21-yg");
    }
    // with nothing but yoga on the books the community card lists it, and its card goes to the booking app
    const only = await flowOf([YG], "en");
    expect(only.events.find((e) => e.key === "community")!.sessions.map((s) => s.id)).toEqual(["2099-11-21-yg"]);
    const html = renderToStaticMarkup(createElement(BookingFlow, { ...only, start: { ev: "community", session: "2099-11-21-yg" } }));
    expect(html).toMatch(/<a href="[^"]*ev=community&amp;session=2099-11-21-yg" class="sc-card ev-yoga">/);
    expect(html).not.toMatch(/aria-checked="true"|Choose your ride|Continue/); // nothing chosen or booked here, and no ride named
  });

  // Run for Her, Victory Lap, Arena Heros, the Blood Donation event and the DEFE 5KM Run have steps this booking does not
  // (the runner's, the athlete's, the donor's), and the Petromin nights are Petromin Days' (a tag holder's alone): each is
  // listed under its own card, as on main's page, and hands over to the booking app on that card and date (bug hunt
  // 2026-11-18, stg-diff0-2). Their fee is told there, never as a bike's price here.
  it("hands a run, a race, the donor and Petromin Days to the booking app on their own cards", async () => {
    const RH = comm("2099-11-22-rh", "runher", { capacity: 80 });
    const VL = comm("2099-11-23-vl", "vlap", { paid_ride: true, price: 150, capacity: 300, open_to_all: true });
    const AR = comm("2099-11-24-ar", "arena", { paid_ride: true, price: 200, capacity: 100, open_to_all: true });
    const BD = comm("2099-11-25-bd", "blood", { open_to_all: true, capacity: 1000 });
    const DF = comm("2099-11-26-df", "defe5k", { capacity: 200 });
    const PM = comm("2099-11-27-pm", "petromin", { capacity: 30 });
    const all = [JCC, SAT, RH, VL, AR, BD, DF, PM];
    const flow = await flowOf(all, "en");
    expect(flow.events.map((e) => e.key)).toEqual(["jcc", "community", "blood", "vlap", "arena", "runher"]); // no Petromin Days for a visitor
    const at = (id: string) => flow.events.flatMap((e) => e.sessions).find((s) => s.id === id)!;
    for (const [id, ev] of [[RH.id, "runher"], [VL.id, "vlap"], [AR.id, "arena"], [BD.id, "blood"], [DF.id, "community"]]) {
      expect(at(id).handoff, id).toMatch(new RegExp(`[?&]ev=${ev}&session=${id}$`));
    }
    expect(flow.events.find((e) => e.key === "blood")!.title).toBe("Micromobility Blood Donation");
    expect(flow.events.find((e) => e.key === "vlap")!.title).toBe("Victory Lap");
    expect(JSON.stringify(flow)).not.toContain(PM.id);
    expect(Object.keys(flow.routes ?? {})).toEqual(["2099-11-08", "2099-11-16"]);
    // no fee for a race drawn as a bike's price: its card says when, and where it goes
    const html = renderToStaticMarkup(createElement(BookingFlow, { ...flow, start: { ev: "vlap", session: null } }));
    const card = /<a href="[^"]*ev=vlap&amp;session=2099-11-23-vl" class="sc-card ev-vlap">.*?<\/a>/.exec(html)?.[0] ?? "";
    expect(card).toContain("Available");
    expect(card).not.toMatch(/from|SAR|150/);
    // a Petromin tag holder, signed in, has Petromin Days, handed over as ev=petromin
    jar.account = SIGNED;
    const holder = await flowOf(all, "en", { petromin_member: true, community_member: false });
    expect(holder.events.map((e) => e.key)).toEqual(["jcc", "community", "petromin", "blood", "vlap", "arena", "runher"]);
    expect(holder.events.find((e) => e.key === "petromin")!.sessions.map((s) => s.handoff)).toEqual([expect.stringMatching(/[?&]ev=petromin&session=2099-11-27-pm$/)]);
  });

  it("names a session by its Arabic name on the Arabic page alone", async () => {
    const name = async (locale: string) => (await flowOf([SAT], locale)).events.find((e) => e.key === "community")!.sessions[0].name;
    expect(await name("ar")).toBe("جولة الشروق");
    expect(await name("en")).toBe("Sunrise Ride");
    expect(await name("de")).toBe("Sunrise Ride");
    // no Arabic name given: the typed one, as before
    expect((await flowOf([{ ...SAT, title_ar: null }], "ar")).events.find((e) => e.key === "community")!.sessions[0].name).toBe("Sunrise Ride");
  });

  // The hand merge of main's dd04a7f8 (2026-11-13). lib/rides.ts reads the sessions staff closed as Full, no waitlist
  // (bike_slots._fbk; fbkOf). The user's rule (2026-11-13): such a date stays listed, said Fully booked with where to go
  // next, so nobody takes it for called off; nothing books it (the database refuses a closed session), and it never brings
  // back a card that shows only while it has dates (bug hunt 2026-11-18, stg-diff0-1).
  it("lists a date closed as Full, no waitlist, as Fully booked, never to be chosen", async () => {
    const FBK = { status: "closed", cancelled_at: null, draft: false, opens_at: null };
    const satFb = { ...SAT, ...FBK, id: "2099-11-23", session_date: "2099-11-23", bike_slots: '{"_time":"05:45 - 06:15","_fbk":1}' };
    const evFb = { ...EV, ...FBK, bike_slots: '{"_time":"19:00 - 21:00","_fbk":1}' };
    const flow = await flowOf([JCC, SAT, satFb, evFb], "en");
    expect(flow.events.map((e) => e.key)).toEqual(["jcc", "community"]); // the ticketed events' card stays away: its one date is closed
    expect(flow.events.flatMap((e) => e.sessions).map((s) => [s.id, !!s.fbk])).toEqual([["2099-11-08", false], ["2099-11-16", false], ["2099-11-23", true]]);
    expect(Object.keys(flow.routes ?? {})).toEqual(["2099-11-08", "2099-11-16"]);
    // drawn at full strength with Fully booked and See you next Saturday, and no radio: even an address naming it picks nothing
    const html = renderToStaticMarkup(createElement(BookingFlow, { ...flow, start: { ev: "community", session: "2099-11-23" } }));
    const card = /<div class="sc-card fbk ev-saturday">.*?See you next Saturday<\/bdi><\/span><\/div>/.exec(html)?.[0] ?? "";
    expect(card).toContain('<span class="sc-spots full">Fully booked</span>');
    expect(card).not.toMatch(/role="radio"|closed/);
    expect(html).not.toContain('aria-checked="true"');
    // its only date closed, the community card lists it rather than saying there are no dates
    const alone = await flowOf([satFb], "en");
    expect(alone.events.find((e) => e.key === "community")!.sessions.map((s) => [s.id, s.fbk])).toEqual([["2099-11-23", true]]);
    // the same date open again is listed as before
    expect((await flowOf([{ ...satFb, status: "open" }], "en")).events.find((e) => e.key === "community")!.sessions.map((s) => [s.id, !!s.fbk])).toEqual([["2099-11-23", false]]);
  });

  // The hand merge of main's e43abff6 (2026-11-13). The Farm House Night (ride_kind 'farm') is "not to public" (the user):
  // main's page draws it for a signed-in community member alone. This flow has no step for it (no bike, the family by
  // name, staff approving each place): a member finds its date inside the community card, handed to the booking app (bug
  // hunt 2026-11-18, stg-diff0-2), and for anyone else what the page hands the browser holds no word of it.
  it("lists the Farm House Night to a signed-in community member alone, and hands anyone else no word of it", async () => {
    const FH = comm("2099-11-19-fh", "farm", { title: "Nawar Farm House Night", title_ar: "ليلة مزرعة نوار", needs_approval: true, capacity: 60, spots: 60,
      bike_slots: '{"_time":"16:30 - 20:30"}', location: "Little Farmhouse, Dhahban", meet_url: "https://maps.app.goo.gl/BYteRL5JCueWZUEs6" });
    for (const locale of ["en", "ar", "de", "fr"]) {
      const flow = await flowOf([FH, SAT, JCC], locale);
      expect(flow.events.map((e) => e.key), locale).toEqual(["jcc", "community"]);
      expect(flow.events.flatMap((e) => e.sessions).map((s) => s.id), locale).toEqual(["2099-11-08", "2099-11-16"]);
      expect(JSON.stringify(flow), locale).not.toMatch(/Nawar|Farm House|Farmhaus|ليلة مزرعة|2099-11-19-fh|Little Farmhouse|farm/i);
    }
    // with nothing but the farm on the books the community card has no date
    expect((await flowOf([FH], "en")).events.find((e) => e.key === "community")!.sessions).toEqual([]);
    // signed in: a member has it, handed over on the community card; an account that is not a member has none of it
    jar.account = SIGNED;
    const member = await flowOf([FH, SAT, JCC], "en", { community_member: true });
    const fh = member.events.find((e) => e.key === "community")!.sessions.find((s) => s.id === "2099-11-19-fh")!;
    expect(fh.handoff).toMatch(/[?&]ev=community&session=2099-11-19-fh$/);
    expect(fh.name).toBe("Nawar Farm House Night");
    expect(JSON.stringify(await flowOf([FH, SAT, JCC], "en", { community_member: false }))).not.toMatch(/Nawar|Farm House|2099-11-19-fh|Little Farmhouse/i);
  });
});
