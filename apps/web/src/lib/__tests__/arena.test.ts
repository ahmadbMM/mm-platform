import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type FC, type ReactElement, type ReactNode } from "react";
// The site has no @types/react-dom; this test needs one function of it (as rating.test.ts does).
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { experiencesSchema } from "@/content/pages/experiences";
import { T as TICKET } from "@/components/booking/tickets.text";
import TicketCard from "@/components/booking/TicketCard";
import ShareGate, { type PendingShare } from "@/components/account/ShareGate";
import { TxProvider } from "@/i18n/TxProvider";
import { serverLocalize } from "@/i18n/dicts";
import de from "@/i18n/tx/de.json";
import { AH_INFO_URL, AH_VENUE, ahConfig, ahDivName, ahEntry, ahPayLine, isArenaId } from "../arena";
import { kindNames, resetSessionColumns, rideKind, sessionName, toSession, type RideKind } from "../rides";
import { bookingAt, dateText, EVENT_CARDS, EVENT_OF, eventCards, infoArena, infoPlace, infoPlaces, infoPrice, infoShown, infoTimes, infoWho, memberOn, membersOnlyDate, membersOnlyEvent, rentsBikes, type DateTexts } from "../event-info";
import { codeReady, countdownMoments, fmtClock, icsFor, icsPlace, meetsAt, placeLink, ticketGroups, ticketRoute, ticketRow, ticketSession, ticketStages, venueOf, venueText, type TicketRow } from "../tickets";
import { isNonBike } from "../bike-kinds";
import { formOf, questionKeys, ratingNoBike, rideWord } from "../rating";
import { pendingShares, sharesDetails } from "../share";
import { badgeList, recordRows, rideStats, type BadgeData, type RecordSession } from "../ride-record";
import { resetSiteContent } from "../site";
import { GET, POST } from "../../app/api/account/pending-share/route";

const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;
const Tx = TxProvider as FC<{ locale: string; dict: Record<string, string> | null; children?: ReactNode }>;

// The Arena Heros Hybrid Race (the owner, 2026-10-28: "create a session for this event and make it exclusive for
// community members"; rentals migration 20261028200000_arena_race): a hybrid fitness race at Gymnation, Tahlia
// Street, Friday 6 November, 06:00-20:00 with a prayer break, teams of 2 women or 2 men each booking their own
// place with a team code, Open or Elite, 7 stations, 140 SAR per athlete with medals, how to pay announced later,
// the athletes' details shared with WeSportify, Mile and Gymnation. As the booking app makes the session:
const AR = {
  id: "2099-11-06-ah", session_date: "2099-11-06", status: "open", event_kind: "community", ride_kind: "arena", title: "Arena Heros Hybrid Race",
  open_to_all: false, paid_ride: true, needs_approval: false, hide_queue: true, price: 140, capacity: 100, bike_slots: '{"_time":"06:00 - 20:00"}',
  location: "Gymnation, Tahlia Street", meet_url: "https://www.google.com/maps/search/?api=1&query=Gymnation%20Tahlia%20Street%20Jeddah",
  description: null, vl: { races: ["wd", "md"], divs: ["op", "el"], pair: true },
};
const clock = (t: string) => fmtClock(t, "en");
const words = { meetingPoint: "Meeting point", venueCircuit: "Jeddah Corniche Circuit", venueJyc: "Jeddah Yacht Club", venueGymnation: "Gymnation, Tahlia Street" };

describe("the kind (lib/rides.ts)", () => {
  it("is a kind of its own, never read as the Saturday ride, and a circuit night only off the community events", () => {
    expect(rideKind({ event_kind: "community", ride_kind: "arena" })).toBe("arena");
    expect(rideKind({ event_kind: "community", ride_kind: "arena" })).not.toBe("saturday");
    expect(rideKind({ event_kind: null, ride_kind: "arena" })).toBe("jcc");
    // a kind the site does not know still reads as the Saturday ride, as the booking app's _rideKind does
    expect(rideKind({ event_kind: "community", ride_kind: "something-new" })).toBe("saturday");
  });
  it("reads the session: members only, paid at its own price per athlete, a window (no gathering), no bikes", () => {
    expect(toSession(AR)).toMatchObject({
      id: "2099-11-06-ah", kind: "arena", members: true, free: false, times: ["06:00", "20:00"], gather: false, price: 140, seats: null,
      collect: null, approval: false, capacity: 100, noCarbon: true, location: "Gymnation, Tahlia Street", meetUrl: AR.meet_url,
    });
    // its settings ride along, as Victory Lap's do (SESSION_COLS_VL)
    expect(toSession(AR)!.vl).toEqual({ races: ["wd", "md"], divs: ["op", "el"], pair: true });
    expect(toSession({ ...AR, paid_ride: false })).toMatchObject({ free: true, price: null });
  });
  it("is named by its own name (Experiences > Dates: arName), in Arabic too", () => {
    const f = experiencesSchema.sections.find((x) => x.id === "dates")?.fields.find((x) => x.id === "arName") as { def: { en: string; ar: string } } | undefined;
    expect(f?.def).toEqual({ en: "Arena Heros Hybrid Race", ar: "سباق أرينا هيروز الهجين" });
    const en = kindNames({ arName: f!.def.en }), ar = kindNames({ arName: f!.def.ar });
    expect(en.arena).toBe("Arena Heros Hybrid Race");
    expect(sessionName({ kind: "arena", title: null }, en, en, false)).toBe("Arena Heros Hybrid Race");
    expect(sessionName({ kind: "arena", title: "Arena Heros Hybrid Race" }, ar, en, true)).toBe("سباق أرينا هيروز الهجين");
  });
});

describe("an athlete's place and the race's settings (lib/arena.ts)", () => {
  it("reads the race, the division and the team's code, a partner wanted only without a code", () => {
    expect(ahEntry({ race: "wd", div: "op", team: "ah-4k7q", pair: true, first: "Sara", last: "Ali", email: "s@x.sa", phone: "+966500000000" })).toEqual({ race: "wd", div: "op", team: "AH-4K7Q", pair: false });
    expect(ahEntry('{"race":"md","div":"el","pair":true}')).toEqual({ race: "md", div: "el", team: null, pair: true });
    // Victory Lap's codes and races are not this race's
    expect(ahEntry({ race: "xd", div: "so", team: "VL-ABCD" })).toEqual({ race: null, div: null, team: null, pair: false });
    expect(ahEntry(null)).toBeNull();
    expect(ahEntry("not json")).toBeNull();
  });
  it("opens both races and both divisions when unset, and says how to pay in staff's words or the page's", () => {
    expect(ahConfig(null)).toEqual({ races: ["wd", "md"], divs: ["op", "el"], pair: true, pay: {}, share: {} });
    expect(ahConfig({ races: ["md", "xd"], divs: ["el"], pair: false })).toMatchObject({ races: ["md"], divs: ["el"], pair: false });
    expect(ahPayLine(ahConfig(null), "en", "How to pay will be announced.")).toBe("How to pay will be announced.");
    expect(ahPayLine(ahConfig({ pay: { en: "Pay by link", ar: "ادفع بالرابط" } }), "ar", "x")).toBe("ادفع بالرابط");
    expect(ahPayLine(ahConfig({ pay: { en: "Pay by link" } }), "fr", "x")).toBe("Pay by link");
  });
  it("keeps the organiser's division names in English but in Arabic, and knows its sessions by their id", () => {
    expect([ahDivName("op", "en"), ahDivName("el", "de"), ahDivName("el", "ar")]).toEqual(["Open", "Elite", "النخبة"]);
    expect(isArenaId("2026-11-06-ah")).toBe(true);
    expect(isArenaId("2026-11-06-ah-2")).toBe(true);
    for (const id of ["2026-11-06", "2026-10-26-vl", "2026-11-06-ahx", "", null]) expect(isArenaId(id), String(id)).toBe(false);
  });
});

describe("on Experiences (lib/event-info.ts)", () => {
  const nobody = { member: false, petromin: false }, member = { member: true, petromin: false };
  it("is for community members: its card is everyone's, its About and its dates' Details members' alone", () => {
    expect(membersOnlyEvent("arena")).toBe(true);
    expect(infoShown(membersOnlyEvent("arena"), memberOn("arena", nobody))).toBe(false);
    expect(infoShown(membersOnlyEvent("arena"), memberOn("arena", member))).toBe(true);
    expect(infoShown(membersOnlyDate({ members: true, kind: "arena" }), memberOn("arena", nobody))).toBe(false);
    // the members' own check, not Victory Lap's tag holders: a Petromin tag holder is not let in
    expect(infoShown(membersOnlyEvent("arena"), memberOn("arena", { member: false, petromin: true }))).toBe(false);
  });
  it("has a card of its own while it has a date, after Victory Lap and before Run for Her, booked on its own event", () => {
    const all = [{ id: "rh", kind: "runher" as const }, { id: "2099-11-06-ah", kind: "arena" as const }, { id: "vl", kind: "vlap" as const }, { id: "s", kind: "saturday" as const }];
    expect(eventCards(all, nobody).map((c) => c.card.key)).toEqual(["vlap", "arena", "runher", "jcc", "community"]);
    expect(eventCards(all, nobody).find((c) => c.card.key === "arena")?.sessions.map((x) => x.id)).toEqual(["2099-11-06-ah"]);
    // never among the community rides
    expect(eventCards(all, member).find((c) => c.card.key === "community")?.sessions.map((x) => x.id)).toEqual(["s"]);
    expect(eventCards([{ id: "j", kind: "jcc" as const }], member).map((c) => c.card.key)).not.toContain("arena");
    expect(EVENT_CARDS.find((c) => c.key === "arena")).toEqual({ key: "arena", p: "ar", always: false });
    expect(EVENT_OF.arena).toBe("arena");
    expect(bookingAt("https://book.example/", EVENT_OF.arena, "2099-11-06-ah")).toBe("https://book.example/?ev=arena&session=2099-11-06-ah");
  });
  it("says its window with the prayer break and who sets the heat times, who may book it, and never a bike price", () => {
    const s = toSession(AR)!;
    const texts = { aboutAr: "Heats {start} to {end}." } as DateTexts;
    expect(infoTimes(s, clock)).toEqual({ gather: "", start: "6 AM", end: "8 PM", collect: "" });
    expect(dateText(s, texts, infoTimes(s, clock))).toBe("Heats 6 AM to 8 PM.");
    const who = { all: "Everyone", members: "Community members", members18: "x", petromin: "y", vlap: "z", arena: "Community members, in teams of two" };
    expect(infoWho(s, who)).toBe("Community members, in teams of two");
    expect(infoWho(s, { ...who, arena: undefined })).toBe("Community members");
    expect(rentsBikes("arena")).toBe(false);
    const t = { free: "Complimentary", seat: null, from: "from SAR 57.5" };
    expect(infoPrice(s, t)).toBeNull(); // not a member: nothing is said
    expect(infoPrice(s, { ...t, athlete: "SAR 140 · per athlete, medals included" })).toBe("SAR 140 · per athlete, medals included");
  });
  it("lists its two races, its two divisions with what each asks, and never how many places are left", () => {
    const t = { races: { wd: "Women’s Doubles", md: "Men’s Doubles" }, divs: { op: "Open", el: "Elite" }, guide: { op: { level: "Intermediate", text: "Reduced loads." }, el: { level: "Advanced", text: "Full loads." } } };
    expect(infoArena(toSession(AR)!, t)).toEqual({ races: "Women’s Doubles · Men’s Doubles", divs: "Open · Elite", guide: [{ name: "Open", level: "Intermediate", text: "Reduced loads." }, { name: "Elite", level: "Advanced", text: "Full loads." }] });
    expect(infoArena({ kind: "arena", vl: { races: ["md"], divs: ["el"] } }, t)).toEqual({ races: "Men’s Doubles", divs: "Elite", guide: [{ name: "Elite", level: "Advanced", text: "Full loads." }] });
    expect(infoArena({ kind: "vlap", vl: null }, t)).toBeNull();
    const w = { waitlist: "Waitlist", left1: "{0} spot left", leftN: "{0} spots left" };
    expect(infoPlaces({ approval: false, full: false, left: 2, kind: "arena" }, w)).toBeNull();
    expect(infoPlaces({ approval: false, full: false, left: 0, kind: "arena" }, w)).toBe("Waitlist");
    expect(infoPlaces({ approval: false, full: true, left: null, kind: "arena" }, w)).toBe("Waitlist");
  });
  it("is at Gymnation, Tahlia Street, named in the page's words, its map the one staff set, never the circuit", () => {
    expect(infoPlace(toSession(AR)!, words, "https://dir")).toEqual({ name: "Gymnation, Tahlia Street", map: AR.meet_url });
    expect(infoPlace(toSession(AR)!, { ...words, venueGymnation: "Gymnation، شارع التحلية" }, "https://dir").name).toBe("Gymnation، شارع التحلية");
    // a session read without its place, or one staff named no place for, is still at its venue
    expect(infoPlace({ kind: "arena", approval: false, location: null, meetUrl: null }, words, "https://dir")).toEqual({ name: "Gymnation, Tahlia Street", map: null });
    expect(venueText(venueOf({ kind: "arena", approval: false, meetUrl: null, location: null }), { meetingPoint: "M", venueCircuit: "C", venueJyc: "J" })).toBe(AH_VENUE);
  });
  it("has its texts in Experiences' fields, the keys the booking app reads (events.arAbout, dates.aboutAr) in its own words, and never a price on its card", () => {
    const f = (sec: string, id: string) => experiencesSchema.sections.find((x) => x.id === sec)?.fields.find((x) => x.id === id) as { def: { en: string; ar: string } | string; max?: number } | undefined;
    for (const [sec, id] of [["events", "arTitle"], ["events", "arMeta"], ["events", "arNote"], ["events", "arAbout"], ["dates", "arName"], ["dates", "aboutAr"]]) {
      const x = f(sec, id);
      expect(x, id).toBeDefined();
      const d = x!.def as { en: string; ar: string };
      expect(d.en.length, id).toBeLessThanOrEqual(x!.max!);
      expect(d.ar.length, id).toBeLessThanOrEqual(x!.max!);
    }
    expect((f("events", "arTitle")!.def as { en: string }).en).toBe("Arena Heros");
    // the booking app's infoEvArena, arCardSub, arTeamsNote and infoDtAr, word for word
    expect(f("events", "arAbout")!.def).toEqual({
      en: "The Arena Heros Hybrid Race by WeSportify, Mile and Gymnation: a hybrid fitness race over 7 stations for teams of two, two men or two women, in the Open or Elite division. For Community members, medals included.",
      ar: "سباق أرينا هيروز الهجين من WeSportify وMile وGymnation: سباق لياقة هجين من 7 محطات لفرق من شخصين، رجلين أو امرأتين، في فئة مفتوح أو النخبة. لأعضاء المجتمع، والميداليات مشمولة.",
    });
    expect((f("events", "arMeta")!.def as { en: string }).en).toBe("Teams of 2 · Open or Elite · 7 stations");
    expect((f("events", "arNote")!.def as { en: string }).en).toBe("Teams of two only: two men or two women. Each partner books their own place from their own account.");
    const about = f("dates", "aboutAr")!.def as { en: string; ar: string };
    expect(about.en).toBe("The race runs from {start} to {end}, with a break for prayer. The organisers give each team its heat time before race day.");
    expect((about.ar.match(/\{[a-z]+\}/g) ?? []).sort()).toEqual(["{end}", "{start}"]);
    for (const id of ["arTitle", "arMeta", "arNote", "arAbout"]) expect((f("events", id)!.def as { en: string }).en, id).not.toMatch(/SAR|140|﷼/);
    // no logo file exists: the card draws the organisers' wordmark unless staff add one
    expect(f("events", "arLogo")?.def).toBe("");
    expect(AH_INFO_URL).toBe("https://www.instagram.com/p/Dd1Lc87CJrq/");
  });
});

describe("its ticket on My Account", () => {
  const s = ticketSession(AR)!;
  const t = TICKET.en;
  const entry = (o: Record<string, unknown> = {}) => ticketRow({ id: "ah1abcdef", session_id: AR.id, session_date: AR.session_date, session_day: "Friday", status: "waiting", queue_num: 12, price: 140, paid: false, name: "Sara Ali", type_preference: "None", vl: { race: "wd", div: "op", team: "AH-4K7Q", first: "Sara", last: "Ali" }, ...o })!;
  const card = (rows: TicketRow[], o: { partners?: Map<string, string> | null; past?: boolean; locale?: string; today?: string } = {}) => renderToStaticMarkup(createElement(TicketCard, {
    locale: o.locale ?? "en", today: o.today ?? "2099-11-01", rows, session: s, name: "Arena Heros Hybrid Race", cue: null, t: o.locale ? serverLocalize(TICKET, o.locale) : t, gather: "Gathering", start: "Start", typeName: (x: string) => x,
    links: { edit: "https://book.example.test/?ev=arena", manage: "https://book.example.test/?tab=bookings", place: placeLink(s, "https://maps.app.goo.gl/jcc") },
    now: Date.parse("2099-11-01T09:00:00Z"), wallet: { bookingId: "ah1abcdef", groupIds: ["ah1abcdef"] }, vlPartners: o.partners ?? null, past: o.past ?? false,
  }));

  it("has no bikes, a window, its own place and map, its settings, and no route", () => {
    expect(s).toMatchObject({ kind: "arena", bikes: false, gathers: false, approval: false, free: false, freeRide: false, times: ["06:00", "20:00"], price: 140 });
    expect(s.ah).toEqual({ races: ["wd", "md"], divs: ["op", "el"], pair: true, pay: {}, share: {} });
    expect(s.vl).toBeNull();
    expect(venueText(venueOf(s), t)).toBe("Gymnation, Tahlia Street");
    expect(venueText(venueOf(s), TICKET.ar)).toBe("Gymnation، شارع التحلية");
    expect(meetsAt(s)).toBe(false);
    expect(placeLink(s, "https://maps.app.goo.gl/jcc")).toBe(AR.meet_url);
    expect(placeLink(ticketSession({ ...AR, meet_url: null })!, "https://maps.app.goo.gl/jcc")).toBeNull(); // never the circuit
    expect(placeLink(undefined, "https://maps.app.goo.gl/jcc")).toBe("https://maps.app.goo.gl/jcc");
    expect(icsPlace(s)).toBe("Gymnation, Tahlia Street");
    expect(icsFor(s, "Arena Heros Hybrid Race - Friday", icsPlace(s))).not.toMatch(/bike|ride/i);
    expect(ticketRoute(s, new Map())).toBeNull();
    expect(countdownMoments(s, s.date).map((x) => x[1])).toEqual(["start"]);
    expect(ticketStages([entry({ status: "active" })], s.bikes, null, "en").stages.map((x) => x.key)).toEqual(["booked", "in", "done"]);
    expect(codeReady([entry()], s)).toBe(true);
  });
  it("reads an athlete's place off the row by its session's id, never as Victory Lap's, one ticket a session", () => {
    expect(entry().ah).toEqual({ race: "wd", div: "op", team: "AH-4K7Q", pair: false });
    expect(entry().vl).toBeNull();
    expect(entry({ vl: null }).ah).toBeNull();
    // a Victory Lap row keeps its own reading
    expect(ticketRow({ id: "v", session_id: "2099-10-26-vl", session_date: "2099-10-26", status: "waiting", vl: { race: "wd", div: "op", shirt: "M", team: "VL-AB12" } })).toMatchObject({ vl: { team: "VL-AB12" } });
    expect("ah" in ticketRow({ id: "v", session_id: "2099-10-26-vl", session_date: "2099-10-26", status: "waiting" })!).toBe(false);
    const g = ticketGroups([{ id: "a", session_id: AR.id, session_date: AR.session_date, status: "waiting", vl: { race: "md", div: "el" } }], "2099-11-01");
    expect(g.map((x) => x.key)).toEqual([AR.id]);
  });
  it("draws the card: Athlete number, its wordmark, the race and division, the team's code, the heat times, how to pay", () => {
    const html = card([entry()]);
    expect(html).toContain("Athlete number");
    expect(html).not.toContain("Queue number");
    expect(html).toContain("ev-arena");
    expect(html).toMatch(/class="tk-logo tk-logo-ah" aria-hidden="true"><b>Arena Heros<\/b><i>Competition<\/i>/);
    expect(html).toMatch(/class="tk-type tk-ah">Women’s Doubles · Open</);
    expect(html).toContain("Team code");
    expect(html).toContain(">AH-4K7Q<");
    expect(html).toContain("Your partner books their own place with this code.");
    expect(html).toContain("The organisers give your team its heat time before race day.");
    expect(html).toContain("How to pay will be announced.");
    expect(html).toContain("Gymnation, Tahlia Street");
    expect(html).toContain(`href="${AR.meet_url.replace(/&/g, "&amp;")}"`);
    expect(html).toContain("Get directions");
    expect(html).not.toContain("Meeting point");
    // never the booth, a bike, a helmet, a wallet pass, Victory Lap's ticket question, Edit or Reschedule
    for (const no of ["Pay at the booth", "You pay at the booth", "Helmets", "tk-wallet", "Do you already have a ticket", ">Edit<", "Reschedule", "T-shirt", "5 km time", "victory-lap"]) expect(html, no).not.toContain(no);
    // its details change in the booking app's My Bookings, as Victory Lap's do
    expect(html).toContain(">Change details<");
    expect(html).toContain(">Cancel<");
    // what the card says (not its class names): never a ride or a bike
    expect(html.replace(/<[^>]*>/g, " ").replace(/data:text\/calendar[^"]*/g, "")).not.toMatch(/\b(ride|rides|rider|riders|riding|bike|bikes)\b/i);
    // the partner by first name, when the database names them (customer_vl_teams)
    expect(card([entry()], { partners: new Map([["ah1abcdef", "Huda"]]) })).toContain("With Huda");
    // asked our team for a partner, no code yet
    expect(card([entry({ vl: { race: "md", div: "el", pair: true } })])).toContain("Looking for a partner: our team will pair you and let you know.");
    // paid: no payment line; staff's own words when they set them
    expect(card([entry({ paid: true })])).not.toContain("How to pay will be announced.");
    const own = ticketSession({ ...AR, vl: { ...AR.vl, pay: { en: "Pay at Gymnation's desk on race day" } } })!;
    expect(renderToStaticMarkup(createElement(TicketCard, { locale: "en", today: "2099-11-01", rows: [entry()], session: own, name: "x", cue: null, t, gather: "", start: "", typeName: (x: string) => x, links: { edit: null, manage: "m", place: null }, now: 0 })))
      .toContain("Pay at Gymnation&#x27;s desk on race day");
  });
  it("speaks Arabic and the translated languages: the venue, the race and the division in the page's words", () => {
    const ar = card([entry()], { locale: "ar" });
    for (const w of ["رقم الرياضي", "زوجي السيدات · مفتوح", "رمز الفريق", "يحجز شريكك مكانه بنفسه بهذا الرمز.", "سيُعلن عن طريقة الدفع لاحقًا.", "Gymnation، شارع التحلية"]) expect(ar, w).toContain(w);
    const html = card([entry()], { locale: "de" });
    const d = de as Record<string, string>;
    for (const w of ["Your partner books their own place with this code.", "How to pay will be announced.", "The organisers give your team its heat time before race day.", "Gymnation, Tahlia Street"]) expect(html, w).toContain(d[w].replace(/&/g, "&amp;"));
    expect(html).toContain("Damen-Doppel · Open"); // the organiser's division name stays in English
  });
});

describe("no bikes anywhere", () => {
  it("is a kind without a bike, by its kind or by its id, and its rating says session", () => {
    expect(isNonBike("arena")).toBe(true);
    expect(isNonBike(null, "2026-11-06-ah")).toBe(true);
    expect(isNonBike(null, "2026-11-06-ahx")).toBe(false);
    expect(rideWord("arena")).toBe("session");
    expect(rideWord(undefined, "2026-11-06-ah")).toBe("session");
    expect(ratingNoBike(false, null, "2026-11-06-ah")).toBe(true);
    expect(questionKeys(formOf("arena"), { noBike: ratingNoBike(false, { kind: "arena", bikes: false }, "x") })).toEqual(["service", "experience"]);
  });
  it("is never a ride on Your rides and earns no badge of its own", () => {
    const empty: BadgeData = { catalog: [], weeks: null, seasons: [], mine: [] };
    const rows = recordRows([{ id: "a", session_id: AR.id, session_date: AR.session_date, status: "done", paid: true, queue_num: 1, type_preference: "None", vl: { race: "wd", div: "op" } }]);
    const ses = new Map<string, RecordSession>([[AR.id, { kind: "arena" as RideKind, freeRide: false, approval: false }]]);
    expect(rideStats(rows, ses, "2099-11-07")).toBeNull();
    const on = badgeList(rows, ses, empty, "2099-11-07", null).flatMap((x) => x.lv ?? [x]).filter((x) => x.on).map((x) => x.slug);
    expect(on).toEqual([]);
  });
});

// The athletes agree that their details go to the organisers, WeSportify, Mile and Gymnation, as Victory Lap's do
// for Kamin Sports (customer_accept_share takes the arena kind; data_share_at).
describe("sharing the athletes' details with the organisers", () => {
  const TOKEN = "a1b2c3d4e5f6a7b8c9d0";
  const HEADERS = { origin: "https://micromobility.sa", cookie: `mm_acct=c1~${TOKEN}`, "content-type": "application/json" };
  const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
  const arow = (o: Record<string, unknown> = {}) => ({ id: "q9", session_id: AR.id, session_date: AR.session_date, status: "waiting", customer_id: "c1", queue_num: 1, name: "Sara Ali", data_share_at: null, vl: { race: "wd", div: "op", team: "AH-4K7Q" }, ...o });
  const db = (rows: unknown[], sessions: unknown[], accept: Response = json(1)) => vi.fn(async (url: string) =>
    url.includes("/rpc/my_bookings") ? json(rows) : url.includes("/rpc/list_sessions?") ? json(sessions) : url.includes("/rpc/customer_accept_share") ? accept : json([]));
  const get = (q: string) => GET(new Request(`https://micromobility.sa/api/account/pending-share?${q}`, { headers: HEADERS }));
  const post = (body: unknown) => POST(new Request("https://micromobility.sa/api/account/pending-share", { method: "POST", headers: HEADERS, body: JSON.stringify(body) }));
  beforeEach(() => { resetSiteContent(); resetSessionColumns(); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("asks an athlete who has not agreed, from today on", () => {
    const S = new Map([[AR.id, ticketSession(AR)!]]);
    expect(sharesDetails(S.get(AR.id))).toBe(true);
    expect(pendingShares([arow()], S, "2099-11-01", "c1")).toEqual([{ sessionId: AR.id, date: "2099-11-06", km: null }]);
    expect(pendingShares([arow({ data_share_at: "2099-11-01T09:00:00Z" })], S, "2099-11-01", "c1")).toEqual([]);
  });
  it("names the race at Gymnation and says it is Arena Heros', with staff's own list once they set one", async () => {
    vi.stubGlobal("fetch", db([arow()], [AR]));
    expect(await (await get("locale=en")).json()).toEqual({ signedIn: true, pending: {
      sessionId: AR.id, name: "Arena Heros Hybrid Race", when: "Friday · 6 Nov 2099", time: "6 AM – 8 PM", venue: "Gymnation, Tahlia Street", distance: null, kind: "arena", items: null,
    } });
    expect((await (await get("locale=ar")).json()).pending).toMatchObject({ kind: "arena", name: "سباق أرينا هيروز الهجين", venue: "Gymnation، شارع التحلية" });
    resetSessionColumns();
    vi.stubGlobal("fetch", db([arow()], [{ ...AR, vl: { ...AR.vl, share: { en: "First name\nLast name" } } }]));
    expect((await (await get("locale=en")).json()).pending).toMatchObject({ kind: "arena", items: ["First name", "Last name"] });
  });
  it("records the agreement through customer_accept_share", async () => {
    const f = db([], [AR]);
    vi.stubGlobal("fetch", f);
    expect(await (await post({ sessionId: AR.id })).json()).toEqual({ ok: true });
    const call = f.mock.calls.find((c) => String(c[0]).includes("/rpc/customer_accept_share")) as unknown as [string, RequestInit];
    expect(JSON.parse(String(call[1].body))).toEqual({ p_id: "c1", p_token: TOKEN, p_session_id: AR.id });
  });

  const w: PendingShare = { sessionId: AR.id, name: "Arena Heros Hybrid Race", when: "Friday · 6 Nov 2099", time: "6 AM – 8 PM", venue: "Gymnation, Tahlia Street", distance: null, kind: "arena", items: null };
  const draw = (locale = "en", dict: Record<string, string> | null = null, p: PendingShare = w) =>
    renderToStaticMarkup(createElement(Tx, { locale, dict }, createElement(ShareGate, { ...p, onDone: () => {} })));
  const EN = [
    "Before the race", "Sharing your details for the race",
    "To take part in the Arena Heros Hybrid Race, we will share these details about you with its organisers, WeSportify, Mile and Gymnation:",
    "First name", "Last name", "Email address", "Mobile number", "Gender", "Division", "Your team and its code",
    "Nothing else about you is shared, and only for this race.",
    "I agree to MicroMobility sharing these details with WeSportify, Mile and Gymnation so I can take part in the Arena Heros Hybrid Race.",
    "Agree and continue", "Sign out",
  ];
  it("names the three organisers and lists what goes to them, in order, never Kamin Sports or Sela", () => {
    const html = draw();
    const at = EN.map((s) => html.indexOf(s));
    for (const [i, s] of EN.entries()) expect(at[i], s).toBeGreaterThan(-1);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(html.match(/<li>/g)).toHaveLength(7);
    for (const no of ["Kamin", "Sela", "Victory Lap", "Distance chosen", "T-shirt", "will confirm exactly"]) expect(html, no).not.toContain(no);
    expect(draw("en", null, { ...w, items: ["First name", "Team"] }).match(/<li>/g)).toHaveLength(2);
  });
  it("speaks the page's language in the booking app's words, the organisers in Latin letters in Arabic too", () => {
    const ar = draw("ar", null, { ...w, name: "سباق أرينا هيروز الهجين", when: "الجمعة · 6 نوفمبر 2099", venue: "Gymnation، شارع التحلية" });
    for (const s of ["للمشاركة في سباق أرينا هيروز الهجين، سنشارك بياناتك التالية مع منظميه، WeSportify وMile وGymnation:", "الاسم الأول", "اسم العائلة", "الفئة", "فريقك ورمزه", "أوافق على أن تشارك مايكروموبيليتي هذه البيانات مع WeSportify وMile وGymnation لأتمكن من المشاركة في سباق أرينا هيروز الهجين."]) expect(ar).toContain(s);
    expect(ar).not.toMatch(/Arena|Kamin/);
    const d = de as Record<string, string>;
    const html = draw("de", d);
    for (const s of EN) {
      expect(d[s], s).toBeTruthy();
      expect(html).toContain(d[s].replace(/&/g, "&amp;"));
    }
  });
});
