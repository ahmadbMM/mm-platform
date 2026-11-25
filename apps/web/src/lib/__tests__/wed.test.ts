import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, isValidElement, type ReactElement } from "react";
// The site has no @types/react-dom; this test needs one function of it (as rating.test.ts does).
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import ExperienceSteps from "@/components/experiences/ExperienceSteps";
import BookingFlow from "@/components/experiences/BookingFlow";
import TicketCard from "@/components/booking/TicketCard";
import { T as TICKET } from "@/components/booking/tickets.text";
import { EVENT_OF, dateText, infoPlace, infoPlaces, infoPrice, infoTimes, membersOnlyDate, rentsBikes } from "../event-info";
import { FEATURE_OK, FEATURED_KINDS, featuredOf, kindNames, resetRides, rideKind, toSession } from "../rides";
import { resetSiteContent } from "../site";
import { BIKE_KINDS, isNonBike, NON_BIKE_KINDS } from "../bike-kinds";
import { waiverKind } from "../waiver";
import { KIND_ORDER, hasKindArt } from "../kind-theme";
import { LM_KINDS } from "../landmarks";
import { fromPrice, gathers, hasRideGroups, maxRiders, needsBike, ownOffered, partyRide, priceMap, regSteps, riderPrices, typeOptions, type BookSession } from "../booking";
import { checkBooking, liveSession, payableOnline } from "../booking-server";
import { icsPlace, meetsAt, placeLink, ticketCue, ticketRow, ticketSession, venueOf, venueText, type TicketRow } from "../tickets";
import { isWed, WED_MEET_URL, wedMeetUrl } from "../wed";
import { farmForMembers, MEMBERS_EYES } from "../farm";
import { fmtClock } from "../tickets";
import { experiencesSchema } from "@/content/pages/experiences";
import ExperiencesPage from "../../app/[locale]/experiences/page";
import EventsPage from "../../app/[locale]/events/page";

// cookies() is a request's; here it holds the account's cookie a test sets, or none, and whether the booking app's members'
// check (community_member) says that account is a community member.
const jar = vi.hoisted(() => ({ account: "", member: false }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (n === "mm_acct" && jar.account ? { name: n, value: jar.account } : undefined) }) }));
// The steps open on the event cards (useState(1)); a test draws a later step by handing the component's first states in
// order: the step, the event, the date.
const states = vi.hoisted(() => ({ queue: [] as unknown[] }));
vi.mock("react", async (importOriginal) => {
  const R = await importOriginal<typeof import("react")>();
  return { ...R, useState: ((v: unknown) => R.useState(states.queue.length ? states.queue.shift() : v)) as typeof R.useState };
});
const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;

// The Wednesday Community Ride (the booking app, 2026-11-25): an evening bike ride every Wednesday from the Saturday Social
// Ride's start point, a date inside MicroMobility Experiences, never featured as made, members only and shown to them alone,
// first come first served with no approval and no place limit said; the standard fare of the bike picked, paid at the desk,
// one's own bike free; it gathers at 6:30 PM and sets off at 7 PM; no ride groups, distance or route.
const MAP = "https://maps.app.goo.gl/pdcMn1mGcCdabia7A?g_st=ic";
const WC = {
  id: "2099-11-25-wc", session_date: "2099-11-25", day: "Wednesday", status: "open", event_kind: "community", ride_kind: "wed", title: "Wednesday Community Ride",
  title_ar: "جولة الأربعاء المجتمعية", open_to_all: false, paid_ride: true, needs_approval: false, hide_queue: true, price: null, capacity: 2, spots: null,
  bike_slots: '{"_time":"18:30 - 19:00"}', location: null, meet_url: MAP, description: null,
};
const JCC = { id: "2099-11-29", session_date: "2099-11-29", day: "Sunday", status: "open", event_kind: null, ride_kind: null, title: null, capacity: 40, bike_slots: '{"_time":"21:00 - 23:00"}', location: "JCC", meet_url: null };
const ACCOUNT = "c1~a1b2c3d4e5f6a7b8c9d0";
const asMember = () => { jar.account = ACCOUNT; jar.member = true; };
const PRICES = [{ type: "Road", price: 75 }, { type: "Hybrid", price: 57.5 }, { type: "Mountain", price: 57.5 }, { type: "Kids", price: 57.5 }, { type: "Road Carbon", price: 250 }];

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
function findAll(n: unknown, type: unknown, out: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(n)) { for (const x of n) findAll(x, type, out); return out; }
  if (!isValidElement(n)) return out;
  if (n.type === type) out.push(n);
  findAll((n.props as { children?: unknown }).children, type, out);
  return out;
}
// the places taken on every session counted: none, so a date that were counted would read as its whole capacity left
const db = (sessions: unknown[]) => vi.fn(async (url: string, init?: RequestInit) => {
  if (url.includes("/rpc/list_sessions")) return json(sessions);
  if (url.includes("/rpc/community_member")) return json(!!jar.account && jar.member);
  if (url.includes("/ride_prices")) return json(PRICES);
  if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": "0-0/0" } });
  return json([]);
});
type Props = Parameters<typeof ExperienceSteps>[0];
type FlowProps = Parameters<typeof BookingFlow>[0];
const experiences = async (sessions: unknown[], locale = "en") => {
  resetRides();
  vi.stubGlobal("fetch", db(sessions));
  const page = await ExperiencesPage({ params: Promise.resolve({ locale }) });
  return (findAll(page, ExperienceSteps)[0] as ReactElement<Props>).props;
};
const flow = async (sessions: unknown[], locale = "en") => {
  resetRides();
  vi.stubGlobal("fetch", db(sessions));
  const page = await ExperiencesPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({ ev: "community", session: WC.id }) });
  return (findAll(page, BookingFlow)[0] as ReactElement<FlowProps> | undefined)?.props;
};
const eventsPage = async (sessions: unknown[], locale = "en") => {
  resetRides();
  vi.stubGlobal("fetch", db(sessions));
  const page = await EventsPage({ params: Promise.resolve({ locale }) });
  return renderToStaticMarkup((page.props as { children: ReactElement }).children);
};
const draw = (props: Props, ...first: unknown[]) => {
  states.queue = [...first];
  try { return renderToStaticMarkup(createElement(ExperienceSteps, props)); } finally { states.queue = []; }
};
const comm = (p: Props) => p.events.find((e) => e.key === "community")!;
const wcOf = (p: Props) => comm(p).sessions.find((s) => s.kind === "wed")!;

beforeEach(() => {
  resetRides(); resetSiteContent();
  jar.account = ""; jar.member = false;
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("the Wednesday Community Ride's kind", () => {
  it("is a community bike ride of its own, members only, paid by the bike, gathering then starting, never featured as made", () => {
    expect(rideKind({ ride_kind: "wed", event_kind: "community" })).toBe("wed");
    expect(rideKind({ ride_kind: "wed", event_kind: null })).toBe("jcc");
    const s = toSession(WC)!;
    expect(s).toMatchObject({ kind: "wed", members: true, free: false, price: null, gather: true, collect: null, approval: false, featured: false, times: ["18:30", "19:00"], noCarbon: true, meetUrl: MAP });
    expect(s.groupKm).toBeUndefined(); // no ride groups, no distances
    expect(toSession({ ...WC, paid_ride: false })).toMatchObject({ free: true });
    expect(FEATURE_OK).toContain("wed"); // staff's switch alone
    expect(FEATURED_KINDS).not.toContain("wed");
    expect(featuredOf("wed", '{"_time":"18:30 - 19:00"}')).toBe(false);
    expect(featuredOf("wed", '{"_feat":1}')).toBe(true);
    expect(BIKE_KINDS.has("wed")).toBe(true);
    expect(NON_BIKE_KINDS.has("wed")).toBe(false);
    expect(isNonBike("wed", WC.id)).toBe(false);
    expect(isNonBike(null, "2026-11-25-wc")).toBe(false); // a '-wc' id is a bike ride
    expect(rentsBikes("wed")).toBe(true);
    expect(waiverKind(ticketSession(WC)!)).toBe("ride"); // the ride waiver, as on every bike ride
    expect(EVENT_OF.wed).toBe("community");
    expect(KIND_ORDER.at(-1)).toBe("wed");
    expect(hasKindArt("wed")).toBe(false); // the Saturday ride's colours, no drawing of its own
    expect(LM_KINDS).toContain("wed");
    expect(isWed(s)).toBe(true);
    expect(membersOnlyDate(s)).toBe(true);
    expect(MEMBERS_EYES.has("wed")).toBe(true);
  });
  it("meets at the Saturday ride's start point, its map when the row names none, said Meeting point, never the circuit", () => {
    expect(WED_MEET_URL).toBe(MAP);
    expect(wedMeetUrl("wed", null)).toBe(MAP);
    expect(wedMeetUrl("wed", "https://maps.example.test/x")).toBe("https://maps.example.test/x");
    expect(wedMeetUrl("saturday", null)).toBeNull();
    expect(toSession({ ...WC, meet_url: null })!.meetUrl).toBe(MAP);
    const words = { meetingPoint: "Meeting point", venueCircuit: "Jeddah Corniche Circuit", venueJyc: "Jeddah Yacht Club" };
    expect(infoPlace(toSession(WC)!, words, "https://dir")).toEqual({ name: "Meeting point", map: MAP });
    const t = ticketSession({ ...WC, meet_url: null })!;
    expect(t.meetUrl).toBe(MAP);
    expect(meetsAt(t)).toBe(true);
    expect(venueText(venueOf(t), TICKET.en)).toBe("Meeting point");
    expect(placeLink(t, "https://dir")).toBe(MAP);
    expect(icsPlace(t)).toBe(MAP);
  });
  it("is named by its own name (Experiences > Dates: wedName), in English and Arabic", () => {
    const f = experiencesSchema.sections.find((x) => x.id === "dates")?.fields.find((x) => x.id === "wedName") as { def: { en: string; ar: string } };
    expect(f.def).toEqual({ en: "Wednesday Community Ride", ar: "جولة الأربعاء المجتمعية" });
    expect(kindNames({ wedName: "Wednesday Community Ride" }).wed).toBe("Wednesday Community Ride");
  });
  it("says its standard fare from the cheapest bike, and never a count of places left", () => {
    const s = toSession(WC)!;
    expect(infoPrice(s, { free: "Complimentary", seat: null, from: "from SAR 57.5" })).toBe("from SAR 57.5");
    const t = { waitlist: "Waitlist", left1: "{0} spot left", leftN: "{0} spots left", few: "Few spots left" };
    expect(infoPlaces({ ...s, left: 2 }, t)).toBeNull();
    expect(infoPlaces({ ...s, left: 0 }, t)).toBe("Waitlist");
    expect(infoPlaces({ ...s, full: true }, t)).toBe("Waitlist");
  });
  it("fills its Details with its meeting and its start", () => {
    const d = experiencesSchema.sections.find((x) => x.id === "dates")?.fields.find((x) => x.id === "aboutWed") as { def: { en: string; ar: string } };
    const text = dateText(toSession(WC)!, { aboutJcc: "J", aboutSat: "S", aboutPetro: "P", aboutSwim: "W", aboutWs: "T", aboutRun: "R", aboutVl: "V", aboutDefe: "D", aboutAr: "A", aboutYoga: "Y", aboutFarm: "F", aboutKtri: "K", aboutPaint: "TP", aboutWed: d.def.en, sndAbout: "N", evAbout: "E" },
      infoTimes(toSession(WC)!, (x) => fmtClock(x, "en")));
    expect(text).toContain("We meet at 6:30 PM and ride at 7 PM.");
    expect(text).toMatch(/standard ride fare at the desk; your own bike rides free, and a helmet comes with every bike/);
    expect(text).not.toMatch(/km|route|SAR 50|helmet costs|places left/i);
    expect(d.def.ar).toContain("الخوذة مع كل دراجة");
  });
});

describe("booking a Wednesday Community Ride on this site", () => {
  const live = liveSession(WC, "2099-11-01")!;
  const prices = priceMap(PRICES);
  it("has a bike step with the types and their fares, one's own bike free, no Road Carbon, no ride groups, one place, paid at the desk", () => {
    expect(live).toMatchObject({ kind: "wed", community: true, members: true, free: false, approval: false, seat: null, open: true });
    expect(needsBike(live)).toBe(true);
    expect(regSteps(live)).toEqual([1, 2, 3]);
    expect(hasRideGroups(live)).toBe(false);
    expect(gathers(live)).toBe(true);
    expect(partyRide(live)).toBe(false);
    expect(maxRiders(live, 0)).toBe(1);
    expect(ownOffered(live)).toBe(true);
    expect(typeOptions(live)).toEqual(["Road", "Hybrid", "Mountain", "Kids", "Own"]);
    expect(fromPrice({ ...live, closedTypes: [] }, prices)).toEqual({ kind: "from", n: 57.5 });
    const rider = (type: "Road" | "Hybrid" | "Own") => ({ name: "", height: "175", type });
    expect(riderPrices(live, [rider("Road")], prices, null)).toEqual([{ kind: "sar", n: 75 }]);
    expect(riderPrices(live, [rider("Hybrid")], prices, null)).toEqual([{ kind: "sar", n: 57.5 }]);
    expect(riderPrices(live, [rider("Own")], prices, null)).toEqual([{ kind: "free" }]);
    expect(payableOnline(live)).toBe(false);
  });
  it("is booked with no group asked, and never as a party", () => {
    const acct = { name: "Sara Haddad", live: {}, rejected: [], gender: null };
    const input = { sessionId: WC.id, riders: [{ name: "", height: "175", type: "Road" as const }, { name: "Guest", height: "170", type: "Hybrid" as const }], group: null, addons: [], promo: null, waiver: true, payNow: false, wallet: false, seatOnly: false };
    const c = checkBooking(input, live, acct);
    expect(c).toEqual({ ok: true, riders: [input.riders[0]] });
  });
  it("opens its booking steps here on its date, never handed to the booking app", async () => {
    asMember();
    const p = await flow([WC, JCC]);
    const s = p?.events[0].sessions.find((x) => x.id === WC.id) as BookSession | undefined;
    expect(p?.events[0].key).toBe("community");
    expect(s).toMatchObject({ kind: "wed", community: true, members: true, free: false, approval: false, seat: null, name: "Wednesday Community Ride", time: "Gathering 6:30 PM · Start 7 PM", meetUrl: MAP, left: null });
    expect(s?.handoff).toBeUndefined();
    expect(p?.prices).toMatchObject({ Road: 75, Hybrid: 57.5, Mountain: 57.5, Kids: 57.5, Own: 0 });
  });
});

describe("the Wednesday Community Ride to anyone but a community member", () => {
  it("is in no list: farmForMembers leaves it out", () => {
    const rows = [{ id: "a", kind: "wed" }, { id: "b", kind: "saturday" }];
    expect(farmForMembers(rows, false).map((x) => x.id)).toEqual(["b"]);
    expect(farmForMembers(rows, true).map((x) => x.id)).toEqual(["a", "b"]);
  });
  it("has no date, mark or Details on Experiences, for a visitor not signed in or signed in without membership", async () => {
    for (const signedIn of [false, true]) {
      jar.account = signedIn ? ACCOUNT : ""; jar.member = false;
      const p = await experiences([WC, JCC]);
      expect(p.events.flatMap((e) => e.sessions).some((x) => x.kind === "wed")).toBe(false);
      expect(comm(p).marks?.kinds ?? []).not.toContain("wed");
      expect(JSON.stringify(p)).not.toContain("Wednesday Community Ride");
      expect(draw(p, 1)).not.toContain("Wednesday Community Ride");
    }
  });
  it("has no booking steps on its date", async () => {
    const p = await flow([WC, JCC]);
    expect(JSON.stringify(p?.events ?? [])).not.toContain(WC.id);
  });
  it("is not listed on Events", async () => {
    const html = await eventsPage([WC, JCC]);
    expect(html).not.toContain("Wednesday Community Ride");
    expect(html).not.toContain(WC.id);
  });
});

describe("the Wednesday Community Ride on Experiences, to a member", () => {
  beforeEach(asMember);
  it("is a date inside MicroMobility Experiences, not featured, booked on this site, in the Saturday ride's colours", async () => {
    const p = await experiences([WC, JCC]);
    expect(p.featured).toEqual([]);
    const s = wcOf(p);
    expect(s).toMatchObject({ kind: "wed", name: "Wednesday Community Ride", members: true, free: false, paid: true, left: null });
    expect(s.when).toEqual({ gather: true, a: "6:30 PM", b: "7 PM" });
    expect(s.here).toMatch(/\/experiences\?ev=community&session=2099-11-25-wc$/);
    expect(s.feat).toBeUndefined();
    expect((s.meta ?? []).some((x) => /^from .*57\.5/.test(x))).toBe(true); // the fare from the cheapest bike, never a collection time
    expect(s.route).toBeNull();
    expect(s.breakfast).toBeNull();
    expect(comm(p).marks?.kinds).toContain("wed");
  });
  it("gives its Details who books, its fare, when, the Saturday start point with its map, and no distance or places left", async () => {
    const i = wcOf(await experiences([WC])).info;
    expect(i.text).toBe("A Wednesday evening ride with the community from the Saturday Social Ride’s start point. We meet at 6:30 PM and ride at 7 PM. Pick your bike when you book and pay its standard ride fare at the desk; your own bike rides free, and a helmet comes with every bike. For community members.");
    expect(i).toMatchObject({ who: "Community members", place: "Meeting point", map: MAP, distance: null, places: null, collect: null });
    expect(i.price).toMatch(/^from /);
    expect(i.route).toBeUndefined();
    expect(i.sunrise).toBeUndefined();
  });
  it("says it in Arabic, by its Arabic title, and in German", async () => {
    const ar = wcOf(await experiences([WC], "ar"));
    expect(ar.name).toBe("جولة الأربعاء المجتمعية");
    expect(ar.info.text).toContain("نلتقي في");
    const de = wcOf(await experiences([{ ...WC, title: null }], "de"));
    expect(de.name).toBe("Mittwochs-Community-Ausfahrt");
    expect(de.info.text).toMatch(/^Eine Mittwochabend-Ausfahrt mit der Community/);
    const es = wcOf(await experiences([{ ...WC, title: null }], "es"));
    expect(es.name).toBe("Recorrido comunitario del miércoles");
  });
  it("draws its date card in the community rides' look: its kind's mark, its name, gathering and start, its fare from", async () => {
    const p = await experiences([WC, JCC]);
    const html = draw(p, 2, comm(p));
    const card = /<button type="button" class="sc-card ev-wed"[^>]*>.*?<\/button>/.exec(html)?.[0] ?? "";
    expect(card).toContain("Wednesday Community Ride");
    expect(card).toContain("6:30 PM");
    expect(card).toContain("7 PM");
    expect(card).not.toMatch(/spots? left|km/);
  });
});

describe("the Wednesday Community Ride on Events, to a member", () => {
  beforeEach(asMember);
  it("is listed in the Saturday ride's green with its gathering and start, booked on the community card", async () => {
    const html = await eventsPage([WC, JCC]);
    expect(html).toContain("Wednesday Community Ride");
    expect(html).toContain("--kind:#077a4b");
    expect(html).toMatch(/Gathering <bdi>6:30 PM<\/bdi> · Start <bdi>7 PM<\/bdi>/);
    expect(html).toContain("ev=community&amp;session=2099-11-25-wc");
  });
});

describe("a Wednesday Community Ride ticket (My Account)", () => {
  const wc = ticketSession(WC)!;
  const base = { id: "q1abcdef", session_id: wc.id, session_date: wc.date, session_day: "Wednesday", status: "waiting", queue_num: 4, price: 75, paid: false, type_preference: "Road", name: "Sara Haddad" };
  const card = (rows: TicketRow[], ar = false) => renderToStaticMarkup(createElement(TicketCard, {
    locale: ar ? "ar" : "en", today: "2099-11-20", rows, session: wc, name: ar ? "جولة الأربعاء المجتمعية" : "Wednesday Community Ride", cue: ticketCue(rows, wc, null), t: ar ? TICKET.ar : TICKET.en,
    gather: ar ? "التجمع" : "Gathering", start: ar ? "الانطلاق" : "Start", typeName: (x: string) => x,
    links: { edit: null, manage: "https://book.example.test/?tab=bookings", place: placeLink(wc, "https://dir.example.test/jcc") },
    now: Date.parse("2099-11-20T09:00:00Z"),
  })).replace(/^(<link [^>]*>)+/, "");

  it("is a bike ride that gathers, paid, at the Saturday start point", () => {
    expect(wc).toMatchObject({ kind: "wed", bikes: true, gathers: true, free: false, approval: false, meetUrl: MAP });
  });
  it("says its meeting and its start, the meeting point with its map for Directions, its bike and fare, and its number", () => {
    const html = card([ticketRow(base)!]);
    expect(html).toMatch(/^<article class="tk-card ev-wed/);
    expect(html).toContain("Gathering 6:30 PM · Start 7 PM");
    expect(html).toContain('<span class="tk-venue">Meeting point</span>');
    expect(html).toContain(`href="${MAP.replace(/&/g, "&amp;")}"`);
    expect(html).toContain("#4");
    expect(html).toMatch(/SAR<\/span> 75/);
    expect(html).not.toMatch(/Jeddah Corniche Circuit|km|Beginners|Intermediates/);
    expect(decodeURIComponent(/href="data:text\/calendar;charset=utf-8,([^"]*)"/.exec(html)?.[1] ?? "")).toContain(`LOCATION:${MAP}`);
  });
  it("an own bike costs nothing", () => {
    const html = card([ticketRow({ ...base, type_preference: "Own", price: 0 })!]);
    expect(html).not.toMatch(/SAR<\/span> 75/);
  });
});
