import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, isValidElement, type ReactElement } from "react";
// The site has no @types/react-dom; this test needs one function of it (as rating.test.ts does).
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import ExperienceSteps from "@/components/experiences/ExperienceSteps";
import TicketCard from "@/components/booking/TicketCard";
import { T as TICKET } from "@/components/booking/tickets.text";
import { PAGES } from "@/content";
import { FARM_NAME, farmName, farmWords } from "@/content/farm-words";
import { clientDict } from "@/i18n/dicts";
import { TRANSLATED } from "@/i18n/locales";
import { makeL } from "@/i18n/tx";
import { bookingAt, dateText, EVENT_CARDS, EVENT_OF, eventCards, fillTimes, infoPlace, infoPlaces, infoPrice, infoTimes, infoWho, rentsBikes } from "../event-info";
import { FEATURE_OK, FEATURED_KINDS, kindNames, resetRides, rideKind, sessionName, toSession, upcoming } from "../rides";
import { resetSiteContent } from "../site";
import { codeReady, countdownMoments, fmtClock, icsFor, icsPlace, meetsAt, placeLink, ticketCue, ticketRow, ticketSession, venueOf, venueText, type TicketRow } from "../tickets";
import { isNonBike } from "../bike-kinds";
import { waiverKind } from "../waiver";
import { FARM_MARK, FARM_MARK_SIZE, farmForMembers, isFarm } from "../farm";
import { KIND_ORDER } from "../kind-theme";
import { LM_KINDS } from "../landmarks";
import ExperiencesPage from "../../app/[locale]/experiences/page";
import EventsPage from "../../app/[locale]/events/page";

// cookies() is a request's; here it holds the account's cookie a test sets, or none, and whether the booking app's members'
// check (community_member) says that account is a community member.
const jar = vi.hoisted(() => ({ account: "", member: false }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (n === "mm_acct" && jar.account ? { name: n, value: jar.account } : undefined) }) }));
// The steps open on the event cards (useState(1)); a test draws a later step, or an open dialog, by handing the component's
// first states in order: the step, the event, the date, the kind, the dialog. Each render takes them once.
const states = vi.hoisted(() => ({ queue: [] as unknown[] }));
vi.mock("react", async (importOriginal) => {
  const R = await importOriginal<typeof import("react")>();
  return { ...R, useState: ((v: unknown) => R.useState(states.queue.length ? states.queue.shift() : v)) as typeof R.useState };
});
const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;

// The Farm House Night (the user, 2026-11-13: "create a seesion Nawar Farm House Night ... put it under micromobility
// experiences card not to public, every member can bring family members with them and add them to their bookings"), on
// the website as the booking app makes it (supabase/checks/farm-night-2026-11-19.sql in the booking site's repo): a date
// inside MicroMobility Experiences for members and their families, free, staff approve every place as on the Saturday
// ride, arrival from 4:30 PM and dinner at 8:30 PM at Little Farmhouse, Dhahban. The family is added in the booking app,
// which this site hands the date over to; the site draws its card, its Details, its Featured card, its summary, its place
// on Events and its ticket on My Account, in the booking app's "Harvest Supper" look. Unlike yoga and the Saturday ride it
// is "not to public": the site shows it to a signed-in community member alone, and no other visitor's page holds a word of
// it (the last describe).
const MAP = "https://maps.app.goo.gl/BYteRL5JCueWZUEs6";
const FH = {
  id: "2099-11-19-fh", session_date: "2099-11-19", day: "Thursday", status: "open", event_kind: "community", ride_kind: "farm",
  title: "Nawar Farm House Night", title_ar: "ليلة مزرعة نوار", open_to_all: false, paid_ride: false, needs_approval: true, hide_queue: true,
  price: null, capacity: 60, spots: 60, bike_slots: '{"_time":"16:30 - 20:30"}', location: "Little Farmhouse, Dhahban", meet_url: MAP,
  description: null, cancelled_at: null, draft: false, opens_at: null,
};
const SAT = { id: "2099-11-21", session_date: "2099-11-21", day: "Saturday", status: "open", event_kind: "community", ride_kind: "saturday", title: null, open_to_all: false, paid_ride: false, needs_approval: true, hide_queue: true, capacity: 120, bike_slots: '{"_time":"05:45 - 06:15"}', location: null, meet_url: null };
const JCC = { id: "2099-11-22", session_date: "2099-11-22", day: "Sunday", status: "open", event_kind: null, ride_kind: null, title: null, capacity: 40, bike_slots: '{"_time":"21:00 - 23:00"}', location: "JCC", meet_url: null };
/** The words that would mean a bike or riding, read in what a visitor is shown of the night. */
const BIKE_WORDS = /\b(bike|bikes|ride|rides|rider|riders|riding|cycling|helmets?)\b/i;
/** A signed-in account's cookie (lib/account-core.ts decodeSession's shape). */
const ACCOUNT = "c1~a1b2c3d4e5f6a7b8c9d0";
/** A signed-in community member, for the tests that look at the night as members see it. */
const asMember = () => { jar.account = ACCOUNT; jar.member = true; };

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
/** Every element of `type` in a tree a page returned, its own children unrendered. */
function findAll(n: unknown, type: unknown, out: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(n)) { for (const x of n) findAll(x, type, out); return out; }
  if (!isValidElement(n)) return out;
  if (n.type === type) out.push(n);
  findAll((n.props as { children?: unknown }).children, type, out);
  return out;
}
/** A page's database: the sessions through list_sessions, the members' check, nothing for anything else. */
const db = (sessions: unknown[]) => vi.fn(async (url: string, init?: RequestInit) => {
  if (url.includes("/rpc/list_sessions")) return json(sessions);
  if (url.includes("/rpc/community_member")) return json(!!jar.account && jar.member);
  if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": "0-0/0" } });
  return json([]);
});
type Props = Parameters<typeof ExperienceSteps>[0];
const experiences = async (sessions: unknown[], locale = "en") => {
  resetRides(); // each page reads its own sessions, never the minute's copy of the last
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
/** The steps drawn with their first states handed in (states.queue). */
const draw = (props: Props, ...first: unknown[]) => {
  states.queue = [...first];
  try { return renderToStaticMarkup(createElement(ExperienceSteps, props)); } finally { states.queue = []; }
};
const comm = (p: Props) => p.events.find((e) => e.key === "community")!;
const farmOf = (p: Props) => comm(p).sessions.find((s) => s.kind === "farm")!;
const text = (html: string | undefined) => (html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const css = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

beforeEach(() => {
  resetRides(); resetSiteContent();
  jar.account = ""; jar.member = false;
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); states.queue = []; });

describe("the Farm House Night as the site reads it (ride_kind 'farm')", () => {
  it("is a kind of its own on a community session only, without a bike, featured as made", () => {
    expect(rideKind({ event_kind: "community", ride_kind: "farm" })).toBe("farm");
    expect(rideKind({ event_kind: null, ride_kind: "farm" })).toBe("jcc");
    expect(isFarm({ kind: "farm" })).toBe(true);
    expect(isFarm({ kind: "yoga" })).toBe(false);
    expect(isNonBike("farm")).toBe(true);
    expect(isNonBike(null, "2099-11-19-fh")).toBe(true); // by its id when the session did not load
    expect(rentsBikes("farm")).toBe(false);
    expect(FEATURE_OK).toContain("farm");
    expect(FEATURED_KINDS).toContain("farm");
    // between yoga and the DEFE run on the Experiences card's marks, after yoga on Stats' kinds tried (the booking app's
    // COMM_MARKS and LM_KINDS)
    expect(KIND_ORDER.indexOf("farm")).toBe(KIND_ORDER.indexOf("yoga") + 1);
    expect(LM_KINDS.indexOf("farm")).toBe(LM_KINDS.indexOf("yoga") + 1);
  });
  it("reads members only, free, approved by staff, arrival then dinner, no bike collection, at the farm with its map", () => {
    expect(toSession(FH)).toMatchObject({
      id: "2099-11-19-fh", kind: "farm", members: true, free: true, approval: true, published: false, times: ["16:30", "20:30"], gather: true,
      collect: null, price: null, seats: null, left: null, capacity: 60, location: "Little Farmhouse, Dhahban", meetUrl: MAP, titleAr: "ليلة مزرعة نوار", featured: true,
    });
    expect(toSession({ ...FH, bike_slots: '{"_time":"16:30 - 20:30","_feat":0}' })).toMatchObject({ featured: false });
    // it stays on the list until dinner, its second time, has come
    const s = toSession(FH)!;
    expect(upcoming([s], "2099-11-19T20:00").map((x) => x.id)).toEqual(["2099-11-19-fh"]);
    expect(upcoming([s], "2099-11-19T20:30")).toEqual([]);
  });
  it("is named by its own title, its Arabic name on the Arabic page, and Farm House Night without one", () => {
    // its name is no field of the Website editor (content/farm-words.ts): a page adds it, as the Blood Donation event's
    expect(kindNames({ farmName: "Farm House Night" }).farm).toBe("");
    const en = { ...kindNames({}), farm: FARM_NAME }, ar = { ...kindNames({}), farm: farmName(makeL("ar", null)) };
    expect(sessionName({ kind: "farm", title: "Nawar Farm House Night", titleAr: "ليلة مزرعة نوار" }, en, en, false)).toBe("Nawar Farm House Night");
    expect(sessionName({ kind: "farm", title: "Nawar Farm House Night", titleAr: "ليلة مزرعة نوار" }, ar, en, true, true)).toBe("ليلة مزرعة نوار");
    expect(sessionName({ kind: "farm", title: null }, en, en, false)).toBe("Farm House Night");
    expect(sessionName({ kind: "farm", title: "Farm House Night" }, ar, en, true)).toBe("ليلة المزرعة");
  });
  it("has its name and Details text in the server's words, the booking app's own, filled with arrival and dinner", () => {
    const en = farmWords(makeL("en", null)), ar = farmWords(makeL("ar", null));
    expect([en.name, ar.name]).toEqual(["Farm House Night", "ليلة المزرعة"]);
    expect([en.arrive, en.dinner, ar.arrive, ar.dinner]).toEqual(["Arrival", "Dinner", "الوصول", "العشاء"]);
    expect([en.line, ar.line]).toEqual(["Members and their families", "للأعضاء وعائلاتهم"]);
    expect([en.who, ar.who]).toEqual(["Community members and their families", "أعضاء المجتمع وعائلاتهم"]);
    expect(en.about).toBe("An evening at the farm for community members and their families. Arrive from {gather}, enjoy the farm with the community, and stay for dinner at {start}. Add each family member to your booking by name. Our team confirms every request, as for the Saturday ride.");
    expect(ar.about).toBe("أمسية في المزرعة لأعضاء المجتمع وعائلاتهم. الوصول من {gather}، استمتع بالمزرعة مع المجتمع، وابقَ لتناول العشاء في {start}. أضف كل فرد من عائلتك إلى حجزك باسمه. يؤكّد فريقنا كل طلب، كما في جولة السبت.");
    const s = toSession(FH)!, times = infoTimes(s, (x) => fmtClock(x, "en"));
    expect(times).toEqual({ gather: "4:30 PM", start: "8:30 PM", end: "", collect: "" });
    expect(fillTimes(en.about, times)).toContain("Arrive from 4:30 PM, enjoy the farm with the community, and stay for dinner at 8:30 PM.");
  });
});

describe("the Farm House Night's facts (lib/event-info.ts)", () => {
  const s = toSession(FH)!;
  it("is a date inside MicroMobility Experiences, never a card of its own, handed over on the community card, to a member alone", () => {
    const all = [s, toSession(SAT)!, toSession(JCC)!];
    const cards = eventCards(all, { member: true, petromin: false });
    expect(cards.map((c) => c.card.key)).toEqual(["community", "jcc"]);
    expect(cards[0].sessions.map((x) => x.id)).toEqual(["2099-11-19-fh", "2099-11-21"]);
    // anyone else, signed in or not, finds the community card without it
    expect(eventCards(all, { member: false, petromin: false })[0].sessions.map((x) => x.id)).toEqual(["2099-11-21"]);
    expect(eventCards(all, { member: false, petromin: true })[0].sessions.map((x) => x.id)).toEqual(["2099-11-21"]);
    expect(EVENT_CARDS.map((c) => c.key)).not.toContain("farm");
    expect(EVENT_OF.farm).toBe("community");
    expect(bookingAt("https://book.example/", EVENT_OF.farm, FH.id)).toBe("https://book.example/?ev=community&session=2099-11-19-fh");
  });
  it("is for community members and their families, free, with no count of places: staff approve each one", () => {
    const who = { all: "Everyone", members: "Community members", members18: "x", petromin: "y", vlap: "z", farm: "Community members and their families" };
    expect(infoWho(s, who)).toBe("Community members and their families");
    expect(infoWho({ ...s, kind: "yoga" }, who)).toBe("Community members");
    expect(infoPrice(s, { free: "Complimentary", seat: null, from: "from SAR 57.5" })).toBe("Complimentary");
    expect(infoPlaces({ ...s, left: 3 }, { waitlist: "Waitlist", left1: "{0} spot left", leftN: "{0} spots left" })).toBeNull();
    expect(dateText(s, { aboutJcc: "J", aboutSat: "S", aboutPetro: "P", aboutSwim: "W", aboutWs: "T", aboutRun: "R", aboutVl: "V", aboutDefe: "D", aboutAr: "A", aboutYoga: "Y", aboutFarm: "Arrive {gather}, dinner {start}.", sndAbout: "N", evAbout: "E" }, infoTimes(s, (x) => fmtClock(x, "en")))).toBe("Arrive 4:30 PM, dinner 8:30 PM.");
  });
  it("is at the place staff wrote with the farm's own map, never \"Meeting point\" nor the circuit", () => {
    const words = { meetingPoint: "Meeting point", venueCircuit: "Jeddah Corniche Circuit", venueJyc: "Jeddah Yacht Club" };
    expect(infoPlace(s, words, "https://dir")).toEqual({ name: "Little Farmhouse, Dhahban", map: MAP });
    // a farm night with its map and no place written meets at that point, as any ride staff approve
    expect(infoPlace({ ...s, location: null }, words, "https://dir")).toEqual({ name: "Meeting point", map: MAP });
    // the Saturday ride is unchanged: its meeting point
    expect(infoPlace({ ...s, kind: "saturday" }, words, "https://dir")).toEqual({ name: "Meeting point", map: MAP });
  });
});

describe("the Farm House Night on Experiences, to a signed-in community member", () => {
  beforeEach(asMember);
  it("gives its card its name, its arrival and dinner, where, and who it is for, members only and free", async () => {
    const p = await experiences([FH, SAT, JCC]);
    expect(p.events.map((e) => e.key)).toEqual(["community", "jcc"]);
    const s = farmOf(p);
    expect(s).toMatchObject({ id: FH.id, kind: "farm", name: "Nawar Farm House Night", members: true, free: true, paid: false, event: false, meta: [], route: null, breakfast: null, left: null });
    expect(s.farm).toEqual({ meta: ["Arrival 4:30 PM · Dinner 8:30 PM", "Little Farmhouse, Dhahban"], line: "Members and their families", arrive: "Arrival", dinner: "Dinner" });
    expect(s.when).toEqual({ gather: true, a: "4:30 PM", b: "8:30 PM" });
    expect(s.feat).toMatchObject({ wd: "Thu", dn: "19", mo: "Nov", len: null });
    expect(s.yoga).toBeUndefined();
    // the card's marks name the night among the kinds it holds
    expect(comm(p).marks?.kinds).toEqual(["saturday", "farm"]);
    expect(p.featured).toEqual([{ ev: "community", id: FH.id }]);
  });
  it("gives its Details who comes, when to arrive and when dinner is, the farm and its map, and no count of places", async () => {
    const i = farmOf(await experiences([FH])).info;
    expect(i).toMatchObject({ who: "Community members and their families", price: "Complimentary", collect: null, place: "Little Farmhouse, Dhahban", map: MAP, distance: null, places: null, extra: null });
    expect(i.text).toContain("Arrive from 4:30 PM, enjoy the farm with the community, and stay for dinner at 8:30 PM.");
    expect(i.more).toBeUndefined();
  });
  it("says it in Arabic by its Arabic name and the booking app's words", async () => {
    const s = farmOf(await experiences([FH], "ar"));
    expect(s.name).toBe("ليلة مزرعة نوار");
    expect(s.farm?.line).toBe("للأعضاء وعائلاتهم");
    expect(s.farm?.meta[0]).toMatch(/^الوصول .+ · العشاء .+$/);
    expect(s.info.who).toBe("أعضاء المجتمع وعائلاتهم");
    expect(s.info.text).toContain("الوصول من");
  });
  it("says its words in a language the booking app does not speak (German), and the app's own in one it does (French)", async () => {
    const de = farmOf(await experiences([FH], "de"));
    expect(de.farm?.line).toBe("Mitglieder und ihre Familien");
    expect(de.farm?.meta[0]).toMatch(/^Ankunft .+ · Abendessen .+$/);
    expect(de.info.who).toBe("Community-Mitglieder und ihre Familien");
    expect(de.info.text).toMatch(/^Ein Abend auf dem Bauernhof/);
    const fr = farmOf(await experiences([FH], "fr"));
    expect(fr.farm?.line).toBe("Membres et leur famille");
    expect(fr.farm?.meta[0]).toMatch(/^Arrivée .+ · Dîner .+$/);
  });

  it("draws its date card in the venue's rust: the fan of feathers, the mark, its name, arrival and dinner, where, never a count", async () => {
    const p = await experiences([FH, SAT]);
    const html = draw(p, 2, comm(p));
    const card = /<button type="button" class="sc-card sc-farm ev-farm"[^>]*>.*?<\/button>/.exec(html)?.[0] ?? "";
    expect(card).toContain('role="radio"');
    expect(card).toContain('<svg class="sc-fh-scene" aria-hidden="true" focusable="false" viewBox="0 0 160 80">');
    expect(card.match(/<rect class="sc-fh-fth"/g)).toHaveLength(11);
    expect(card).toContain(`<img class="sc-fh-mark" src="${FARM_MARK}" alt="" width="150" height="150" decoding="async"/>`);
    expect(card).toContain('<span class="sc-fh-title">Nawar Farm House Night</span>');
    expect(card).toContain('<span class="sc-fh-meta"><span class="sc-fh-mi"><span><i aria-hidden="true"></i><bdi>Arrival 4:30 PM · Dinner 8:30 PM</bdi></span><span><i aria-hidden="true"></i><bdi>Little Farmhouse, Dhahban</bdi></span></span></span>');
    expect(card).toContain('<span class="sc-fh-foot"><span class="sc-fh-line">Members and their families</span></span>');
    // staff choose who comes: never Available nor how many places are left
    expect(card).not.toMatch(/sc-spots|Available|left/);
    expect(text(card)).not.toMatch(BIKE_WORDS);
    // the Saturday ride beside it keeps its own card, and the list says Choose a date (rides and a session without a bike)
    expect(html).toContain('class="sc-card ev-saturday has-motif"');
    expect(html).toContain(">Choose a date<");
    // the kind switch names it by its kind's name, with its barn
    expect(html).toMatch(/<button type="button" class="xs-kind ev-farm" aria-pressed="false"><svg [^>]*><path d="M3\.5 20\.5V10L12 4l8\.5 6v10\.5M2\.5 20\.5h19M9 20\.5v-6h6v6M9 14\.5l6 6M15 14\.5l-6 6"><\/path><\/svg><span>Farm House Night<\/span><\/button>/);
  });
  it("says where it is on the waitlist on its card, on a cream pill, with its Details beside it", async () => {
    const full = await experiences([{ ...FH, status: "full" }]);
    const card = /<button type="button" class="sc-card sc-farm ev-farm full"[^>]*>.*?<\/button>/.exec(draw(full, 2, comm(full)))?.[0] ?? "";
    expect(card).toContain('<span class="sc-spots full">Waitlist</span>');
    const mine = await experiences([FH]);
    expect(draw(mine, 2, comm(mine))).toMatch(/<div class="sc-wrap ev-farm has-about"><button type="button" class="sc-card sc-farm ev-farm".*?<\/button><button type="button" class="sc-about" aria-haspopup="dialog" aria-label="Details · Nawar Farm House Night · Thursday · 19 Nov 2099">/);
  });
  it("opens Details that say who comes, arrival and dinner, the farm with its map, and the night's own text", async () => {
    const p = await experiences([FH]);
    const ev = comm(p), s = farmOf(p);
    const dialog = /<dialog .*<\/dialog>/.exec(draw(p, 2, ev, null, null, { ev, s }))?.[0] ?? "";
    expect(dialog).toMatch(/^<dialog class="xs-info ev-farm"/);
    expect(text(dialog)).toContain("Who Community members and their families");
    expect(text(dialog)).toContain("When Thursday · 19 Nov 2099 Arrival 4:30 PM · Dinner 8:30 PM");
    expect(dialog).toContain(`Little Farmhouse, Dhahban · <a href="${MAP}" target="_blank" rel="noopener">Map</a>`);
    expect(text(dialog)).not.toContain("Places");
    expect(text(dialog)).not.toMatch(/Gathering|Start /);
    expect(dialog).toContain('<button type="button" class="xs-info-go">Choose this date</button>');
  });
  it("draws its Featured card in the venue's rust: the day, its name, arrival and dinner, where, and who it is for", async () => {
    const html = draw(await experiences([FH]), 1);
    const card = /<button type="button" class="xs-feat-card ev-farm xs-feat-fh">.*?<\/button>/.exec(html)?.[0] ?? "";
    expect(card).toContain('<svg class="sc-fh-scene"');
    expect(card).toContain('<span class="xs-feat-name sc-fh-title">Nawar Farm House Night</span>');
    expect(text(card)).toBe("Thu 19 Nov Nawar Farm House Night Arrival 4:30 PM Dinner 8:30 PM Little Farmhouse, Dhahban Members and their families");
    expect(card).toContain('<span class="xs-feat-with"><bdi>Members and their families</bdi></span>');
    // drawn, never an emoji
    expect(html).not.toMatch(/\p{Extended_Pictographic}/u);
  });
  it("hands over on its summary in the booking app's rust plate, saying the family is added there", async () => {
    const p = await experiences([FH]);
    const html = draw(p, 3, comm(p), farmOf(p));
    expect(html).toContain('<div class="xs-sum-head xs-fh-head"><span class="xs-logo small xs-farm-logo"><img src="/site/farm-logo.jpg" alt="" width="150" height="150"/></span>');
    expect(html).toContain('<strong class="xs-fh-name">Nawar Farm House Night</strong>');
    expect(html).toContain("Arrival <bdi>4:30 PM</bdi> · Dinner <bdi>8:30 PM</bdi>");
    expect(html).toContain('<span class="xs-fh-sub">Members and their families</span>');
    expect(html).toMatch(/<a class="xs-go ev-farm" href="https:\/\/experiences\.micromobility\.sa\/\?lang=en&amp;ev=community&amp;session=2099-11-19-fh">/);
    expect(html).toContain('<p class="xs-handoff">The booking app opens on this date: sign in, add the participants and confirm.</p>');
    expect(text(/<section aria-labelledby="xs-h3">.*<\/section>/.exec(html)?.[0])).not.toMatch(BIKE_WORDS);
  });
});

describe("the Farm House Night on Events, to a signed-in community member", () => {
  beforeEach(asMember);
  it("is listed in its rust with its arrival and dinner and where, a members' date booked on the community card", async () => {
    const html = await eventsPage([FH, JCC]);
    expect(html).toContain("Nawar Farm House Night");
    expect(html).toContain("--kind:#8a3f27");
    expect(html).toContain("<span>Arrival <bdi>4:30 PM</bdi> · Dinner <bdi>8:30 PM</bdi></span>");
    expect(html).toContain("<span><bdi>Little Farmhouse, Dhahban</bdi></span>");
    expect(html).toContain("ev=community&amp;session=2099-11-19-fh");
    // a members' date is never advertised to search engines
    expect(/<script type="application\/ld\+json">(.*?)<\/script>/.exec(html)?.[1] ?? "").not.toContain("Farm");
  });
});

describe("a Farm House Night ticket (My Account)", () => {
  const fh = ticketSession({ ...FH, id: "2099-11-19-fh" })!;
  const t = TICKET.en;
  const base = { session_id: fh.id, session_date: fh.date, session_day: "Thursday", status: "waiting", queue_num: 4, price: 0, paid: false, type_preference: "None", approval: "pending", group_id: "g1" };
  const family = [ticketRow({ ...base, id: "q1abcdef", name: "Sara Haddad" })!, ticketRow({ ...base, id: "q2abcdef", queue_num: 5, name: "Lina Haddad" })!, ticketRow({ ...base, id: "q3abcdef", queue_num: 6, name: "Omar Haddad" })!];
  // the ticket alone, without the image preload React puts before it
  const card = (rows: TicketRow[], o: { ar?: boolean; s?: typeof fh } = {}) => {
    const s = o.s ?? fh;
    return renderToStaticMarkup(createElement(TicketCard, {
      locale: o.ar ? "ar" : "en", today: "2099-11-10", rows, session: s, name: o.ar ? "ليلة مزرعة نوار" : "Nawar Farm House Night", cue: ticketCue(rows, s, null), t: o.ar ? TICKET.ar : t,
      gather: "Gathering", start: "Start", typeName: (x: string) => x,
      links: { edit: "https://book.example.test/?ev=community&session=2099-11-19-fh", manage: "https://book.example.test/?tab=bookings", place: placeLink(s, "https://dir.example.test/jcc") },
      now: Date.parse("2099-11-10T09:00:00Z"), wallet: { bookingId: rows[0].id, groupIds: rows.map((r) => r.id) },
    })).replace(/^(<link [^>]*>)+/, "");
  };

  it("has no bike, gathers (arrival, then dinner), is free, waits on staff, and is at the farm with its own map", () => {
    expect(fh).toMatchObject({ kind: "farm", bikes: false, gathers: true, approval: true, published: false, free: true, times: ["16:30", "20:30"], location: "Little Farmhouse, Dhahban", meetUrl: MAP });
    expect(waiverKind(fh)).toBe("farm"); // its own waiver since 2026-11-13 (content/farm-words.ts farmWaiverCopy)
    expect(codeReady(family, fh)).toBe(false); // the code comes once staff publish the list and approve the family
    expect(codeReady(family.map((r) => ({ ...r, approval: "approved" })), { ...fh, published: true })).toBe(true);
    expect(venueText(venueOf(fh), t)).toBe("Little Farmhouse, Dhahban");
    expect(meetsAt(fh)).toBe(true); // a ride staff approve: its button says Meeting point and opens the farm's map
    expect(placeLink(fh, "https://dir.example.test/jcc")).toBe(MAP);
    expect(icsPlace(fh)).toBe(MAP);
    // the calendar holds arrival to two hours after dinner, 4:30 to 10:30 PM in Jeddah, and never a bike
    const ics = icsFor(fh, "Nawar Farm House Night", icsPlace(fh), new Date("2099-11-01T00:00:00Z"));
    expect(ics).toContain("DTSTART:20991119T133000Z");
    expect(ics).toContain("DTEND:20991119T193000Z");
    expect(ics).not.toMatch(/bike/i);
    // the countdown: to arrival, then to dinner
    expect(countdownMoments(fh, fh.date)).toEqual([[Date.parse("2099-11-19T16:30:00+03:00"), "gather"], [Date.parse("2099-11-19T20:30:00+03:00"), "start"]]);
  });
  it("draws Harvest Supper's ticket: the mark, its name, arrival and dinner at the farm, the family by name, Free, Edit to add family", () => {
    const html = card(family);
    expect(html).toMatch(/^<article class="tk-card ev-farm">/); // waiting on staff: the paper ticket, cream in every state
    expect(html).toContain(`<span class="tk-logo tk-logo-farm" aria-hidden="true"><img src="${FARM_MARK}" alt="" width="${FARM_MARK_SIZE.width}" height="${FARM_MARK_SIZE.height}" decoding="async"/></span>`);
    expect(html).toContain('<p class="tk-num small">Nawar Farm House Night</p>');
    expect(html).toContain("<bdi>Arrival 4:30 PM · Dinner 8:30 PM</bdi>");
    expect(html).toContain('<span class="tk-venue">Little Farmhouse, Dhahban</span>');
    expect(html).not.toContain("Gathering");
    for (const n of ["Sara Haddad", "Lina Haddad", "Omar Haddad"]) expect(html).toContain(`<span class="tk-name">${n}</span>`);
    expect(html).toContain("Participants");
    expect(html).toContain("Reserved - the participant list is being finalised");
    expect(html).toMatch(/class="tk-total"><span>Total<\/span><strong>Free<\/strong>/);
    expect(html).not.toContain("tk-rider-pay"); // a ride staff approve: no price for each place
    // the member adds or drops family members in the booking app (its Edit), as there; Reschedule and Cancel too
    expect(html).toContain('<a class="tk-btn solid" href="https://book.example.test/?ev=community&amp;session=2099-11-19-fh">Edit</a>');
    expect(html).toContain(" Reschedule</a>");
    expect(html).toContain(">Cancel</a>");
    expect(html).toContain(`href="${MAP}"`);
    expect(html.replace(/<[^>]*>/g, " ")).not.toMatch(BIKE_WORDS);
    expect(decodeURIComponent(/href="data:text\/calendar;charset=utf-8,([^"]*)"/.exec(html)?.[1] ?? "")).not.toMatch(BIKE_WORDS);
  });
  it("is live once staff publish the list and approve the family, and says it in Arabic in the booking app's words", () => {
    const ok = family.map((r) => ({ ...r, approval: "approved" }));
    const live = card(ok, { s: { ...fh, published: true } });
    expect(live).toMatch(/^<article class="tk-card ev-farm tk-live">/);
    expect(live).toContain("Your place is confirmed");
    const ar = card(family, { ar: true });
    expect(ar).toMatch(/<bdi>الوصول [^<]+ · العشاء [^<]+<\/bdi>/);
    expect(ar).not.toContain("التجمع في"); // never "Gathering at" under the place
    expect(TICKET.ar.fhArrive).toBe("الوصول");
    expect(TICKET.ar.fhDinner).toBe("العشاء");
  });
});

describe("the Farm House Night's look", () => {
  it("draws its card, Featured card, summary and ticket in the booking app's Harvest Supper tokens, its name in Rubik 800", () => {
    const booking = css("../../components/booking/booking.css"), xp = css("../../components/experiences/experiences.css");
    for (const tk of ["--fh-rust: #8A3F27", "--fh-rust-dk: #6E2C1C", "--fh-rust-lt: #9A5236", "--fh-ember: #C9502A", "--fh-maroon: #7E2034", "--fh-peach: #F3C7A9", "--fh-peach-lt: #F6D9C5", "--fh-cream: #FBF3EA", "--fh-milk: #FBEFE4", "--fh-ink: #3A1E14", "--fh-ink-2: #6E4A3A", "--fh-glow: 237, 176, 145"]) expect(booking, tk).toContain(tk);
    expect(booking).toMatch(/\.sc-card\.sc-farm \{[^}]*background: linear-gradient\(135deg, var\(--fh-rust-lt\) 0%, var\(--fh-rust\) 48%, var\(--fh-rust-dk\) 100%\);\s*border: 1px solid rgba\(110, 44, 28, \.55\); border-inline-start: 3px solid var\(--fh-peach\); \}/);
    expect(booking).toMatch(/\[dir="rtl"\] \.sc-card\.sc-farm \{ background: linear-gradient\(225deg/);
    expect(booking).toMatch(/\.sc-fh-title \{ font-family: var\(--cs-font-fh\)[^}]*font-weight: 800;[^}]*color: var\(--fh-peach\);/);
    expect(booking).toMatch(/\.sc-fh-meta \{[^}]*overflow: hidden;[^}]*color: var\(--fh-milk\);/);
    expect(booking).toMatch(/\.sc-fh-mi \{[^}]*margin-inline-start: -19px; \}/); // the rule a line starts with is cut
    expect(booking).toMatch(/\.sc-fh-line \{[^}]*color: var\(--fh-peach-lt\);/);
    expect(booking).toMatch(/\.sc-card\.sc-farm \.sc-spots, \.xs-feat-card\.xs-feat-fh \.sc-spots \{[^}]*background: var\(--fh-milk\); color: var\(--fh-rust-dk\); \}/);
    for (const sel of [".tk-card.ev-farm, .tk-card.ev-farm.tk-live", '[dir="rtl"] .tk-card.ev-farm', ".tk-logo.tk-logo-farm", ".sc-fh-scene", ":is(.sc-card, .sc-wrap, .xs-info, .xs-feat-card).ev-farm { --ev: #8a3f27; }"]) expect(booking, sel).toContain(sel);
    expect(booking).toMatch(/\.tk-card\.ev-farm \.tk-num \{ font-family: var\(--cs-font-fh\)[^}]*font-weight: 800; \}/);
    for (const sel of [".xs-feat-card.xs-feat-fh", '[dir="rtl"] .xs-feat-card.xs-feat-fh', ".xs-sum-head.xs-fh-head", ".xs .xs-go.ev-farm", ".xs-info.ev-farm .xs-info-go"]) expect(xp, sel).toContain(sel);
    // the face the names ask for is the one the layout loads: Rubik, its heaviest weight here, its Arabic letters too
    expect(css("../../app/[locale]/layout.tsx")).toMatch(/Rubik\(\{ subsets: \["latin", "arabic"\], weight: "800",[^}]*variable: "--cs-font-fh", preload: false \}\)/);
  });
  it("gives cream its contrast on rust and peach its own at the title's size, as the booking app's block says", () => {
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
    // the tile's lightest stop is the worst ground
    expect(ratio("#FBEFE4", "#9A5236")).toBeGreaterThanOrEqual(4.5); // cream meta on rust
    expect(ratio("#F6D9C5", "#8A3F27")).toBeGreaterThanOrEqual(4.5); // the foot line where it sits
    expect(ratio("#F3C7A9", "#8A3F27")).toBeGreaterThanOrEqual(4.5); // the peach name
    expect(ratio("#6E2C1C", "#FBEFE4")).toBeGreaterThanOrEqual(4.5); // a state on its cream pill
    expect(ratio("#8A3F27", "#FBF3EA")).toBeGreaterThanOrEqual(4.5); // the ticket's rust on cream
    expect(ratio("#FFFFFF", "#8A3F27")).toBeGreaterThanOrEqual(4.5); // the button and the Featured card's weekday band
  });
  it("has the venue's Instagram picture as its logo, the booking app's assets/farm-logo.jpg", () => {
    expect(FARM_MARK).toBe("/site/farm-logo.jpg");
    expect(FARM_MARK_SIZE).toEqual({ width: 150, height: 150 });
    const jpg = readFileSync(new URL("../../../public/site/farm-logo.jpg", import.meta.url));
    expect([...jpg.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]); // a JPEG
    expect(css("../../components/booking/booking.css")).toMatch(/\.sc-fh-mark \{[^}]*border-radius: 50%/);
  });
});

// "put it under micromobility experiences card not to public" (the user, 2026-11-13): unlike yoga and the Saturday ride,
// which every visitor sees listed, the Farm House Night is drawn for a signed-in community member alone. A visitor who is
// not signed in, or one signed in who is no member, gets pages with no word of it: no date, no Featured card, no mark on
// the Experiences card, no kind in its switch, no Details, no Events entry, nothing for the search engines; and its words
// are in no public place: not the Website editor's schema (api/site-schema), not the browser's dictionary.
describe("the Farm House Night is not to public", () => {
  const SECRET = /Nawar|Farm House|Farmhaus|ليلة مزرعة|ليلة المزرعة|2099-11-19-fh|Members and their families|Little Farmhouse/;
  const visitors = [["not signed in", () => { jar.account = ""; jar.member = false; }], ["signed in, no member", () => { jar.account = ACCOUNT; jar.member = false; }]] as const;
  for (const [who, as] of visitors) {
    for (const locale of ["en", "ar", "de", "fr"]) {
      it(`leaves no word of it on Experiences for a visitor ${who} (${locale})`, async () => {
        as();
        const p = await experiences([FH, SAT, JCC], locale);
        // what the server hands the browser (the steps' props, sent with the page) and what it draws
        expect(JSON.stringify(p)).not.toMatch(SECRET);
        expect(comm(p).sessions.map((x) => x.id)).toEqual(["2099-11-21"]);
        expect(p.featured).toEqual([]);
        expect(comm(p).marks?.kinds).toEqual(["saturday"]);
        expect(Object.keys(p.text.kinds.names)).not.toContain("farm");
        for (const html of [draw(p, 1), draw(p, 2, comm(p))]) {
          expect(html).not.toMatch(SECRET);
          expect(html).not.toMatch(/sc-farm|xs-feat-fh|ev-farm|farm-logo/);
        }
      });
      it(`leaves it off the Events page for a visitor ${who} (${locale})`, async () => {
        as();
        const html = await eventsPage([FH, JCC], locale);
        expect(html).not.toMatch(SECRET);
        expect(html).not.toContain("--kind:#8a3f27");
      });
    }
  }
  it("shows a member what nobody else sees", async () => {
    asMember();
    const p = await experiences([FH, SAT, JCC]);
    expect(JSON.stringify(p)).toMatch(/Nawar Farm House Night/);
    expect(p.featured).toEqual([{ ev: "community", id: FH.id }]);
    expect(await eventsPage([FH, JCC])).toContain("Nawar Farm House Night");
  });
  it("is left out of every list a visitor may read (farmForMembers), the Club's rides too", () => {
    const rows = [{ kind: "saturday" }, { kind: "farm" }, { kind: null }, { kind: "yoga" }];
    expect(farmForMembers(rows, false)).toEqual([{ kind: "saturday" }, { kind: null }, { kind: "yoga" }]);
    expect(farmForMembers(rows, true)).toEqual(rows);
    // the Club's rides (ClubRides, every visitor's list from club_rides) hold none
    const club = readFileSync(new URL("../../components/club/ClubRides.tsx", import.meta.url), "utf8");
    expect(club).toMatch(/farmForMembers\(r\.filter\(\(x\) => x\.kind !== "blood"\), false\)/);
    expect(club).not.toMatch(/Farm House/);
  });
  it("keeps its words out of the public Website editor's schema and every language's browser dictionary", () => {
    expect(JSON.stringify(PAGES)).not.toMatch(SECRET);
    expect(JSON.stringify(PAGES)).not.toMatch(/farmName|aboutFarm/);
    for (const code of TRANSLATED) {
      const d = clientDict(code) ?? {};
      expect(Object.keys(d).filter((k) => /Farm House|Members and their families|Community members and their families|An evening at the farm/.test(k)), code).toEqual([]);
    }
  });
});
