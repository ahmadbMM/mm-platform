import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { experiencesSchema } from "@/content/pages/experiences";
import { makeL } from "@/i18n/tx";
import { bookingAt, dateText, EVENT_CARDS, EVENT_OF, eventCards, FEATURED_MAX, featuredDates, featuredFirst, fillTimes, infoBreakfast, infoDistance, infoPlace, infoPlaces, infoPrice, infoShown, infoTimes, infoVl, infoWho, memberOn, membersOnlyDate, membersOnlyEvent, rentsBikes, type DateTexts } from "../event-info";
import { FEATURE_OK, type RideKind } from "../rides";
import { fmtClock } from "../tickets";
import { yogaKnow, yogaLength, yogaMinutes } from "../yoga";

// "About this event" and "Details" on Experiences (2026-10-05) say what the booking app's picker
// says: the same texts, filled from the same date, and shown to the same visitors.

const clock = (t: string) => fmtClock(t, "en");
const TEXTS: DateTexts = {
  aboutJcc: "Circuit: bikes from {collect}, {start} to {end}.", aboutSat: "Gather {gather}, start {start}.", aboutPetro: "Petromin: bikes from {collect}.", aboutSwim: "Pool {start} to {end}.",
  aboutWs: "T100 {start} to {end}.", aboutRun: "Meet {gather}, run {start}.", aboutVl: "Doors {gather}, first heat {start}.", aboutDefe: "Defe run at {start}{end}.", aboutAr: "Heats {start} to {end}.", aboutYoga: "Yoga {start} to {end}.", sndAbout: "National Day ride.", evAbout: "Events: seats, not bikes.",
};
const circuit = { kind: "jcc" as const, times: ["21:00", "23:00"] as [string, string], gather: false, collect: "20:15", description: null };
const saturday = { kind: "saturday" as const, times: ["05:45", "06:15"] as [string, string], gather: true, collect: null, description: "Breakfast at the marina." };

describe("who sees the links", () => {
  it("shows a card anyone may book to everyone, and the community rides and Run for Her to members alone", () => {
    for (const key of ["jcc", "snd96", "workshop", "event"]) expect(membersOnlyEvent(key), key).toBe(false);
    for (const key of ["community", "runher", "petromin"]) expect(membersOnlyEvent(key), key).toBe(true);
    expect(infoShown(false, false)).toBe(true);
    expect(infoShown(false, true)).toBe(true);
    expect(infoShown(true, false)).toBe(false);
    expect(infoShown(true, true)).toBe(true);
  });
  it("shows Petromin Days' links to a Petromin tag holder, and every other card's to a community member (2026-10-12)", () => {
    const holder = { member: false, petromin: true }, member = { member: true, petromin: false };
    expect(infoShown(membersOnlyEvent("petromin"), memberOn("petromin", holder))).toBe(true);
    expect(infoShown(membersOnlyEvent("petromin"), memberOn("petromin", member))).toBe(false);
    expect(infoShown(membersOnlyEvent("community"), memberOn("community", holder))).toBe(false);
    expect(infoShown(membersOnlyEvent("community"), memberOn("community", member))).toBe(true);
    expect(infoShown(membersOnlyEvent("runher"), memberOn("runher", holder))).toBe(false);
    expect(infoShown(membersOnlyEvent("jcc"), memberOn("jcc", { member: false, petromin: false }))).toBe(true);
  });
});

describe("the event cards (Petromin Days, the owner, 2026-10-12)", () => {
  const night = (id: string, kind: RideKind) => ({ id, kind });
  const all = [night("pm1", "petromin"), night("jcc1", "jcc"), night("sat1", "saturday"), night("pm2", "petromin"), night("rh1", "runher")];
  const keys = (v: { member: boolean; petromin: boolean }) => eventCards(all, v).map((c) => c.card.key);
  const of = (v: { member: boolean; petromin: boolean }, key: string) => eventCards(all, v).find((c) => c.card.key === key)?.sessions.map((s) => s.id);
  it("has no Petromin Days, and no Petromin night anywhere, for a visitor without either tag", () => {
    const v = { member: false, petromin: false };
    expect(keys(v)).toEqual(["runher", "jcc", "community"]);
    expect(of(v, "community")).toEqual(["sat1"]);
  });
  it("puts Petromin Days first for a Petromin tag holder, with the Petromin nights alone", () => {
    const v = { member: false, petromin: true };
    expect(keys(v)).toEqual(["petromin", "runher", "jcc", "community"]);
    expect(of(v, "petromin")).toEqual(["pm1", "pm2"]);
    expect(of(v, "community")).toEqual(["sat1"]); // never twice
    expect(EVENT_CARDS[0]).toEqual({ key: "petromin", p: "pm", always: false });
  });
  it("lists no Petromin night on the community card, as before, and no Petromin Days for a community member", () => {
    const v = { member: true, petromin: false };
    expect(keys(v)).toEqual(["runher", "jcc", "community"]);
    expect(of(v, "community")).toEqual(["sat1"]);
  });
  it("shows no Petromin Days to a holder while no Petromin night is on the books", () => {
    expect(eventCards([night("jcc1", "jcc")], { member: false, petromin: true }).map((c) => c.card.key)).toEqual(["jcc", "community"]);
  });
  it("hands Petromin Days over to the booking app as ev=petromin, on the night picked", () => {
    expect(bookingAt("https://book.example/?lang=ar", "petromin", "2026-10-14-pm")).toBe("https://book.example/?lang=ar&ev=petromin&session=2026-10-14-pm");
    expect(bookingAt("https://book.example/?ev=community", "petromin", "x")).toBe("https://book.example/?ev=petromin&session=x");
    expect(bookingAt("/experiences", "petromin", "x")).toBe("/experiences");
  });
});

// Featured (2026-11-13): the booking app's _featLand and renderRegister. A card above the event cards for each
// featured date the visitor's cards list, and those dates first in their event's list.
describe("the Featured cards and the featured dates' place in a list (2026-11-13)", () => {
  type D = { id: string; kind: RideKind; date: string; times: [string, string] | null; featured?: boolean };
  const d = (id: string, kind: RideKind, date: string, featured = false, start = "07:00"): D => ({ id, kind, date, times: [start, "09:00"], featured });
  const cardsFor = (all: D[], v: { member: boolean; petromin: boolean }, count = 9) => eventCards(all, v).map(({ card, sessions }) => ({ card, sessions: sessions.slice(0, count) }));
  const anyone = { member: false, petromin: false };
  it("can feature only the kinds booked under the community card (and Petromin Days, which lists the same nights)", () => {
    const community = (Object.keys(EVENT_OF) as RideKind[]).filter((k) => EVENT_OF[k] === "community").sort();
    expect([...FEATURE_OK].sort()).toEqual(community);
  });
  it("gives a card to each featured date, soonest first, with the card it is booked under", () => {
    const all = [d("sat1", "saturday", "2099-11-16", true), d("jcc1", "jcc", "2099-11-17"), d("sw1", "swim", "2099-11-18", true), d("yg", "yoga", "2099-11-21", true), d("sat2", "saturday", "2099-11-23")];
    expect(featuredDates(cardsFor(all, anyone))).toEqual([{ ev: "community", id: "sat1" }, { ev: "community", id: "sw1" }, { ev: "community", id: "yg" }]);
  });
  it("gives none when nothing is featured, and reads a copy kept from before (no word on it) as not featured", () => {
    const all = [d("sat1", "saturday", "2099-11-16"), { id: "old", kind: "yoga" as const, date: "2099-11-21", times: null }];
    expect(featuredDates(cardsFor(all, anyone))).toEqual([]);
  });
  it("shows four at most, the soonest", () => {
    const all = ["16", "17", "18", "19", "20", "21"].map((n) => d(`s${n}`, "swim", `2099-11-${n}`, true));
    expect(FEATURED_MAX).toBe(4);
    expect(featuredDates(cardsFor(all, anyone)).map((x) => x.id)).toEqual(["s16", "s17", "s18", "s19"]);
    expect(featuredDates(cardsFor(all, anyone), 2).map((x) => x.id)).toEqual(["s16", "s17"]);
  });
  it("orders two on one day by their start", () => {
    const all = [d("late", "yoga", "2099-11-21", true, "16:00"), d("early", "swim", "2099-11-21", true, "07:00")];
    // the page gives them soonest first already (lib/rides.ts upcoming); the cards keep to that across events too
    expect(featuredDates([{ card: { key: "community" }, sessions: all }]).map((x) => x.id)).toEqual(["early", "late"]);
  });
  it("shows a card only for a date its event lists to this visitor: a Petromin night to a Petromin tag holder alone, under Petromin Days", () => {
    const all = [d("pm1", "petromin", "2099-11-15", true), d("sat1", "saturday", "2099-11-16", true)];
    expect(featuredDates(cardsFor(all, anyone))).toEqual([{ ev: "community", id: "sat1" }]);
    expect(featuredDates(cardsFor(all, { member: true, petromin: false }))).toEqual([{ ev: "community", id: "sat1" }]);
    expect(featuredDates(cardsFor(all, { member: false, petromin: true }))).toEqual([{ ev: "petromin", id: "pm1" }, { ev: "community", id: "sat1" }]);
  });
  it("shows a members' date's card to every visitor, as the community card lists that date to every visitor", () => {
    const all = [d("yg", "yoga", "2099-11-21", true)];
    for (const v of [anyone, { member: true, petromin: false }]) expect(featuredDates(cardsFor(all, v))).toEqual([{ ev: "community", id: "yg" }]);
  });
  it("has no card for a featured date further out than its event's list goes (Experiences > Dates: how many per event)", () => {
    const all = [d("sat1", "saturday", "2099-11-16"), d("sat2", "saturday", "2099-11-23"), d("sat3", "saturday", "2099-11-30"), d("yg", "yoga", "2099-12-05", true)];
    expect(featuredDates(cardsFor(all, anyone, 3))).toEqual([]);
    expect(featuredDates(cardsFor(all, anyone, 4))).toEqual([{ ev: "community", id: "yg" }]);
  });
  it("never features a circuit night or a date with a card of its own, whatever a copy says", () => {
    // lib/rides.ts featuredOf answers no for them; a list given one anyway still files it under its own card
    const all = [d("jcc1", "jcc", "2099-11-17"), d("rh", "runher", "2099-11-20"), d("yg", "yoga", "2099-11-21", true)];
    expect(featuredDates(cardsFor(all, anyone))).toEqual([{ ev: "community", id: "yg" }]);
  });

  const ids = (l: { id: string }[]) => l.map((x) => x.id);
  const feat = (s: D) => !!s.featured;
  it("puts the featured dates first and the rest after, each in date order and every date once", () => {
    const all = [d("sat1", "saturday", "2099-11-16"), d("sw1", "swim", "2099-11-18", true), d("yg", "yoga", "2099-11-21", true), d("sat2", "saturday", "2099-11-23")];
    const r = featuredFirst(all, feat);
    expect(ids(r.featured)).toEqual(["sw1", "yg"]);
    expect(ids(r.rest)).toEqual(["sat1", "sat2"]);
    expect([...ids(r.featured), ...ids(r.rest)].sort()).toEqual(ids(all).sort());
  });
  it("leaves the list exactly as it was with nothing featured", () => {
    const all = [d("sat1", "saturday", "2099-11-16"), d("sw1", "swim", "2099-11-18")];
    const r = featuredFirst(all, feat);
    expect(r.featured).toEqual([]);
    expect(r.rest).toBe(all);
  });
  it("has no rest when every date is featured", () => {
    const all = [d("sw1", "swim", "2099-11-18", true), d("yg", "yoga", "2099-11-21", true)];
    const r = featuredFirst(all, feat);
    expect(ids(r.featured)).toEqual(["sw1", "yg"]);
    expect(r.rest).toEqual([]);
  });
});

describe("a date's times", () => {
  it("are its start and end on a ride that does not gather, with when bikes go out", () => {
    expect(infoTimes(circuit, clock)).toEqual({ gather: "", start: "9 PM", end: "11 PM", collect: "8:15 PM" });
  });
  it("are its gathering and its start on a ride that gathers, and nothing where a time does not apply", () => {
    expect(infoTimes(saturday, clock)).toEqual({ gather: "5:45 AM", start: "6:15 AM", end: "", collect: "" });
    expect(infoTimes({ times: null, gather: false, collect: null }, clock)).toEqual({ gather: "", start: "", end: "", collect: "" });
    expect(infoTimes(circuit, (t) => fmtClock(t, "ar"))).toMatchObject({ start: fmtClock("21:00", "ar") });
  });
  it("fill the four names only, leaving any other as staff wrote it", () => {
    expect(fillTimes("{gather}|{start}|{end}|{collect}|{price}", { gather: "g", start: "s", end: "", collect: "c" })).toBe("g|s||c|{price}");
  });
});

describe("a date's text", () => {
  const at = (s: Parameters<typeof dateText>[0] & Parameters<typeof infoTimes>[0]) => dateText(s, TEXTS, infoTimes(s, clock));
  it("is its kind's own, filled from the date", () => {
    expect(at(circuit)).toBe("Circuit: bikes from 8:15 PM, 9 PM to 11 PM.");
    expect(at(saturday)).toBe("Gather 5:45 AM, start 6:15 AM.");
    expect(at({ ...circuit, kind: "swim", collect: null })).toBe("Pool 9 PM to 11 PM.");
    expect(at({ ...circuit, kind: "workshop", collect: null })).toBe("T100 9 PM to 11 PM.");
    expect(at({ ...saturday, kind: "runher", description: null })).toBe("Meet 5:45 AM, run 6:15 AM.");
  });
  it("is the card's own About for the National Day ride, and a Petromin night's own", () => {
    expect(at({ ...saturday, kind: "snd96" })).toBe("National Day ride.");
    expect(at({ ...circuit, kind: "petromin" })).toBe("Petromin: bikes from 8:15 PM.");
  });
  it("is a ticketed event's own description, as staff wrote it, else the Events About", () => {
    expect(at({ ...circuit, kind: "event", collect: null, description: "Brakes and gears, {start} sharp." })).toBe("Brakes and gears, {start} sharp.");
    expect(at({ ...circuit, kind: "event", collect: null, description: null })).toBe("Events: seats, not bikes.");
  });
});

describe("a date's facts", () => {
  const who = { all: "Everyone", members: "Community members", members18: "Community members, 18 and over", petromin: "Community members and Petromin's team", vlap: "Community members and Victory Lap athletes, 16 and over" };
  it("say who may book it: everyone, members, or members of 18 and over on Run for Her", () => {
    expect(infoWho({ members: false, kind: "jcc" }, who)).toBe("Everyone");
    expect(infoWho({ members: true, kind: "saturday" }, who)).toBe("Community members");
    expect(infoWho({ members: true, kind: "runher" }, who)).toBe("Community members, 18 and over");
    expect(infoWho({ members: false, kind: "event" }, who)).toBe("Everyone");
    expect(infoWho({ members: true, kind: "petromin" }, who)).toBe("Community members and Petromin's team");
  });

  it("say the price: free, an event's seat, or the cheapest bike on a paid ride with bikes - else nothing", () => {
    const t = { free: "Complimentary", seat: "SAR 50 per seat", from: "from SAR 57.5" };
    expect(infoPrice({ kind: "saturday", free: true }, t)).toBe("Complimentary");
    expect(infoPrice({ kind: "event", free: false }, t)).toBe("SAR 50 per seat");
    expect(infoPrice({ kind: "event", free: false }, { ...t, seat: null })).toBeNull();
    expect(infoPrice({ kind: "jcc", free: false }, t)).toBe("from SAR 57.5");
    expect(infoPrice({ kind: "snd96", free: false }, t)).toBe("from SAR 57.5");
    expect(infoPrice({ kind: "swim", free: false }, t)).toBeNull();
    expect(infoPrice({ kind: "jcc", free: false }, { ...t, from: null })).toBeNull();
    expect(rentsBikes("saturday")).toBe(true);
    for (const k of ["swim", "workshop", "event", "runher"] as const) expect(rentsBikes(k), k).toBe(false);
  });

  it("say where it is, and its map: the meeting point's, the circuit's directions, or none", () => {
    const words = { meetingPoint: "Meeting point", venueCircuit: "Jeddah Corniche Circuit", venueJyc: "Jeddah Yacht Club" };
    const DIR = "https://maps.app.goo.gl/circuit", MEET = "https://maps.app.goo.gl/meet";
    // a circuit night, named or not, and a session read without its place
    expect(infoPlace({ kind: "jcc", approval: false, location: null, meetUrl: null }, words, DIR)).toEqual({ name: "Jeddah Corniche Circuit", map: DIR });
    expect(infoPlace({ kind: "jcc", approval: false, location: "JCC", meetUrl: null }, words, DIR)).toEqual({ name: "Jeddah Corniche Circuit", map: DIR });
    expect(infoPlace({ kind: "snd96" }, words, DIR)).toEqual({ name: "Jeddah Corniche Circuit", map: DIR });
    // Run for Her at the Jeddah Yacht Club: its meeting point's link, or none (never the circuit's)
    expect(infoPlace({ kind: "runher", approval: false, location: "JYC", meetUrl: MEET }, words, DIR)).toEqual({ name: "Jeddah Yacht Club", map: MEET });
    expect(infoPlace({ kind: "runher", approval: false, location: "JYC", meetUrl: null }, words, DIR)).toEqual({ name: "Jeddah Yacht Club", map: null });
    // a run whose place is held back (reveal_at ahead: list_sessions blanks location) is still at the Jeddah Yacht Club
    expect(infoPlace({ kind: "runher", approval: false, location: null, meetUrl: MEET }, words, DIR)).toEqual({ name: "Jeddah Yacht Club", map: MEET });
    expect(infoPlace({ kind: "runher", approval: false, location: null, meetUrl: null }, words, DIR)).toEqual({ name: "Jeddah Yacht Club", map: null });
    // a ride staff approve that meets at a link (the Saturday ride), and one that does not
    expect(infoPlace({ kind: "saturday", approval: true, location: null, meetUrl: MEET }, words, DIR)).toEqual({ name: "Meeting point", map: MEET });
    expect(infoPlace({ kind: "saturday", approval: true, location: null, meetUrl: null }, words, DIR)).toEqual({ name: "Jeddah Corniche Circuit", map: DIR });
    // a circuit night's link is not a meeting point; a place staff named has no map of ours
    expect(infoPlace({ kind: "jcc", approval: false, location: null, meetUrl: MEET }, words, DIR)).toEqual({ name: "Jeddah Corniche Circuit", map: DIR });
    expect(infoPlace({ kind: "swim", approval: true, location: "Sharafeyah Branch", meetUrl: null }, words, DIR)).toEqual({ name: "Sharafeyah Branch", map: null });
    expect(infoPlace({ kind: "jcc", approval: false, location: null, meetUrl: null }, words, "")).toEqual({ name: "Jeddah Corniche Circuit", map: null });
  });

  it("say a run's two distances, in the page's words", () => {
    expect(infoDistance("runher", "{0} km")).toBe("3 km · 5 km");
    expect(infoDistance("runher", "{0} كم")).toBe("3 كم · 5 كم");
    expect(infoDistance("saturday", "{0} km")).toBeNull();
  });

  it("say the places: never on a ride staff approve, the waitlist when full or none are left, else how many when counted", () => {
    const t = { waitlist: "Waitlist", left1: "{0} spot left", leftN: "{0} spots left" };
    expect(infoPlaces({ approval: true, full: true, left: 2 }, t)).toBeNull();
    expect(infoPlaces({ approval: false, full: true, left: null }, t)).toBe("Waitlist");
    // Victory Lap: no count, only the waitlist once it is full (2026-10-17)
    expect(infoPlaces({ approval: false, full: false, left: 3, kind: "vlap" }, t)).toBeNull();
    expect(infoPlaces({ approval: false, full: false, left: 0, kind: "vlap" }, t)).toBe("Waitlist");
    expect(infoPlaces({ approval: false, full: false, left: 0 }, t)).toBe("Waitlist");
    expect(infoPlaces({ approval: false, full: false, left: 1 }, t)).toBe("1 spot left");
    expect(infoPlaces({ approval: false, full: false, left: 64 }, t)).toBe("64 spots left");
    expect(infoPlaces({ approval: false, full: false, left: null }, t)).toBeNull();
    expect(infoPlaces({ full: false }, t)).toBeNull();
  });

  it("end with the Saturday ride's breakfast stop, by its name in the page's language (2026-10-05)", () => {
    const sat = { kind: "saturday" as const, breakfast: "Bean Box", breakfastAr: "بين بوكس" };
    expect(infoBreakfast(sat, "en")).toBe("Bean Box");
    expect(infoBreakfast(sat, "ar")).toBe("بين بوكس");
    // every other language reads the name the stop was given, never the Arabic
    for (const l of ["fr", "ur", "zh"]) expect(infoBreakfast(sat, l), l).toBe("Bean Box");
    // no Arabic name: the name, on the Arabic page too
    expect(infoBreakfast({ ...sat, breakfastAr: null }, "ar")).toBe("Bean Box");
    // no stop yet, or a session read without the columns: nothing said
    expect(infoBreakfast({ ...sat, breakfast: null }, "ar")).toBeNull();
    expect(infoBreakfast({ kind: "saturday" }, "en")).toBeNull();
    // the Saturday ride alone stops for breakfast
    for (const kind of ["jcc", "swim", "workshop", "snd96", "event", "petromin"] as const) expect(infoBreakfast({ ...sat, kind }, "en"), kind).toBeNull();
    // Run for Her has a breakfast stop too (the owner, 2026-10-14)
    expect(infoBreakfast({ ...sat, kind: "runher" }, "en")).toBe("Bean Box");
    expect(infoBreakfast({ ...sat, kind: "runher" }, "ar")).toBe("بين بوكس");
  });

  it("say the stop under After, in the booking app's own words in the languages it speaks", () => {
    // the booking app's infoAfter and infoBreakfastAt; the other six languages are the site's own
    const APP: Record<string, [string, string]> = {
      fr: ["Ensuite", "Petit-déjeuner chez {0}"], es: ["Después", "Desayuno en {0}"], pt: ["Depois", "Café da manhã em {0}"],
      ur: ["اس کے بعد", "ناشتہ {0} میں"], hi: ["उसके बाद", "नाश्ता {0} में"], tl: ["Pagkatapos", "Almusal sa {0}"],
      ne: ["त्यसपछि", "{0} मा बिहानको खाजा"], bn: ["এরপর", "{0}-এ নাশতা"],
    };
    for (const [l, words] of Object.entries(APP)) {
      const tx = makeL(l, JSON.parse(readFileSync(new URL(`../../i18n/tx/${l}.json`, import.meta.url), "utf8")));
      expect([tx("After", "بعدها"), tx("Breakfast at {0}", "الإفطار في {0}")], l).toEqual(words);
    }
  });
});

describe("the texts staff edit", () => {
  const field = (sec: string, id: string) => {
    const f = experiencesSchema.sections.find((s) => s.id === sec)?.fields.find((x) => x.id === id);
    return f && (f.type === "text" || f.type === "longtext") ? f : null;
  };
  it("are the keys the booking app reads (experiences.events.<id>, experiences.dates.<id>), each fitting its field", () => {
    const keys = [...["jccAbout", "commAbout", "sndAbout", "wsAbout", "evAbout", "rhAbout"].map((id) => ["events", id]),
      ...["aboutJcc", "aboutSat", "aboutPetro", "aboutSwim", "aboutWs", "aboutRun"].map((id) => ["dates", id])];
    for (const [sec, id] of keys) {
      const f = field(sec, id);
      expect(f, `${sec}.${id}`).not.toBeNull();
      expect(f!.def.en.length, id).toBeLessThanOrEqual(f!.max);
      expect(f!.def.ar.length, id).toBeLessThanOrEqual(f!.max);
      // a date's text is filled from the date: nothing but its four times, the same in both languages
      const names = (s: string) => (s.match(/\{[a-z]+\}/g) ?? []).sort();
      expect(names(f!.def.en).every((n) => ["{gather}", "{start}", "{end}", "{collect}"].includes(n)), id).toBe(true);
      expect(names(f!.def.ar), id).toEqual(names(f!.def.en));
    }
  });
  it("give Petromin Days its own texts and Petromin's mark (2026-10-12)", () => {
    for (const id of ["pmTitle", "pmMeta", "pmNote", "pmAbout"]) {
      const f = field("events", id);
      expect(f, id).not.toBeNull();
      expect(f!.def.en.length, id).toBeLessThanOrEqual(f!.max);
      expect(f!.def.ar.length, id).toBeLessThanOrEqual(f!.max);
    }
    expect(field("events", "pmTitle")!.def).toEqual({ en: "Petromin Days", ar: "أيام بترومين" });
    const logo = experiencesSchema.sections.find((s) => s.id === "events")?.fields.find((x) => x.id === "pmLogo");
    expect(logo && "def" in logo ? logo.def : null).toBe("/site/petromin-logo.png");
    expect(readFileSync(new URL("../../../public/site/petromin-logo.png", import.meta.url)).length).toBeGreaterThan(0);
  });
});

// Victory Lap by Fitness Empire (ride_kind 'vlap', 2026-10-17): booked by Community members and Victory Lap
// tag holders, yet its card, About and Details are everyone's; its price only to those who may book it.
describe("Victory Lap on Experiences", () => {
  it("shows its card, its About and its dates' Details to everyone", () => {
    expect(membersOnlyEvent("vlap")).toBe(false);
    const nobody = { member: false, petromin: false };
    expect(infoShown(membersOnlyEvent("vlap"), memberOn("vlap", nobody))).toBe(true);
    expect(infoShown(membersOnlyDate({ members: true, kind: "vlap" }), memberOn("vlap", nobody))).toBe(true);
    // any other members-only date still shows its Details to members alone
    expect(infoShown(membersOnlyDate({ members: true, kind: "saturday" }), memberOn("community", nobody))).toBe(false);
    expect(membersOnlyDate({ members: false, kind: "jcc" })).toBe(false);
  });

  it("has a card of its own while it has a date, after Petromin Days and before Run for Her, as on the booking app's landing", () => {
    const all = [{ id: "rh", kind: "runher" as const }, { id: "vl", kind: "vlap" as const }, { id: "j", kind: "jcc" as const }, { id: "pm", kind: "petromin" as const }];
    expect(eventCards(all, { member: false, petromin: true }).map((c) => c.card.key)).toEqual(["petromin", "vlap", "runher", "jcc", "community"]);
    expect(eventCards(all, { member: false, petromin: false }).find((c) => c.card.key === "vlap")?.sessions.map((x) => x.id)).toEqual(["vl"]);
    expect(eventCards([{ id: "j", kind: "jcc" as const }], { member: true, petromin: false }).map((c) => c.card.key)).not.toContain("vlap");
    expect(EVENT_CARDS[2]).toEqual({ key: "vlap", p: "vl", always: false }); // the Blood Donation event's card sits between them while it has a date (blood.test.ts)
    expect(bookingAt("https://book.example/", "vlap", "2026-10-26-vl")).toBe("https://book.example/?ev=vlap&session=2026-10-26-vl");
  });

  it("says its doors and first heat, who may book it, and no bike price", () => {
    const vl = { kind: "vlap" as const, times: ["16:30", "17:15"] as [string, string], gather: true, collect: null, description: null };
    expect(dateText(vl, TEXTS, infoTimes(vl, clock))).toBe("Doors 4:30 PM, first heat 5:15 PM.");
    const who = { all: "Everyone", members: "Community members", members18: "Community members, 18 and over", petromin: "Community members and Petromin's team", vlap: "Community members and Victory Lap athletes, 16 and over" };
    expect(infoWho({ members: true, kind: "vlap" }, who)).toBe("Community members and Victory Lap athletes, 16 and over");
    expect(infoWho({ members: true, kind: "saturday" }, who)).toBe("Community members");
    expect(rentsBikes("vlap")).toBe(false);
  });

  it("says its price per athlete only when the page gives it (a visitor who may book it), never a bike's", () => {
    const t = { free: "Complimentary", seat: "SAR 50 per seat", from: "from SAR 57.5" };
    expect(infoPrice({ kind: "vlap", free: false }, t)).toBeNull();
    expect(infoPrice({ kind: "vlap", free: false }, { ...t, athlete: null })).toBeNull();
    expect(infoPrice({ kind: "vlap", free: false }, { ...t, athlete: "SAR 150 · per athlete, VAT included" })).toBe("SAR 150 · per athlete, VAT included");
  });

  it("lists the races and divisions open to book (sessions.vl), every one when unset", () => {
    const t = {
      races: { ws: "Women’s Singles", ms: "Men’s Singles", wd: "Women’s Doubles", md: "Men’s Doubles", xd: "Mixed Doubles" },
      divs: { so: "Sprint Open", se: "Sprint Elite", op: "Open", el: "Elite" }, km: "{0} km",
    };
    expect(infoVl({ kind: "vlap", vl: null }, t)).toEqual({
      races: "Women’s Singles · Men’s Singles · Women’s Doubles · Men’s Doubles · Mixed Doubles",
      divs: "Sprint Open 4 km · Sprint Elite 4 km · Open 6.1 km · Elite 6.1 km",
    });
    expect(infoVl({ kind: "vlap", vl: { races: ["xd", "ws"], divs: ["el"] } }, t)).toEqual({ races: "Women’s Singles · Mixed Doubles", divs: "Elite 6.1 km" });
    expect(infoVl({ kind: "vlap", vl: '{"divs":["so"]}' }, t)?.divs).toBe("Sprint Open 4 km");
    expect(infoVl({ kind: "runher", vl: null }, t)).toBeNull();
  });

  it("has its About and Details texts in Experiences' fields, the booking app's own words", () => {
    const f = (sec: string, id: string) => experiencesSchema.sections.find((x) => x.id === sec)?.fields.find((x) => x.id === id) as { def: { en: string; ar: string } } | undefined;
    expect(f("events", "vlAbout")?.def.en).toMatch(/^Victory Lap by Fitness Empire: a hybrid fitness race at the Jeddah Corniche Circuit\./);
    expect(f("events", "vlAbout")?.def.ar).toContain("فيكتوري لاب");
    expect(f("dates", "aboutVl")?.def.en).toBe("Doors open at {gather} and the first heat starts at {start}. Arrive at least 30 minutes before your heat to collect your race bib.");
    expect(f("dates", "vlName")?.def).toEqual({ en: "Victory Lap", ar: "فيكتوري لاب" });
    // its card never says a price
    for (const id of ["vlTitle", "vlMeta", "vlNote"]) expect(f("events", id)?.def.en, id).not.toMatch(/SAR|150|﷼/);
    // the race's logo, white-background (dark) mark, is the site's own file
    const logo = experiencesSchema.sections.find((x) => x.id === "events")?.fields.find((x) => x.id === "vlLogo") as { def: string } | undefined;
    expect(logo?.def).toBe("/site/victory-lap-dark.webp");
    expect(readFileSync(new URL("../../../public/site/victory-lap-dark.webp", import.meta.url)).length).toBeGreaterThan(0);
  });
});

describe("the DEFE 5KM Run (ride_kind 'defe5k', 2026-10-18)", () => {
  const defe = { kind: "defe5k" as const, times: ["19:00", "19:00"] as [string, string], gather: false, collect: null, description: null };
  it("is a date among the community rides, never a card of its own", () => {
    const all = [{ id: "2026-10-22-df", kind: "defe5k" as const }, { id: "2026-10-24", kind: "saturday" as const }, { id: "j", kind: "jcc" as const }];
    const cards = eventCards(all, { member: true, petromin: false });
    expect(cards.map((c) => c.card.key)).toEqual(["jcc", "community"]);
    expect(cards.find((c) => c.card.key === "community")?.sessions.map((x) => x.id)).toEqual(["2026-10-22-df", "2026-10-24"]);
    expect(EVENT_CARDS.map((c) => c.key)).not.toContain("defe5k");
    expect(bookingAt("https://book.example/", "community", "2026-10-22-df")).toBe("https://book.example/?ev=community&session=2026-10-22-df");
  });
  it("says its one start time and its own text, for members, with no bike price", () => {
    expect(infoTimes(defe, clock)).toEqual({ gather: "", start: "7 PM", end: "", collect: "" });
    expect(dateText(defe, TEXTS, infoTimes(defe, clock))).toBe("Defe run at 7 PM.");
    const who = { all: "Everyone", members: "Community members", members18: "Community members, 18 and over", petromin: "x", vlap: "y" };
    expect(infoWho({ members: true, kind: "defe5k" }, who)).toBe("Community members");
    expect(rentsBikes("defe5k")).toBe(false);
    expect(infoPrice({ kind: "defe5k", free: true }, { free: "Complimentary", seat: null, from: "from SAR 57.5" })).toBe("Complimentary");
    expect(infoPrice({ kind: "defe5k", free: false }, { free: "Complimentary", seat: null, from: "from SAR 57.5" })).toBeNull();
  });
  it("runs 5 km, at the circuit, its map the meeting point staff set", () => {
    expect(infoDistance("defe5k", "{0} km")).toBe("5 km");
    expect(infoDistance("defe5k", "{0} كم")).toBe("5 كم");
    const words = { meetingPoint: "Meeting point", venueCircuit: "Jeddah Corniche Circuit", venueJyc: "Jeddah Yacht Club" };
    expect(infoPlace({ kind: "defe5k", approval: false, location: "JCC", meetUrl: "https://maps.app.goo.gl/x" }, words, "https://dir")).toEqual({ name: "Jeddah Corniche Circuit", map: "https://maps.app.goo.gl/x" });
    expect(infoPlace({ kind: "defe5k", approval: false, location: "JCC", meetUrl: null }, words, "https://dir")).toEqual({ name: "Jeddah Corniche Circuit", map: "https://dir" });
  });
  it("has its name and Details text in Experiences' fields, the booking app's own words", () => {
    const f = (id: string) => experiencesSchema.sections.find((x) => x.id === "dates")?.fields.find((x) => x.id === id) as { def: { en: string; ar: string } } | undefined;
    expect(f("defeName")?.def).toEqual({ en: "DEFE 5KM Run", ar: "سباق دفء 5 كم" });
    expect(f("aboutDefe")?.def.en).toBe("Run 5 km with Defe for breast cancer awareness, together with the MicroMobility community, at the Jeddah Corniche Circuit. Collect your race kit at Jeddah Park on 21 October, 4–10 PM. The race starts on 22 October at 7 PM.");
    expect(f("aboutDefe")?.def.ar).toContain("دفء");
    expect(readFileSync(new URL("../../../public/site/defe-logo.svg", import.meta.url), "utf8")).toMatch(/^<svg[^>]*viewBox="112 203 977 660"/);
  });
});

describe("yoga (ride_kind 'yoga', 2026-11-12)", () => {
  // Hatha Yoga for Cyclists with Jassim Alsaady, as the booking app makes it: members only, free, a start and an end
  // ("16:00 - 17:30"), at SILKDEER with its map
  const yoga = { kind: "yoga" as const, times: ["16:00", "17:30"] as [string, string], gather: false, collect: null, description: null };
  const MAP = "https://maps.app.goo.gl/TfCSEPEPxA4C5f7d7";
  it("is a date among the community rides, never a card of its own", () => {
    const all = [{ id: "2026-11-21-yg", kind: "yoga" as const }, { id: "2026-11-21", kind: "saturday" as const }, { id: "j", kind: "jcc" as const }];
    const cards = eventCards(all, { member: true, petromin: false });
    expect(cards.map((c) => c.card.key)).toEqual(["jcc", "community"]);
    expect(cards.find((c) => c.card.key === "community")?.sessions.map((x) => x.id)).toEqual(["2026-11-21-yg", "2026-11-21"]);
    expect(EVENT_CARDS.map((c) => c.key)).not.toContain("yoga");
    expect(EVENT_OF.yoga).toBe("community");
    expect(bookingAt("https://book.example/", EVENT_OF.yoga, "2026-11-21-yg")).toBe("https://book.example/?ev=community&session=2026-11-21-yg");
  });
  it("says its start and its end in its own text, for members, free, with no bike price and no distance", () => {
    expect(infoTimes(yoga, clock)).toEqual({ gather: "", start: "4 PM", end: "5:30 PM", collect: "" });
    expect(dateText(yoga, TEXTS, infoTimes(yoga, clock))).toBe("Yoga 4 PM to 5:30 PM.");
    const who = { all: "Everyone", members: "Community members", members18: "Community members, 18 and over", petromin: "x", vlap: "y" };
    expect(infoWho({ members: true, kind: "yoga" }, who)).toBe("Community members");
    expect(rentsBikes("yoga")).toBe(false);
    expect(infoPrice({ kind: "yoga", free: true }, { free: "Complimentary", seat: null, from: "from SAR 57.5" })).toBe("Complimentary");
    expect(infoPrice({ kind: "yoga", free: false }, { free: "Complimentary", seat: null, from: "from SAR 57.5" })).toBeNull();
    expect(infoDistance("yoga", "{0} km")).toBeNull();
    expect(infoPlaces({ kind: "yoga", full: false, left: 2, approval: false }, { waitlist: "Waitlist", left1: "{0} spot left", leftN: "{0} spots left" })).toBe("2 spots left");
  });
  it("is at the place staff named with its own map, at its meeting point when it names none, never the circuit", () => {
    const words = { meetingPoint: "Meeting point", venueCircuit: "Jeddah Corniche Circuit", venueJyc: "Jeddah Yacht Club" };
    expect(infoPlace({ kind: "yoga", approval: false, location: "SILKDEER", meetUrl: MAP }, words, "https://dir")).toEqual({ name: "SILKDEER", map: MAP });
    expect(infoPlace({ kind: "yoga", approval: false, location: null, meetUrl: MAP }, words, "https://dir")).toEqual({ name: "Meeting point", map: MAP });
    expect(infoPlace({ kind: "yoga", approval: false, location: "SILKDEER", meetUrl: null }, words, "https://dir")).toEqual({ name: "SILKDEER", map: null });
  });
  it("runs as long as its start and end say, and says who leads it, how long, the level and what to bring", () => {
    expect(yogaMinutes(["16:00", "17:30"])).toBe(90);
    expect(yogaMinutes(["9:05", "10:00"])).toBe(55);
    for (const t of [null, undefined, ["19:00", "19:00"], ["18:00", "17:00"], ["x", "17:00"]] as const) expect(yogaMinutes(t as [string, string] | null | undefined), String(t)).toBe(0);
    expect(yogaLength(["16:00", "17:30"], "{0} min")).toBe("90 min");
    expect(yogaLength(["16:00", "17:30"], "{0} دقيقة")).toBe("90 دقيقة");
    expect(yogaLength(["19:00", "19:00"], "{0} min")).toBe("");
    const w = { leadK: "Led by", leadV: "Jassim Alsaady", durK: "Length", levelK: "Level", levelV: "All levels, no yoga experience needed", bringK: "Bring", bringV: "Your yoga mat, and wear comfortable clothing" };
    expect(yogaKnow(w, "90 min")).toEqual([["Led by", "Jassim Alsaady"], ["Length", "90 min"], ["Level", "All levels, no yoga experience needed"], ["Bring", "Your yoga mat, and wear comfortable clothing"]]);
    expect(yogaKnow(w).map(([k]) => k)).toEqual(["Led by", "Level", "Bring"]);
  });
  it("has its name and Details text in Experiences' fields, the booking app's own words, and its mark", () => {
    const f = (id: string) => experiencesSchema.sections.find((x) => x.id === "dates")?.fields.find((x) => x.id === id) as { def: { en: string; ar: string }; max: number } | undefined;
    expect(f("yogaName")?.def).toEqual({ en: "Hatha Yoga for Cyclists", ar: "هاثا يوغا لراكبي الدراجات" });
    const about = f("aboutYoga");
    expect(about?.def.en).toBe("Ninety minutes of Hatha Yoga made for cyclists, with Jassim Alsaady: mindful movement, deep stretching, gentle strengthening and breathwork for the hips, lower back and legs that riding leaves tight. A time to slow down, feel grounded and recover with the community. {start} to {end}. All levels welcome, no experience needed. Bring your yoga mat and wear comfortable clothing. Free for community members; places are limited.");
    expect(about?.def.ar).toContain("من {start} إلى {end}");
    expect(about!.def.en.length).toBeLessThanOrEqual(about!.max);
    expect(fillTimes(about!.def.en, infoTimes(yoga, clock))).toContain(" 4 PM to 5:30 PM. ");
    expect(readFileSync(new URL("../../../public/site/yoga-mark.svg", import.meta.url), "utf8")).toMatch(/^<svg[^>]*viewBox="0 0 64 40"/);
  });
});
