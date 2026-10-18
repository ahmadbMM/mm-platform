import { describe, expect, it } from "vitest";
import { createElement, type ReactElement } from "react";
// The site has no @types/react-dom; this test needs one function of it (as rating.test.ts does).
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { BIKE_KINDS, NON_BIKE_KINDS, isNonBike } from "../bike-kinds";
import { formOf, questionKeys, ratingNoBike, rideWord } from "../rating";
import { rentsBikes } from "../event-info";
import { badgeList, recordRows, rideStats, type BadgeData, type RecordSession } from "../ride-record";
import { ticketRow, ticketSession } from "../tickets";
import { RATING_WORDS } from "@/components/account/RatingForm.words";
import { CLAIM_WORDS } from "@/components/claim/ClaimCard.words";
import { T as TICKET } from "@/components/booking/tickets.text";
import TicketCard from "@/components/booking/TicketCard";
import { serverLocalize } from "@/i18n/dicts";
import { LOCALE_CODES } from "@/i18n/locales";
import type { RideKind } from "../rides";

const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;

// The owner, 2026-10-18: "make sure all non-cycling related sessions dont include anything about cycling
// anywhere especially in surveys registration etc." The pool, the workshop, an event, Run for Her, Victory Lap
// and the DEFE 5KM Run say session (or run), participants and person, never ride, rider or bike.

/** Words that mean riding a bike, in the languages where a ride word would slip through. */
const CYCLING = /\b(ride|rides|rider|riders|riding|bike|bikes|cycling|cyclist|gowes|pesepeda|bersepeda|kayuhan|penunggang|basikal|Fahrt|Ausfahrt|Fahrer|Rad|vélo|cycliste|sortie|bici|ciclista|recorrido|passeio|bicicleta|заезд|велосипед|райдер)\b|رحلة|جولة|راكب|دراجة|रा[इई]ड|রাইড|رائیڈ|骑|自転車|ライド/iu;

describe("which sessions have no bike", () => {
  it("(the cycling words this file looks for are caught)", () => {
    for (const s of [TICKET.en.underReview, CLAIM_WORDS.id.lateSub, CLAIM_WORDS.ms.doneSub, CLAIM_WORDS.zh.noSub, TICKET.ar.cueDone("1"), RATING_WORDS.ja.kicker, "Wie war die Fahrt?"]) expect(s).toMatch(CYCLING);
  });
  it("knows them by kind, the same list as rentsBikes, and every other kind is a bike kind", () => {
    const all: RideKind[] = ["jcc", "saturday", "swim", "workshop", "petromin", "snd96", "event", "runher", "vlap", "defe5k"];
    for (const k of all) {
      expect(isNonBike(k), k).toBe(!rentsBikes(k));
      expect(BIKE_KINDS.has(k) !== NON_BIKE_KINDS.has(k), k).toBe(true);
    }
  });
  it("knows them by the booking app's session id when the session did not load", () => {
    for (const id of ["2026-10-20-tw", "2026-10-05-ev", "2026-10-17-rh", "2026-10-26-vl", "2026-10-22-df", "2026-10-22-df-2"]) expect(isNonBike(null, id), id).toBe(true);
    for (const id of ["2026-10-20", "2026-09-30-pw", "2026-09-23-nd", "2026-10-22-dfx", "j1", ""]) expect(isNonBike(undefined, id), id).toBe(false);
    expect(isNonBike("saturday", "2026-10-24")).toBe(false);
  });
});

describe("the rating on a session without a bike", () => {
  it("says run on a run, session on the pool, the workshop, an event and Victory Lap, ride on a bike", () => {
    expect(rideWord("runher")).toBe("run");
    expect(rideWord(null, "2026-10-22-df")).toBe("run");
    for (const k of ["swim", "workshop", "event", "vlap"]) expect(rideWord(k), k).toBe("session");
    expect(rideWord(undefined, "2026-10-26-vl")).toBe("session");
    expect(rideWord(undefined, "2026-10-20-tw")).toBe("session");
    for (const k of ["jcc", "saturday", "petromin", "snd96"]) expect(rideWord(k), k).toBe("ride");
    expect(rideWord(undefined, "2026-10-24")).toBe("ride");
  });
  it("never asks the bike question there, even when the session did not load", () => {
    expect(ratingNoBike(false, null, "2026-10-26-vl")).toBe(true);
    expect(ratingNoBike(false, undefined, "2026-10-05-ev")).toBe(true);
    expect(ratingNoBike(false, { kind: "swim", bikes: false }, "2026-10-20")).toBe(true);
    expect(ratingNoBike(false, { kind: "vlap", bikes: true }, "x")).toBe(true);
    expect(ratingNoBike(false, { kind: "jcc", bikes: true }, "j1")).toBe(false);
    expect(ratingNoBike(false, null, "2026-10-24")).toBe(false);
    expect(ratingNoBike(true, { kind: "jcc", bikes: true }, "j1")).toBe(true);
    expect(questionKeys(formOf("vlap"), { noBike: ratingNoBike(false, null, "2026-10-26-vl") })).toEqual(["service", "experience"]);
  });
  it("has the session words in all 16 languages, none of them about cycling", () => {
    expect(Object.keys(RATING_WORDS).sort()).toEqual([...LOCALE_CODES].sort());
    for (const [l, w] of Object.entries(RATING_WORDS)) {
      for (const k of ["kicker", "title", "thanks"] as const) {
        expect(w.session[k].trim(), `${l}.session.${k}`).not.toBe("");
        expect(w.session[k], `${l}.session.${k}`).not.toBe(w[k]);
        expect(w.session[k], `${l}.session.${k}`).not.toMatch(CYCLING);
      }
      // signed out mid-rating, on any session: never "rate the ride"
      expect(w.errors.signin, `${l}.errors.signin`).not.toMatch(CYCLING);
    }
    expect(RATING_WORDS.en.session).toEqual({ kicker: "Rate your session", title: "How was your session?", thanks: "Thanks for rating your session." });
    // the six languages the booking app does not speak are translated, not left in English
    for (const l of ["id", "ms", "de", "ru", "zh", "ja"] as const) expect(RATING_WORDS[l].session.title, l).not.toBe(RATING_WORDS.en.session.title);
  });
});

describe("the waitlist claim card on a session without a bike", () => {
  it("says person and there in every language, never rider and ride", () => {
    for (const [l, w] of Object.entries(CLAIM_WORDS)) {
      for (const k of ["doneSubNb", "lateSubNb", "noSubNb"] as const) expect(w[k], `${l}.${k}`).not.toMatch(CYCLING);
    }
    expect(CLAIM_WORDS.en.doneSubNb).toBe("See you there. Your ticket is in My Bookings.");
    expect(CLAIM_WORDS.en.noSub).toContain("next rider"); // a ride keeps the booking app's words
  });
});

describe("the ticket on a session without a bike", () => {
  const swimRow = { id: "2099-10-20-sw", session_date: "2099-10-20", event_kind: "community", ride_kind: "swim", needs_approval: false, hide_queue: false, open_to_all: true, paid_ride: false, bike_slots: '{"_time":"06:00 - 07:00"}', meet_url: null, title: "Pool" };
  const swim = ticketSession(swimRow)!;
  const row = (o: Record<string, unknown>) => ticketRow({ session_id: swim.id, session_date: swim.date, session_day: "Tuesday", status: "waiting", price: 0, paid: false, type_preference: "None", ...o })!;
  const card = (rows: ReturnType<typeof row>[], o: { session?: typeof swim; past?: boolean; today?: string } = {}) => renderToStaticMarkup(createElement(TicketCard, {
    locale: "en", today: o.today ?? "2099-10-18", rows, session: "session" in o ? o.session : swim, name: "Pool", cue: null, t: TICKET.en, gather: "Gathering", start: "Start", typeName: (x: string) => x,
    links: { edit: null, manage: "https://book.example.test/?tab=bookings", place: null }, now: Date.parse("2099-10-18T09:00:00Z"), past: o.past,
  }));
  it("counts a party in participants, not bikes", () => {
    const html = card([row({ id: "s1abcdef", queue_num: 4, name: "Ann" }), row({ id: "s2abcdef", queue_num: 5, name: "Bea" })]);
    expect(html).toContain("2 participants");
    expect(html).toContain("Participants");
    expect(html).not.toMatch(/2 bikes|Riders|Helmet/);
  });
  it("says Session done on the night, not Ride done on the bike", () => {
    const html = card([row({ id: "s1abcdef", queue_num: 4, name: "Ann", status: "done", paid: true, ride_duration: 50 })], { past: true, today: "2099-10-20" });
    expect(html).toContain("Session done: 50 min.");
    expect(html).not.toContain("on the bike");
  });
  it("reads a session that did not load by its id", () => {
    const html = card([ticketRow({ id: "e1abcdef", session_id: "2099-10-05-ev", session_date: "2099-10-05", session_day: "Monday", status: "waiting", price: 0, paid: false, name: "Ann", type_preference: "None" })!], { session: undefined, today: "2099-10-01" });
    expect(html).toContain("Participants");
    expect(html).not.toMatch(/Riders|Helmet/);
  });
  it("has its words in every language", () => {
    expect(TICKET.en.partyN("3")).toBe("3 participants");
    expect(TICKET.ar.party2).toBe("مشاركان");
    for (const l of LOCALE_CODES) {
      const t = serverLocalize(TICKET, l);
      for (const s of [t.party2, t.partyN("3"), t.underReviewNb, t.cueDoneNb("1 h"), t.cueDoneNoDurNb, t.participantOffer("10%")]) expect(s, l).not.toMatch(CYCLING);
      if (["id", "ms", "de", "ru", "zh", "ja"].includes(l)) expect(t.partyN("3"), l).not.toBe("3 participants");
    }
  });
});

describe("Your rides and the ride badges count bike nights alone", () => {
  const empty: BadgeData = { catalog: [], weeks: null, seasons: [], mine: [] };
  const today = "2026-10-18";
  const r = (id: string, d: string, o: Record<string, unknown> = {}) => ({ id: `${id}x`, session_id: id, session_date: d, status: "done", paid: true, queue_num: 1, type_preference: "None", price: 0, ...o });
  const ses = new Map<string, RecordSession>([
    ["2026-10-06-sw", { kind: "swim", freeRide: true }], ["2026-10-08-tw", { kind: "workshop", freeRide: true }],
    ["2026-10-10-ev", { kind: "event", freeRide: true }], ["2026-10-17-rh", { kind: "runher", freeRide: true }],
    ["2026-10-12", { kind: "jcc", freeRide: false }],
  ]);
  it("never counts the pool, the workshop, an event or a run as a ride", () => {
    const rows = recordRows([r("2026-10-06-sw", "2026-10-06"), r("2026-10-08-tw", "2026-10-08"), r("2026-10-10-ev", "2026-10-10"), r("2026-10-17-rh", "2026-10-17"), r("2026-10-26-vl", "2026-10-16")]);
    expect(rideStats(rows, ses, today)).toBeNull();
    const L = badgeList(rows, ses, empty, today, null).flatMap((x) => x.lv ?? [x]);
    for (const slug of ["first_lap", "regular", "front_row", "streak", "triple_crown", "squad"]) expect(L.find((x) => x.slug === slug)?.on, slug).toBe(false);
    // the run's own badge still comes
    expect(L.find((x) => x.slug === "run_for_her")?.on).toBe(true);
  });
  it("counts the bike night beside them", () => {
    const rows = recordRows([r("2026-10-06-sw", "2026-10-06"), r("2026-10-12", "2026-10-12", { type_preference: "Road", ride_duration: 90 })]);
    expect(rideStats(rows, ses, today)).toMatchObject({ year: 1, minutes: 90, fav: "Road", first: "2026-10-12" });
    const L = badgeList(rows, ses, empty, today, null).flatMap((x) => x.lv ?? [x]);
    expect(L.find((x) => x.slug === "first_lap")).toMatchObject({ on: true, p: "1/1" });
    expect(L.find((x) => x.slug === "regular")?.p).toBe("1/5");
  });
});

describe("the activity waiver (2026-10-18, activity-2026-10-v3)", () => {
  it("says any activity, never ride, in every language, and matches the booking app's version", async () => {
    const { WAIVER_VERSIONS, waiverCopy } = await import("@/content/waivers");
    const { serverL } = await import("@/i18n/dicts");
    expect(WAIVER_VERSIONS.activity).toBe("activity-2026-10-v3");
    for (const l of LOCALE_CODES) {
      const c = waiverCopy("activity", serverL(l));
      expect(c.body, l).not.toMatch(CYCLING);
      if (l !== "en") expect(c.body, l).not.toMatch(/^You cannot/);
      for (const k of ["title", "agree"] as const) expect(c[k], `${l}.${k}`).not.toMatch(CYCLING);
      const sw = waiverCopy("swim", serverL(l));
      for (const k of ["title", "body", "agree"] as const) expect(sw[k], `${l}.swim.${k}`).not.toMatch(CYCLING);
    }
    expect(waiverCopy("activity", serverL("en")).body.startsWith("You cannot book any activity with MicroMobility")).toBe(true);
  });
});
