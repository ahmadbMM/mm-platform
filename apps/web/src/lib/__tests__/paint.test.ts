import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, isValidElement, type ReactElement } from "react";
// The site has no @types/react-dom; this test needs one function of it (as rating.test.ts does).
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import ExperienceSteps from "@/components/experiences/ExperienceSteps";
import TicketCard from "@/components/booking/TicketCard";
import { T as TICKET } from "@/components/booking/tickets.text";
import { EVENT_OF, eventCards, featuredDates, infoPlace, infoPrice, membersOnlyDate, rentsBikes } from "../event-info";
import { FEATURE_OK, FEATURED_KINDS, featuredOf, kindNames, rideKind, toSession } from "../rides";
import { resetRides } from "../rides";
import { resetSiteContent } from "../site";
import { isNonBike, NON_BIKE_KINDS } from "../bike-kinds";
import { waiverKind } from "../waiver";
import { KIND_ORDER } from "../kind-theme";
import { LM_KINDS } from "../landmarks";
import { maxRiders, needsBike, partyRide, regSteps } from "../booking";
import { liveSession, payableOnline } from "../booking-server";
import { icsPlace, placeLink, ticketCue, ticketRow, ticketSession, venueOf, venueText, type TicketRow } from "../tickets";
import { isPaint, PAINT_MARK, PAINT_VENUE, paintKnow } from "../paint";
import { fmtSar } from "../fill";
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

// The Tee Painting Workshop (the booking app, 2026-11-23): drawing and colouring on MicroMobility T-shirts, a date inside
// MicroMobility Experiences, featured, members only, one place per account, first come first served then the waitlist, no
// approval, no bike; 3 to 6 PM at Red Mug Caffe with its map; 130 SAR per person, said as the price alone (how to pay is
// announced later).
const MAP = "https://maps.app.goo.gl/PrRpv2rXTSKH7meJ8";
const TP = {
  id: "2099-11-28-tp", session_date: "2099-11-28", day: "Saturday", status: "open", event_kind: "community", ride_kind: "paint", title: null,
  open_to_all: false, paid_ride: true, needs_approval: false, hide_queue: true, price: 130, capacity: 20, spots: 20, bike_slots: '{"_time":"15:00 - 18:00"}',
  location: "Red Mug Caffe", meet_url: MAP, description: null,
};
const JCC = { id: "2099-11-29", session_date: "2099-11-29", day: "Sunday", status: "open", event_kind: null, ride_kind: null, title: null, capacity: 40, bike_slots: '{"_time":"21:00 - 23:00"}', location: "JCC", meet_url: null };
const ACCOUNT = "c1~a1b2c3d4e5f6a7b8c9d0";
const asMember = () => { jar.account = ACCOUNT; jar.member = true; };
const PRICE = fmtSar(130, "en");

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
  if (url.includes("/rpc/community_member")) return json(!!jar.account && jar.member);
  if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": "0-0/0" } });
  return json([]);
});
type Props = Parameters<typeof ExperienceSteps>[0];
const experiences = async (sessions: unknown[], locale = "en") => {
  resetRides();
  vi.stubGlobal("fetch", db(sessions));
  const page = await ExperiencesPage({ params: Promise.resolve({ locale }) });
  return (findAll(page, ExperienceSteps)[0] as ReactElement<Props>).props;
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
const tpOf = (p: Props) => comm(p).sessions.find((s) => s.kind === "paint")!;

beforeEach(() => {
  resetRides(); resetSiteContent();
  jar.account = ""; jar.member = false;
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("the Tee Painting Workshop's kind", () => {
  it("is a community kind of its own, featured as made, without a bike, members only, paid at its own price, under the activity waiver", () => {
    expect(rideKind({ ride_kind: "paint", event_kind: "community" })).toBe("paint");
    expect(rideKind({ ride_kind: "paint", event_kind: null })).toBe("jcc");
    const s = toSession(TP)!;
    expect(s).toMatchObject({ kind: "paint", members: true, free: false, price: 130, gather: false, collect: null, approval: false, featured: true, times: ["15:00", "18:00"] });
    expect(toSession({ ...TP, paid_ride: false })).toMatchObject({ free: true, price: null });
    expect(FEATURE_OK).toContain("paint");
    expect(FEATURED_KINDS).toContain("paint");
    expect(featuredOf("paint", '{"_feat":0}')).toBe(false); // staff can still switch it off
    expect(NON_BIKE_KINDS.has("paint")).toBe(true);
    expect(isNonBike("paint", TP.id)).toBe(true);
    expect(isNonBike(null, "2026-11-28-tp")).toBe(true); // by its id when the session did not load
    expect(rentsBikes("paint")).toBe(false);
    expect(waiverKind(ticketSession(TP)!)).toBe("activity");
    expect(EVENT_OF.paint).toBe("community");
    expect(KIND_ORDER.at(-1)).toBe("paint");
    expect(LM_KINDS).toContain("paint");
    expect(isPaint(s)).toBe(true);
    expect(membersOnlyDate(s)).toBe(true);
    expect(featuredDates(eventCards([s], { member: false, petromin: false }).map((c) => ({ card: c.card, sessions: c.sessions })))).toEqual([{ ev: "community", id: TP.id }]);
  });
  it("is named by its own name (Experiences > Dates: paintName), in English and Arabic", () => {
    const f = experiencesSchema.sections.find((x) => x.id === "dates")?.fields.find((x) => x.id === "paintName") as { def: { en: string; ar: string } };
    expect(f.def).toEqual({ en: "Tee Painting Workshop", ar: "ورشة الرسم على التيشيرت" });
    expect(kindNames({ paintName: "Tee Painting Workshop" }).paint).toBe("Tee Painting Workshop");
  });
  it("says its price alone, per person", () => {
    const t = { free: "Complimentary", seat: null, from: "from SAR 57.5" };
    expect(infoPrice({ kind: "paint", free: false }, { ...t, athlete: "SAR 130 · per person" })).toBe("SAR 130 · per person");
    expect(infoPrice({ kind: "paint", free: false }, t)).toBeNull();
  });
  it("is at Red Mug Caffe, the place staff named or else its own, with that place's map", () => {
    const words = { meetingPoint: "Meeting point", venueCircuit: "Jeddah Corniche Circuit", venueJyc: "Jeddah Yacht Club" };
    expect(infoPlace(toSession(TP)!, words, "https://dir")).toEqual({ name: "Red Mug Caffe", map: MAP });
    expect(infoPlace({ ...toSession(TP)!, location: null, meetUrl: null }, words, "https://dir")).toEqual({ name: PAINT_VENUE, map: null });
    const t = ticketSession({ ...TP, location: null })!;
    expect(venueText(venueOf(t), TICKET.en)).toBe("Red Mug Caffe");
    expect(placeLink(t, "https://dir")).toBe(MAP);
    expect(placeLink(ticketSession({ ...TP, meet_url: null })!, "https://dir")).toBe("https://www.google.com/maps/search/?api=1&query=Red%20Mug%20Caffe");
    expect(icsPlace(ticketSession(TP)!)).toBe("Red Mug Caffe");
  });
  it("is booked here, one place per account, no bike step, never paid online", () => {
    const live = liveSession(TP, "2099-11-01")!;
    expect(live).toMatchObject({ kind: "paint", members: true, free: false, seat: 130, capacity: 20 }); // priced as a seat, its own price
    expect(needsBike(live)).toBe(false);
    expect(partyRide(live)).toBe(false);
    expect(maxRiders(live, 0)).toBe(1);
    expect(regSteps(live)).not.toContain(2);
    expect(payableOnline(live)).toBe(false);
  });
  it("has the mark: a T-shirt with brush strokes and paint drops, no emoji", () => {
    const svg = readFileSync(new URL("../../../public/site/paint-mark.svg", import.meta.url), "utf8");
    expect(svg).toMatch(/^<svg[^>]*viewBox="0 0 64 40"/);
    expect(svg).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    expect(PAINT_MARK).toBe("/site/paint-mark.svg");
    expect(paintKnow({ whatK: "What", whatV: "Paint" })).toEqual([["What", "Paint"]]);
  });
});

describe("the Tee Painting Workshop on Experiences", () => {
  it("is a featured date inside MicroMobility Experiences, booked on this site, with its own card and price", async () => {
    asMember();
    const p = await experiences([TP, JCC]);
    expect(p.featured).toEqual([{ ev: "community", id: TP.id }]);
    const s = tpOf(p);
    expect(s).toMatchObject({ kind: "paint", name: "Tee Painting Workshop", members: true, free: false, paid: false });
    expect(s.here).toMatch(/\/experiences\?ev=community&session=2099-11-28-tp$/);
    expect(s.paint).toEqual({ meta: ["3 PM – 6 PM", "Red Mug Caffe"], price: `${PRICE} · per person` });
    expect(s.payNote).toBeUndefined(); // how to pay is announced later: never a pay line
    expect(s.feat).toMatchObject({ wd: "Sat", dn: "28", mo: "Nov", len: null });
  });
  it("gives its Details its own text, who books, its price, where with its map, and what it is", async () => {
    const i = tpOf(await experiences([TP])).info;
    expect(i.text).toBe("Paint and colour your own MicroMobility T-shirt with the community at Red Mug Caffe, 3 PM to 6 PM.");
    expect(i).toMatchObject({ who: "Community members", price: `${PRICE} · per person`, place: "Red Mug Caffe", map: MAP, distance: null });
    expect(i.more).toEqual([{ k: "What", v: "Paint and colour your own MicroMobility T-shirt" }]);
  });
  it("says it in Arabic, and in a language the booking app does not speak (German)", async () => {
    const ar = tpOf(await experiences([TP], "ar"));
    expect(ar.name).toBe("ورشة الرسم على التيشيرت");
    expect(ar.info.more).toEqual([{ k: "ماذا", v: "ارسم ولوّن تيشيرت مايكروموبيليتي الخاص بك" }]);
    expect(ar.paint?.price).toContain("للشخص");
    const de = tpOf(await experiences([TP], "de"));
    expect(de.name).toBe("T-Shirt-Malworkshop");
    expect(de.paint?.price).toContain("pro Person");
    expect(de.info.text).toMatch(/^Gestalte und bemale/);
  });
  it("draws its date card in Paint Splash: the splash, the mark, its name, its time and place, its price, never how to pay", async () => {
    const p = await experiences([TP, JCC]);
    const html = draw(p, 2, comm(p));
    const card = /<button type="button" class="sc-card sc-paint ev-paint"[^>]*>.*?<\/button>/.exec(html)?.[0] ?? "";
    expect(card).toContain('<svg class="sc-tp-scene"');
    expect(card).toContain(`<img class="sc-tp-mark" src="${PAINT_MARK}"`);
    expect(card).toContain('<span class="sc-tp-title">Tee Painting Workshop</span>');
    expect(card).toContain("<bdi>Red Mug Caffe</bdi>");
    expect(card).toContain(`<span class="sc-tp-price"><bdi>${PRICE} · per person</bdi></span>`);
    expect(html).not.toMatch(/bank transfer|receipt|Pay at/i);
  });
  it("opens its booking steps here from its last step, its price said, with no pay line and no participants to add", async () => {
    asMember();
    const p = await experiences([TP]);
    const html = draw(p, 3, comm(p), tpOf(p));
    expect(html).toMatch(/<a class="xs-go ev-paint" href="[^"]*ev=community&amp;session=2099-11-28-tp[^"]*">/);
    expect(html).toContain(`<span class="xs-logo small xs-paint-logo"><img src="${PAINT_MARK}"`);
    expect(html).toContain('<strong class="xs-tp-name">Tee Painting Workshop</strong>');
    expect(html).toContain(`<p class="xs-rules xs-vl-price"><bdi>${PRICE} · per person</bdi></p>`);
    expect(html).not.toMatch(/bank transfer|receipt|Pay at|add the participants/i);
  });
  it("draws its Featured card on its canvas with its price", async () => {
    const html = draw(await experiences([TP]), 1);
    expect(html).toMatch(/<button type="button" class="xs-feat-card ev-paint xs-feat-tp"><svg class="sc-tp-scene"/);
    expect(html).toContain('<span class="xs-feat-name sc-tp-title">Tee Painting Workshop</span>');
    expect(html).toContain(`<span class="xs-feat-with"><bdi>${PRICE} · per person</bdi></span>`);
  });
});

describe("the Tee Painting Workshop on Events", () => {
  it("is listed in its indigo with its start and end and where, booked on the community card, never its price", async () => {
    const html = await eventsPage([TP, JCC]);
    expect(html).toContain("Tee Painting Workshop");
    expect(html).toContain("--kind:#3d34a5");
    expect(html).toContain("<span><bdi>Red Mug Caffe</bdi></span>");
    expect(html).toContain("ev=community&amp;session=2099-11-28-tp");
    expect(html).not.toContain("130");
  });
});

describe("a Tee Painting Workshop ticket (My Account)", () => {
  const tp = ticketSession(TP)!;
  const base = { id: "q1abcdef", session_id: tp.id, session_date: tp.date, session_day: "Saturday", status: "waiting", queue_num: 4, price: 130, paid: false, type_preference: "None", name: "Sara Haddad" };
  const card = (rows: TicketRow[], ar = false) => renderToStaticMarkup(createElement(TicketCard, {
    locale: ar ? "ar" : "en", today: "2099-11-25", rows, session: tp, name: ar ? "ورشة الرسم على التيشيرت" : "Tee Painting Workshop", cue: ticketCue(rows, tp, null), t: ar ? TICKET.ar : TICKET.en,
    gather: "Gathering", start: "Start", typeName: (x: string) => x,
    links: { edit: null, manage: "https://book.example.test/?tab=bookings", place: placeLink(tp, "https://dir.example.test/jcc") },
    now: Date.parse("2099-11-25T09:00:00Z"), balance: 500, wallet: { bookingId: "q1abcdef", groupIds: ["q1abcdef"] },
  })).replace(/^(<link [^>]*>)+/, "");

  it("has no bike, is paid, at Red Mug Caffe", () => {
    expect(tp).toMatchObject({ kind: "paint", bikes: false, gathers: false, free: false, approval: false, price: 130, meetUrl: MAP });
  });
  it("wears its look: the mark, what it is, Red Mug Caffe and its map, its price and total, never how or where to pay", () => {
    const html = card([ticketRow(base)!]);
    expect(html).toMatch(/^<article class="tk-card ev-paint/);
    expect(html).toContain(`<span class="tk-logo tk-logo-paint" aria-hidden="true"><img src="${PAINT_MARK}"`);
    expect(html).toContain('<div class="tk-tp-know"><p><span class="tk-tp-k">What</span><span class="tk-tp-v">Paint and colour your own MicroMobility T-shirt</span></p></div>');
    expect(html).toContain("Red Mug Caffe");
    expect(html).toContain(`href="${MAP}"`);
    expect(html).toMatch(/<div class="tk-total"><span>Total<\/span><strong><bdi class="tk-amt" dir="ltr">.*?SAR<\/span> 130<\/bdi><\/strong>/);
    expect(html).not.toContain(TICKET.en.payDue); // no "Pay at the booth"
    expect(html).not.toMatch(/tk-wallet|Wallet|bank transfer|receipt/i); // no Wallet switch, no pass, no transfer
    expect(html).not.toMatch(/>Edit<|>Reschedule</);
    // its calendar entry says Red Mug Caffe
    expect(decodeURIComponent(/href="data:text\/calendar;charset=utf-8,([^"]*)"/.exec(html)?.[1] ?? "")).toContain("LOCATION:Red Mug Caffe");
  });
  it("says it in Arabic", () => {
    const html = card([ticketRow(base)!], true);
    expect(html).toContain('<span class="tk-tp-k">ماذا</span><span class="tk-tp-v">ارسم ولوّن تيشيرت مايكروموبيليتي الخاص بك</span>');
  });
});
