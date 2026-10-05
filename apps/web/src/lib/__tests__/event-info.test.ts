import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { experiencesSchema } from "@/content/pages/experiences";
import { makeL } from "@/i18n/tx";
import { dateText, fillTimes, infoBreakfast, infoDistance, infoPlace, infoPlaces, infoPrice, infoShown, infoTimes, infoWho, membersOnlyEvent, rentsBikes, type DateTexts } from "../event-info";
import { fmtClock } from "../tickets";

// "About this event" and "Details" on Experiences (2026-10-05) say what the booking app's picker
// says: the same texts, filled from the same date, and shown to the same visitors.

const clock = (t: string) => fmtClock(t, "en");
const TEXTS: DateTexts = {
  aboutJcc: "Circuit: bikes from {collect}, {start} to {end}.", aboutSat: "Gather {gather}, start {start}.", aboutSwim: "Pool {start} to {end}.",
  aboutWs: "T100 {start} to {end}.", aboutRun: "Meet {gather}, run {start}.", sndAbout: "National Day ride.", evAbout: "Events: seats, not bikes.",
};
const circuit = { kind: "jcc" as const, times: ["21:00", "23:00"] as [string, string], gather: false, collect: "20:15", description: null };
const saturday = { kind: "saturday" as const, times: ["05:45", "06:15"] as [string, string], gather: true, collect: null, description: "Breakfast at the marina." };

describe("who sees the links", () => {
  it("shows a card anyone may book to everyone, and the community rides and Run for Her to members alone", () => {
    for (const key of ["jcc", "snd96", "workshop", "event"]) expect(membersOnlyEvent(key), key).toBe(false);
    for (const key of ["community", "runher"]) expect(membersOnlyEvent(key), key).toBe(true);
    expect(infoShown(false, false)).toBe(true);
    expect(infoShown(false, true)).toBe(true);
    expect(infoShown(true, false)).toBe(false);
    expect(infoShown(true, true)).toBe(true);
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
  it("is the card's own About for the National Day ride, and the circuit's for a kind without one", () => {
    expect(at({ ...saturday, kind: "snd96" })).toBe("National Day ride.");
    expect(at({ ...circuit, kind: "petromin" })).toBe("Circuit: bikes from 8:15 PM, 9 PM to 11 PM.");
  });
  it("is a ticketed event's own description, as staff wrote it, else the Events About", () => {
    expect(at({ ...circuit, kind: "event", collect: null, description: "Brakes and gears, {start} sharp." })).toBe("Brakes and gears, {start} sharp.");
    expect(at({ ...circuit, kind: "event", collect: null, description: null })).toBe("Events: seats, not bikes.");
  });
});

describe("a date's facts", () => {
  const who = { all: "Everyone", members: "Community members", members18: "Community members, 18 and over" };
  it("say who may book it: everyone, members, or members of 18 and over on Run for Her", () => {
    expect(infoWho({ members: false, kind: "jcc" }, who)).toBe("Everyone");
    expect(infoWho({ members: true, kind: "saturday" }, who)).toBe("Community members");
    expect(infoWho({ members: true, kind: "runher" }, who)).toBe("Community members, 18 and over");
    expect(infoWho({ members: false, kind: "event" }, who)).toBe("Everyone");
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
    for (const kind of ["jcc", "swim", "workshop", "snd96", "event", "runher", "petromin"] as const) expect(infoBreakfast({ ...sat, kind }, "en"), kind).toBeNull();
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
});
