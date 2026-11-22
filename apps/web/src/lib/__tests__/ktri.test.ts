import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, isValidElement, type ReactElement } from "react";
// The site has no @types/react-dom; this test needs one function of it (as rating.test.ts does).
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import ExperienceSteps from "@/components/experiences/ExperienceSteps";
import TicketCard from "@/components/booking/TicketCard";
import { T as TICKET } from "@/components/booking/tickets.text";
import Medal from "@/components/account/Medal";
import { T as RECORD } from "@/components/account/RideRecord.text";
import { serverLocalize } from "@/i18n/dicts";
import { EVENT_OF, eventCards, featuredDates, infoPlace, infoWho, membersOnlyDate, rentsBikes } from "../event-info";
import { FEATURE_OK, FEATURED_KINDS, featuredOf, rideKind, toSession } from "../rides";
import { resetRides } from "../rides";
import { resetSiteContent } from "../site";
import { isNonBike, NON_BIKE_KINDS } from "../bike-kinds";
import { waiverKind } from "../waiver";
import { KIND_ORDER } from "../kind-theme";
import { LM_KINDS } from "../landmarks";
import { BADGE_SYS, HELD_ONLY } from "../ride-record";
import { pendingRaceRegs } from "../race-reg";
import { placeLink, raceRegAsked, ticketCue, ticketRow, ticketSession, venueOf, venueText, type TicketRow } from "../tickets";
import { isKtri, KTRI_MARK, KTRI_RACES, KTRI_REG_URL, ktriOut, ktriRaceOpts, ktriTitle, triRaceBody, triRaceOf } from "../ktri";
import ExperiencesPage from "../../app/[locale]/experiences/page";
import EventsPage from "../../app/[locale]/events/page";
import { POST } from "../../app/api/account/tri-race/route";
import RaceGate from "@/components/account/RaceGate";
import { ktriBike, ktriBikeText } from "../ktri";

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

// The KAUST Triathlon (the user, 2026-11-22: "create a new featured session that shows for everyone but non community
// members gets sent to the registration link directly and for our members put the registration link as the last step
// needed to complete booking the same way we did before"), as the booking app's session script makes it
// (supabase/checks/kaust-triathlon-session-2026-12-04.sql in the booking site's repo): a date inside MicroMobility
// Experiences, featured and shown to everyone; members book a free place in the group, anyone else registers on the race's
// website.
const KT = {
  id: "2099-12-04-kt", session_date: "2099-12-04", day: "Friday", status: "open", event_kind: "community", ride_kind: "ktri", title: null,
  open_to_all: false, paid_ride: false, needs_approval: false, hide_queue: true, price: null, capacity: 50, spots: 50, bike_slots: '{"_time":"06:00 - 11:00"}',
  location: "KAUST Urban Beach", meet_url: null, description: null,
};
const SAT = { id: "2099-12-05", session_date: "2099-12-05", day: "Saturday", status: "open", event_kind: "community", ride_kind: "saturday", title: null, open_to_all: false, paid_ride: false, needs_approval: true, capacity: 40, bike_slots: '{"_time":"05:45 - 06:15"}', location: null, meet_url: null };
const JCC = { id: "2099-12-06", session_date: "2099-12-06", day: "Sunday", status: "open", event_kind: null, ride_kind: null, title: null, capacity: 40, bike_slots: '{"_time":"21:00 - 23:00"}', location: "JCC", meet_url: null };
const ACCOUNT = "c1~a1b2c3d4e5f6a7b8c9d0";
const asMember = () => { jar.account = ACCOUNT; jar.member = true; };

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
const ktOf = (p: Props) => comm(p).sessions.find((s) => s.kind === "ktri")!;

beforeEach(() => {
  resetRides(); resetSiteContent();
  jar.account = ""; jar.member = false;
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("the KAUST Triathlon's kind", () => {
  it("is a community kind of its own, featured as made, without a bike, under the activity waiver", () => {
    expect(rideKind({ ride_kind: "ktri", event_kind: "community" })).toBe("ktri");
    const s = toSession(KT)!;
    expect(s).toMatchObject({ kind: "ktri", members: true, free: true, gather: false, collect: null, approval: false, featured: true, times: ["06:00", "11:00"] });
    expect(FEATURE_OK).toContain("ktri");
    expect(FEATURED_KINDS).toContain("ktri");
    expect(featuredOf("ktri", '{"_feat":0}')).toBe(false); // staff can still switch it off
    expect(NON_BIKE_KINDS.has("ktri")).toBe(true);
    expect(isNonBike("ktri", KT.id)).toBe(true);
    expect(isNonBike(null, "2099-12-04-kt")).toBe(true); // by its id when the session did not load
    expect(rentsBikes("ktri")).toBe(false);
    expect(waiverKind(ticketSession(KT)!)).toBe("activity");
    expect(EVENT_OF.ktri).toBe("community");
    expect(KIND_ORDER.at(-1)).toBe("ktri");
    expect(LM_KINDS).toContain("ktri");
    expect(isKtri(s)).toBe(true);
  });
  it("is shown to everyone, its Details too, and says who books and who enters the race", () => {
    const s = toSession(KT)!;
    expect(eventCards([s], { member: false, petromin: false })[0].sessions.map((x) => x.id)).toEqual([KT.id]);
    expect(membersOnlyDate(s)).toBe(false);
    expect(infoWho(s, { all: "Everyone", members: "Community members", members18: "", petromin: "", vlap: "", ktri: "Members book; anyone enters" })).toBe("Members book; anyone enters");
    expect(featuredDates([{ card: { key: "community" }, sessions: [s] }])).toEqual([{ ev: "community", id: KT.id }]);
  });
  it("is at KAUST Urban Beach, the place staff named or else its own, with that place's map", () => {
    const words = { meetingPoint: "Meeting point", venueCircuit: "Jeddah Corniche Circuit", venueJyc: "Jeddah Yacht Club" };
    expect(infoPlace({ ...toSession(KT)!, location: null }, words, "https://dir")).toEqual({ name: "KAUST Urban Beach", map: null });
    expect(infoPlace({ ...toSession(KT)!, meetUrl: "https://maps.app.goo.gl/x" }, words, "https://dir").map).toBe("https://maps.app.goo.gl/x");
    const t = ticketSession({ ...KT, location: null })!;
    expect(venueText(venueOf(t), TICKET.en)).toBe("KAUST Urban Beach");
    expect(placeLink(t, "https://dir")).toBe("https://www.google.com/maps/search/?api=1&query=KAUST%20Urban%20Beach");
  });
});

describe("the races (lib/ktri.ts)", () => {
  it("are the organiser's five, with their starts and entry fees", () => {
    expect(KTRI_RACES.map((r) => [r.key, r.start, r.fee, r.per])).toEqual([
      ["oly", "06:30", 250, "ind"], ["spr", "07:30", 250, "ind"], ["oly_team", "06:30", 600, "team"], ["spr_team", "07:30", 600, "team"], ["champs", "09:00", 30, "kid"],
    ]);
    expect(KTRI_REG_URL).toBe("https://rec.coastline-fm.com/events/kaust-triathlon-2026/register");
  });
  it("reads a race as stored, and a ticket's post, safely", () => {
    expect(triRaceOf("spr_team")).toBe("spr_team");
    for (const v of [null, "", "relay", 3, "OLY"]) expect(triRaceOf(v)).toBeNull();
    expect(triRaceBody({ entryId: "q1abcdef", race: "champs" })).toEqual({ entryId: "q1abcdef", race: "champs" });
    for (const b of [null, {}, { entryId: "q1" }, { entryId: "q1", race: "x" }, { entryId: "a b", race: "oly" }]) expect(triRaceBody(b), JSON.stringify(b)).toBeNull();
  });
  it("says each race in the page's words, a relay team with its race's distances", () => {
    const opts = ktriRaceOpts(TICKET.en, (x) => x, (n) => `SAR ${n}`);
    expect(opts[0]).toEqual({ key: "oly", name: "Olympic", dist: "1.5 km swim · 40 km bike · 10 km run", start: "Starts 06:30", fee: "Race entry SAR 250" });
    expect(opts[3]).toEqual({ key: "spr_team", name: "Sprint relay team", dist: "400 m swim · 20 km bike · 5 km run", start: "Starts 07:30", fee: "Race entry SAR 600 per team" });
    expect(opts[4].fee).toBe("Race entry SAR 30 per child");
  });
  it("sets the name as the poster does, and sends anyone but a member to register", () => {
    expect(ktriTitle("KAUST Triathlon")).toEqual({ k: "KAUST", rest: "Triathlon" });
    expect(ktriTitle("ترايثلون كاوست")).toEqual({ k: null, rest: "ترايثلون كاوست" });
    expect(ktriOut({ members: true }, false)).toBe(true);
    expect(ktriOut({ members: true }, true)).toBe(false);
    // open to everyone (open_to_all, the user 2026-11-22: "allow everyone to be able to book it not only community"): nobody
    expect(ktriOut({ members: false }, false)).toBe(false);
    expect(ktriOut({ members: false }, true)).toBe(false);
  });
});

describe("the KAUST Triathlon on Experiences", () => {
  it("is a featured date inside MicroMobility Experiences, shown to a visitor who is not signed in, who is sent to register", async () => {
    const p = await experiences([KT, SAT, JCC]);
    expect(p.events.map((e) => e.key)).toEqual(["community", "jcc"]);
    expect(p.featured).toEqual([{ ev: "community", id: KT.id }]);
    const s = ktOf(p);
    expect(s).toMatchObject({ kind: "ktri", name: "KAUST Triathlon", members: true, free: true, paid: false });
    expect(s.here).toBeUndefined(); // handed to the booking app, which asks which race
    expect(s.ktri).toEqual({
      title: { k: "KAUST", rest: "Triathlon" }, sbr: "Swim · Bike · Run", meta: ["Report 6 AM", "KAUST Urban Beach"],
      bike: { k: "Bike collection", v: "Sharafeyah branch · Thursday 3 Dec, during working hours" }, foot: "Register on the race website",
      step: "Which race are you doing? Pick one. You enter and pay for the race itself on the KAUST Triathlon website, as the last step.",
      out: { url: KTRI_REG_URL, msg: "Registration for the race is on the KAUST Triathlon website. Booking a place in the MicroMobility group is for our community members.", btn: "Go to registration" },
    });
  });
  it("books a community member's place in the group", async () => {
    asMember();
    const s = ktOf(await experiences([KT]));
    expect(s.ktri?.out).toBeNull();
    expect(s.ktri?.foot).toBe("Book your place in our group");
  });
  it("gives its Details its own text, who books, when to report, the races, the fees, when entries close, the gate pass and the race's website", async () => {
    const i = ktOf(await experiences([KT])).info;
    expect(i.text).toMatch(/^The KAUST Triathlon at KAUST Urban Beach/);
    expect(i).toMatchObject({ who: "Community members book a place in our group. Anyone can enter the race on the KAUST Triathlon website.", place: "KAUST Urban Beach", distance: null });
    expect(i.more?.map((x) => x.k)).toEqual(["Report", "Bike collection", "Races", "Race entry", "Registration closes", "Gate pass"]);
    expect(i.more?.[1].v).toBe("Sharafeyah branch · Thursday 3 Dec, during working hours");
    expect(i.more?.[2].v).toBe("Olympic 6:30 AM · Sprint 7:30 AM · Future Champs 9 AM");
    expect(i.more?.[4].v).toBe("Wed 2 Dec · 11:50 PM");
    expect(i.race).toEqual({ label: "Race registration", link: "Registration website", url: KTRI_REG_URL });
  });
  it("says it in Arabic in the booking app's words, and in a language the booking app does not speak (German)", async () => {
    const ar = ktOf(await experiences([KT], "ar"));
    expect(ar.name).toBe("ترايثلون كاوست");
    expect(ar.ktri?.sbr).toBe("سباحة · دراجة · جري");
    expect(ar.ktri?.foot).toBe("سجّل عبر موقع السباق");
    const de = ktOf(await experiences([KT], "de"));
    expect(de.ktri?.sbr).toBe("Schwimmen · Rad · Laufen");
    expect(de.ktri?.foot).toBe("Auf der Rennwebsite anmelden");
    expect(de.info.text).toMatch(/^Der KAUST Triathlon/);
  });
  it("is everyone's to book when open to all: the usual hand-over, its own words, and Everyone for who", async () => {
    const p = await experiences([{ ...KT, open_to_all: true }]);
    const s = ktOf(p);
    expect(s.members).toBe(false);
    expect(s.ktri?.out).toBeNull();
    expect(s.ktri?.foot).toBe("Book your place in our group");
    expect(s.info.who).toBe("Everyone");
    const html = draw(p, 3, comm(p), s);
    expect(html).toMatch(/<a class="xs-go ev-ktri" href="[^"]*ev=community&amp;session=2099-12-04-kt[^"]*">/);
    expect(html).toContain("Bike collection: <bdi>Sharafeyah branch · Thursday 3 Dec, during working hours</bdi>");
    expect(html).not.toContain(KTRI_REG_URL);
    expect(await eventsPage([{ ...KT, open_to_all: true }])).not.toContain(KTRI_REG_URL);
  });
  it("draws its date card in Red Sea Dawn: the sea, the mark, KAUST in heavy blue, SWIM · BIKE · RUN, no Members tag nor note", async () => {
    const p = await experiences([KT, SAT]);
    const html = draw(p, 2, comm(p));
    const card = /<button type="button" class="sc-card sc-ktri ev-ktri"[^>]*>.*?<\/button>/.exec(html)?.[0] ?? "";
    expect(card).toContain('<svg class="sc-kt-scene"');
    expect(card).toContain(`<img class="sc-kt-mark" src="${KTRI_MARK}"`);
    expect(card).toContain('<span class="sc-kt-title"><b class="sc-kt-k">KAUST</b> <span>Triathlon</span></span>');
    expect(card).toContain("<span>Swim · Bike · Run</span>");
    expect(card).toContain("Register on the race website");
    expect(card).not.toContain("Members");
    // its Details are everyone's: the "i" beside it to a visitor who is not signed in
    expect(html).toMatch(/aria-label="Details · KAUST Triathlon · /);
  });
  it("sends a visitor who is not a member to the race's registration website from its last step, in a new tab", async () => {
    const p = await experiences([KT]);
    const html = draw(p, 3, comm(p), ktOf(p));
    expect(html).toContain('<div class="xs-kt-head"><svg class="sc-kt-scene"');
    expect(html).toContain(`<a class="xs-go ev-ktri" href="${KTRI_REG_URL}" target="_blank" rel="noopener">Go to registration`);
    expect(html).toContain("Booking a place in the MicroMobility group is for our community members.");
    expect(html).not.toContain("booking.micromobility");
    expect(html).not.toContain('class="xs-note"');
  });
  it("hands a member over to the booking app on its date, with the race step's line", async () => {
    asMember();
    const p = await experiences([KT]);
    const html = draw(p, 3, comm(p), ktOf(p));
    expect(html).toMatch(/<a class="xs-go ev-ktri" href="[^"]*ev=community&amp;session=2099-12-04-kt[^"]*">/);
    expect(html).toContain('<p class="xs-handoff">Which race are you doing?');
    expect(html).not.toContain("add the participants");
    expect(html).not.toContain(KTRI_REG_URL);
  });
  it("draws its Featured card in its sky with what a tap does", async () => {
    const html = draw(await experiences([KT]), 1);
    expect(html).toMatch(/<button type="button" class="xs-feat-card ev-ktri xs-feat-kt">/);
    expect(html).toContain('<span class="xs-feat-name sc-kt-title"><b class="sc-kt-k">KAUST</b>');
    expect(html).toContain("<bdi>Report 6 AM</bdi>");
    expect(html).toContain("<bdi>Register on the race website</bdi>");
  });
});

describe("the KAUST Triathlon on Events", () => {
  it("is listed to everyone in its blue with when to report and where, a non-member sent to register", async () => {
    const html = await eventsPage([KT, JCC]);
    expect(html).toContain("KAUST Triathlon");
    expect(html).toContain("--kind:#1565b4");
    expect(html).toContain("<span>Report <bdi>6 AM</bdi></span>");
    expect(html).toContain("<span>Bike collection: <bdi>Sharafeyah branch · Thursday 3 Dec, during working hours</bdi></span>");
    expect(html).toContain("<span><bdi>KAUST Urban Beach</bdi></span>");
    expect(html).toContain(`<a href="${KTRI_REG_URL}" target="_blank" rel="noopener">Register on the race website</a>`);
  });
  it("is booked by a member on the community card", async () => {
    asMember();
    const html = await eventsPage([KT]);
    expect(html).toContain("ev=community&amp;session=2099-12-04-kt");
    expect(html).not.toContain(KTRI_REG_URL);
  });
});

describe("a KAUST Triathlon ticket (My Account)", () => {
  const kt = ticketSession(KT)!;
  const base = { id: "q1abcdef", session_id: kt.id, session_date: kt.date, session_day: "Friday", status: "waiting", queue_num: 7, price: 0, paid: false, type_preference: "None", name: "Sara Haddad", race_reg: null };
  const card = (rows: TicketRow[], ar = false, typePrices: Record<string, number> | null = null) => renderToStaticMarkup(createElement(TicketCard, {
    locale: ar ? "ar" : "en", today: "2099-11-25", rows, session: kt, name: ar ? "ترايثلون كاوست" : "KAUST Triathlon", cue: ticketCue(rows, kt, null), t: ar ? TICKET.ar : TICKET.en,
    gather: "Gathering", start: "Start", typeName: (x: string) => x,
    links: { edit: null, manage: "https://book.example.test/?tab=bookings", place: placeLink(kt, "https://dir.example.test/jcc") },
    now: Date.parse("2099-11-25T09:00:00Z"), typePrices,
  })).replace(/^(<link [^>]*>)+/, "");

  it("has no bike, is free, reads its race, and still asks whether the race was entered", () => {
    expect(kt).toMatchObject({ kind: "ktri", bikes: false, gathers: false, free: true, approval: false });
    const r = ticketRow({ ...base, tri_race: "spr" })!;
    expect(r.triRace).toBe("spr");
    expect(ticketRow(base)!.triRace).toBeUndefined(); // a read without the column
    expect(raceRegAsked(r, kt, "2099-11-25")).toBe(true);
    expect(raceRegAsked({ ...r, status: "done" }, kt, "2099-11-25")).toBe(false);
  });
  it("wears its look: the mark, when to report, the race and Change, the gate pass, Free, cancel only", () => {
    const html = card([ticketRow({ ...base, tri_race: "spr", race_reg: "yes" })!]);
    expect(html).toMatch(/^<article class="tk-card ev-ktri/);
    expect(html).toContain(`<span class="tk-logo tk-logo-ktri" aria-hidden="true"><img src="${KTRI_MARK}"`);
    expect(html).toContain('<span class="tk-kt-k">Report</span><span class="tk-kt-v">6 AM · KAUST Urban Beach</span>');
    expect(html).toContain("<b>Sprint</b> · <bdi>Starts 7:30 AM</bdi>");
    expect(html).toContain('<span class="tk-kt-k">Gate pass</span>');
    // no bike rented (Future Champs, 'None'): no bike row, no collection
    expect(html).not.toContain("Your bike");
    expect(html).not.toContain("Bike collection");
    expect(html).toContain("You told us you registered on the KAUST Triathlon website.");
    expect(html).toMatch(/<div class="tk-total"><span>Total<\/span><strong>Free<\/strong>/);
    expect(html).not.toContain("tk-rider-pay"); // no price of 0 for the participant
    expect(html).not.toMatch(/>Edit<|>Reschedule</);
  });
  it("says a rented bike with its size and price paid at the Sharafeyah branch, and where and when it is collected", () => {
    const html = card([ticketRow({ ...base, tri_race: "oly", type_preference: "Road", size: "M", race_reg: "yes" })!], false, { Road: 75 });
    expect(html).toContain('<span class="tk-kt-k">Your bike</span><span class="tk-kt-v tk-kt-bike">Road · M · ⁦⃁ 75⁩, paid at the Sharafeyah branch</span>');
    expect(html).toContain('<span class="tk-kt-k">Bike collection</span><span class="tk-kt-v">Sharafeyah branch · Thursday 3 Dec, during working hours</span>');
    // no price the site knows: the type and size alone
    expect(card([ticketRow({ ...base, tri_race: "oly", type_preference: "Road", size: "M" })!])).toContain('<span class="tk-kt-v tk-kt-bike">Road · M</span>');
    // done: the bike said, nothing to collect
    expect(card([ticketRow({ ...base, status: "done", tri_race: "oly", type_preference: "Road" })!], false, { Road: 75 })).not.toContain("Bike collection");
  });
  it("says Own bike for one's own bike, and nothing to collect", () => {
    const html = card([ticketRow({ ...base, tri_race: "spr", type_preference: "Own", race_reg: "yes" })!], false, { Road: 75 });
    expect(html).toContain('<span class="tk-kt-k">Your bike</span><span class="tk-kt-v tk-kt-bike">Own bike</span>');
    expect(html).not.toContain("Bike collection");
    expect([ktriBike("Hybrid"), ktriBike("Own"), ktriBike("None"), ktriBike(""), ktriBike("Any")]).toEqual(["rent", "own", null, null, null]);
    expect(ktriBikeText("None", null, { typeName: (x) => x, pay: "{0}", own: "Own bike", price: "x" })).toBe("");
  });
  it("asks a member who has no race yet to pick one of the five", () => {
    const html = card([ticketRow({ ...base, tri_race: null })!]);
    expect(html).toContain('<p class="tk-kt-k" id="tk-kt-q1abcdef">Pick your race</p>');
    expect(html.match(/class="tk-kt-opt/g)).toHaveLength(5);
    expect(html).toContain("Race entry ⁦⃁ 600⁩ per team");
  });
  it("shows the race's registration website and that it is required at once, with no discount code", () => {
    const html = card([ticketRow({ ...base, tri_race: "oly", race_reg: "no" })!]);
    expect(html).toContain('<p class="tk-rr-sub tk-kt-must">Registering and paying on the KAUST Triathlon website is required.');
    expect(html.match(/class="tk-rr-link"/g)).toHaveLength(1);
    expect(html).toContain(`<a class="tk-rr-link" href="${KTRI_REG_URL}" target="_blank" rel="noopener">Register on the KAUST Triathlon website</a>`);
    expect(html).not.toContain("tk-rr-code");
    expect(html).not.toContain("MICRO50");
  });
  it("says it in Arabic in the booking app's words", () => {
    const html = card([ticketRow({ ...base, tri_race: "champs" })!], true);
    expect(html).toContain("جري أبطال المستقبل");
    expect(html).toContain("تصريح الدخول");
  });
});

describe("the race pop-up on a KAUST Triathlon place", () => {
  it("asks for a live place with no answer, as on the DEFE run", () => {
    const row = { id: "q1", session_id: "2099-12-04-kt", session_date: "2099-12-04", status: "waiting", customer_id: "c1", race_reg: null };
    const kinds = new Map([["2099-12-04-kt", { kind: "ktri" as const }]]);
    expect(pendingRaceRegs([row], kinds, "2099-11-25", "c1").map((x) => x.entryId)).toEqual(["q1"]);
    expect(pendingRaceRegs([{ ...row, race_reg: "yes" }], kinds, "2099-11-25", "c1")).toEqual([]);
  });
});

describe("the KAUST Triathlon's race pop-up (the user, 2026-11-22: \"make sure to force them to register through kaust and pay the triathlon fees from there\")", () => {
  const w = { entryId: "q1abcdef", name: "KAUST Triathlon", when: "Fri 4 Dec", time: "6 AM – 11 AM", venue: "KAUST Urban Beach", url: KTRI_REG_URL };
  const kt = { q: TICKET.en.ktRegQ, sub: TICKET.en.ktRegSub, noNote: TICKET.en.ktRegNoNote, code: "", must: TICKET.en.ktRegMust, link: TICKET.en.ktRegLink, yes: "Yes", no: "No", failed: "x" };
  it("shows the registration link and that it is required at once, and never Done after No", () => {
    for (const answer of [null, "no"] as const) {
      const html = renderToStaticMarkup(createElement(RaceGate, { ...w, answer, t: kt, onDone: () => {} }));
      expect(html).toContain('<p class="rr-note rr-must">Registering and paying on the KAUST Triathlon website is required.');
      expect(html).toContain(`<a class="rr-link" href="${KTRI_REG_URL}" target="_blank" rel="noopener">Register on the KAUST Triathlon website</a>`);
      expect(html).not.toContain(">Done<");
      expect(html).toContain(">Sign out<");
    }
  });
  it("keeps the DEFE run's Done after No", () => {
    const html = renderToStaticMarkup(createElement(RaceGate, { ...w, url: undefined, answer: "no", t: { ...kt, must: undefined, code: TICKET.en.defeRegCode }, onDone: () => {} }));
    expect(html).toContain(">Done<");
    expect(html).not.toContain("rr-must");
  });
});

describe("api/account/tri-race", () => {
  const TOKEN = "a1b2c3d4e5f6a7b8c9d0";
  const HEADERS = { origin: "https://micromobility.sa", cookie: `mm_acct=c1~${TOKEN}`, "content-type": "application/json" };
  const post = (body: unknown, headers: Record<string, string> = HEADERS) =>
    POST(new Request("https://micromobility.sa/api/account/tri-race", { method: "POST", headers, body: JSON.stringify(body) }));
  it("saves the race through customer_set_tri_race with the cookie's id and token", async () => {
    const f = vi.fn(async () => json(true));
    vi.stubGlobal("fetch", f);
    const res = await post({ entryId: "q1abcdef", race: "oly_team" });
    expect([res.status, await res.json()]).toEqual([200, { ok: true }]);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://example.supabase.co/rest/v1/rpc/customer_set_tri_race");
    expect(JSON.parse(String(init.body))).toEqual({ p_id: "c1", p_token: TOKEN, p_entry_id: "q1abcdef", p_race: "oly_team" });
  });
  it("refuses a body it cannot read, another site, a signed-out visitor and the database's no", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(false)));
    expect((await post({ entryId: "q1abcdef", race: "relay" })).status).toBe(400);
    expect((await post({ entryId: "q1abcdef", race: "oly" }, { ...HEADERS, origin: "https://evil.example" })).status).toBe(403);
    expect((await post({ entryId: "q1abcdef", race: "oly" }, { origin: HEADERS.origin, "content-type": "application/json" })).status).toBe(401);
    const res = await post({ entryId: "q1abcdef", race: "oly" });
    expect([res.status, await res.json()]).toEqual([409, { ok: false, error: "refused" }]);
  });
});

describe("the KAUST Triathlon Finisher badge", () => {
  it("is staff's to give, held only, drawn as the race medal with KAUST struck on it", () => {
    expect(BADGE_SYS.kaust_triathlon).toEqual(["kaust_triathlon", "blue"]);
    expect(HELD_ONLY.has("kaust_triathlon")).toBe(true);
    const svg = renderToStaticMarkup(createElement(Medal, { icon: "kaust_triathlon", color: "blue" }));
    expect(svg).toContain("bdg-race");
    expect(svg).toMatch(/>KAUST<\/text>/);
    expect(svg).toContain('fill="#0e959a"');
    expect(RECORD.en.names.kaust_triathlon).toEqual(["KAUST Triathlon Finisher", "Finished the KAUST Triathlon", expect.stringContaining("the Future Champs run")]);
    expect(RECORD.ar.names.kaust_triathlon[0]).toBe("إنجاز ترايثلون كاوست");
    expect(serverLocalize(RECORD, "ja").names.kaust_triathlon[0]).toBe("KAUST Triathlon 完走");
  });
});

describe("the KAUST Triathlon's look", () => {
  const css = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  it("draws its card, Featured card, summary and ticket in the booking app's Red Sea Dawn tokens", () => {
    const booking = css("../../components/booking/booking.css"), xp = css("../../components/experiences/experiences.css");
    for (const t of ["--kt-blue: #1565B4", "--kt-blue-dk: #0D4B8C", "--kt-navy: #0F2540", "--kt-ink-2: #3C5470", "--kt-sky: #E6F1FB", "--kt-sky-2: #F5F9FD", "--kt-sea: #0E959A"]) expect(booking, t).toContain(t);
    for (const sel of [".sc-card.sc-ktri", ".sc-kt-scene", ".sc-kt-k", ".sc-kt-sbr", ".tk-card.ev-ktri", ".tk-kt-know", ".tk-kt-opt", ".tk-logo.tk-logo-ktri"]) expect(booking, sel).toContain(sel);
    for (const sel of [".xs-feat-card.xs-feat-kt", ".xs-kt-head", ".xs .xs-go.ev-ktri", ".xs-info.ev-ktri .xs-info-go"]) expect(xp, sel).toContain(sel);
    // KAUST in Rubik's heaviest weight: the layout loads it
    expect(css("../../app/[locale]/layout.tsx")).toMatch(/Rubik\(\{[^}]*weight: \["800", "900"\]/);
  });
  it("has the booking app's mark", () => {
    expect(KTRI_MARK).toBe("/site/ktri-mark.svg");
    const svg = readFileSync(new URL("../../../public/site/ktri-mark.svg", import.meta.url), "utf8");
    expect(svg).toMatch(/^<svg[^>]*viewBox="0 0 64 40"/);
    expect(svg).toContain("#E8834A");
  });
});
