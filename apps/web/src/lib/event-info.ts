import { fill as fillAt } from "@/i18n/tx";
import { fill } from "./fill";
import type { RideKind, RideSession } from "./rides";
import { hasBreakfast, meetsAt, RUN_KMS, venueOf, venueText } from "./tickets";
import { VL_DIV_KM, vlConfig, type VlDiv, type VlRace } from "./vlap";

// "About this event" and "Details" on Experiences (the owner, 2026-10-05), as the booking app's event
// picker has them (_infoAboutBtn, _infoDetailsBtn, _infoFacts): under each event card a link opens
// what the event is, and under each date's time another opens what that date is - a short text, then
// the facts read off the date: who may book it, its price, when, where with its map, a run's
// distances, the places left, and what comes after the Saturday ride: breakfast at the stop staff set
// (2026-10-05). The texts are Experiences' own fields (content/pages/experiences.ts,
// events.*About and dates.about*), which the booking app reads too, so one edit in the Website editor
// changes both. Plain logic, so it can be tested: the page puts the words together
// (app/[locale]/experiences/page.tsx) and ExperienceSteps.tsx draws the links and the dialog.

/** The event cards only community members may book: the community rides and Run for Her (the
 *  booking app's _infoMembersOnlyEv); and Petromin Days, which only Petromin tag holders book. Victory
 *  Lap is booked by Community members and Victory Lap tag holders alone, yet its card, its About and its
 *  dates' Details are everyone's (the booking app's _infoShowSess, 2026-10-17). */
export const membersOnlyEvent = (key: string): boolean => key === "community" || key === "runher" || key === "petromin";

/** Whether the visitor counts as a member on a card, for its links: on Petromin Days a Petromin tag
 *  holder (the owner, 2026-10-12: its About and its dates' Details show to holders, as the booking
 *  app's _infoShowSess), on every other card a community member. An account holds one of the two
 *  tags, never both. */
export const memberOn = (key: string, v: { member: boolean; petromin: boolean }): boolean => (key === "petromin" ? v.petromin : v.member);

/** Whether a card or a date shows its link (the owner: "only show the i buttons in community events
 *  for community members only"): one anyone may book shows it to everyone, a members-only one to a
 *  signed-in community member alone. */
export const infoShown = (membersOnly: boolean, member: boolean): boolean => !membersOnly || member;

/** Whether a date's Details are for members alone: a members-only date, but never Victory Lap's, which
 *  everyone may read (only its price is held back, lib/vlap.ts). */
export const membersOnlyDate = (s: { members: boolean; kind: string }): boolean => s.members && s.kind !== "vlap";

/** The times a date's text is filled with, in the page's clock: a ride that gathers has its gathering
 *  and its start, any other its start and its end, and {collect} is when bikes go out. A time that
 *  does not apply is "", as in the booking app (_infoFill). */
export type InfoTimes = { gather: string; start: string; end: string; collect: string };
export function infoTimes(s: Pick<RideSession, "times" | "gather" | "collect">, clock: (hhmm: string) => string): InfoTimes {
  const at = (v: string | null | undefined) => (v ? clock(v) : "");
  const [a, b] = s.times ?? [null, null];
  return s.gather ? { gather: at(a), start: at(b), end: "", collect: at(s.collect) } : { gather: "", start: at(a), end: at(b), collect: at(s.collect) };
}

/** A text with {gather} {start} {end} and {collect} filled in; any other {name} stays as written. */
export const fillTimes = (text: string, t: InfoTimes): string => fill(text, t);

/** The Experiences texts a date's Details start with: the dates section's about* fields, and the
 *  events section's own for the National Day ride and the ticketed events. */
export type DateTexts = { aboutJcc: string; aboutSat: string; aboutPetro: string; aboutSwim: string; aboutWs: string; aboutRun: string; aboutVl: string; sndAbout: string; evAbout: string };

/** Which text a date's Details say (the booking app's INFO_DT): its kind's own, filled with its
 *  times, and the circuit's for any kind without one; a ticketed event says its own description
 *  instead, as staff wrote it, when it has one. */
export function dateText(s: Pick<RideSession, "kind" | "description">, texts: DateTexts, times: InfoTimes): string {
  if (s.kind === "event" && s.description) return s.description;
  const of: Partial<Record<RideKind, string>> = {
    jcc: texts.aboutJcc, saturday: texts.aboutSat, petromin: texts.aboutPetro, swim: texts.aboutSwim, workshop: texts.aboutWs,
    runher: texts.aboutRun, vlap: texts.aboutVl, snd96: texts.sndAbout, event: texts.evAbout,
  };
  return fillTimes(of[s.kind] ?? texts.aboutJcc, times);
}

/** Who may book a date (_infoFacts): everyone, or community members - aged 18 and over on Run for
 *  Her, with Petromin's team on a Petromin night (2026-10-12, infoWhoPetromin), and with the Victory Lap
 *  athletes, 16 and over, on Victory Lap (infoWhoVlap). */
export function infoWho(s: Pick<RideSession, "members" | "kind">, t: { all: string; members: string; members18: string; petromin: string; vlap: string }): string {
  if (!s.members) return t.all;
  return s.kind === "runher" ? t.members18 : s.kind === "petromin" ? t.petromin : s.kind === "vlap" ? t.vlap : t.members;
}

/** A kind of ride that hands out bikes, priced by the bike (the booking app's _needsBike): not the
 *  pool, the T100 day, a ticketed event, a run or Victory Lap. */
export const rentsBikes = (kind: RideKind): boolean => kind !== "swim" && kind !== "workshop" && kind !== "event" && kind !== "runher" && kind !== "vlap";

/** What a date costs (_sessFromPrice): the free word on a free ride, an event's price per seat, and
 *  on a paid ride with bikes the cheapest bike ("from SAR 57.5"); null when there is nothing to say.
 *  Victory Lap's price per athlete ("SAR 150 · per athlete, VAT included") is `athlete`, which the page
 *  gives only to a visitor who may book it (vlap_member; the owner, 2026-10-17), else null: nothing is
 *  said. `seat`, `from` and `athlete` arrive in the page's words. */
export function infoPrice(s: Pick<RideSession, "kind" | "free">, t: { free: string; seat: string | null; from: string | null; athlete?: string | null }): string | null {
  if (s.free) return t.free || null;
  if (s.kind === "event") return t.seat;
  if (s.kind === "vlap") return t.athlete ?? null;
  return rentsBikes(s.kind) ? t.from : null;
}

/** Victory Lap's races and divisions open to book (sessions.vl, all when unset), in the page's words:
 *  "Women's Singles · Men's Singles · ..." and "Sprint Open 4 km · ... · Elite 6.1 km" (the booking app's
 *  _infoFacts vlRacesLabel / vlDivsLabel rows); null on any other kind. */
export function infoVl(s: Pick<RideSession, "kind" | "vl">, t: { races: Record<VlRace, string>; divs: Record<VlDiv, string>; km: string }): { races: string; divs: string } | null {
  if (s.kind !== "vlap") return null;
  const c = vlConfig(s.vl);
  return {
    races: c.races.map((r) => t.races[r]).join(" · "),
    divs: c.divs.map((d) => `${t.divs[d]} ${fillAt(t.km, VL_DIV_KM[d])}`).join(" · "),
  };
}

/** Where a date is, by name (lib/tickets.ts venueOf: the meeting point on a ride staff approve that
 *  meets at a map link, the Jeddah Corniche Circuit when staff named no place or "JCC", the Jeddah
 *  Yacht Club for "JYC", else the place as staff wrote it), and its map: the meeting point's link on
 *  a ride that meets at one (meetsAt: a ride staff approve, or Run for Her), the circuit's directions
 *  on the circuit, else none. A session read without its place reads as on the circuit. */
export function infoPlace(s: Pick<RideSession, "kind" | "approval" | "location" | "meetUrl">, t: { meetingPoint: string; venueCircuit: string; venueJyc: string }, circuitMap: string): { name: string; map: string | null } {
  const approval = !!s.approval, meetUrl = s.meetUrl ?? null;
  const v = venueOf({ approval, meetUrl, location: s.location ?? null, kind: s.kind });
  let map: string | null = null;
  if (meetsAt({ approval, kind: s.kind }) && meetUrl) map = meetUrl;
  else if (v.kind === "circuit") map = circuitMap || null;
  return { name: venueText(v, t), map };
}

/** A run's distances, "3 km · 5 km" from the template "{0} km" (the booking app's RUN_KMS); null on
 *  anything but Run for Her. */
export const infoDistance = (kind: RideKind, km: string): string | null => (kind === "runher" ? RUN_KMS.map((n) => fillAt(km, n)).join(" · ") : null);

/** The places a date has (_infoFacts): never said on a ride staff approve (they choose who rides);
 *  the waitlist on a full date or one with none left; else how many are left, when they were counted
 *  (lib/rides.ts counts the soonest open dates), and nothing when they were not. */
export function infoPlaces(s: Pick<RideSession, "full" | "left" | "approval">, t: { waitlist: string; left1: string; leftN: string }): string | null {
  if (s.approval) return null;
  if (s.full) return t.waitlist;
  if (typeof s.left !== "number") return null;
  if (s.left <= 0) return t.waitlist;
  return fillAt(s.left === 1 ? t.left1 : t.leftN, s.left);
}

/** The breakfast stop on a date, by name (the owner, 2026-10-05: "add the restaurant's name in the
 *  session whenever it's added"): the Saturday ride's and Run for Her's (2026-10-14), as the page's language reads it - its Arabic
 *  name on the Arabic page when the venue gave one, else its name, as its ticket says it (lib/tickets.ts
 *  breakfastFor) - and null on any other ride, or one with no stop yet. The date's card and the
 *  summary say "Breakfast at {name}", and its Details end with it after the places, under "After"
 *  (the booking app's _infoFacts: infoAfter, infoBreakfastAt). */
export function infoBreakfast(s: Pick<RideSession, "kind" | "breakfast" | "breakfastAr">, locale: string): string | null {
  if (!hasBreakfast(s.kind) || !s.breakfast) return null;
  return (locale === "ar" && s.breakfastAr) || s.breakfast;
}

/** Which card each kind of date is booked under (the booking app's _evMatch): the circuit, the
 *  community rides, and the National Day ride, the T100 workshop, the ticketed events and Run for Her,
 *  which have cards of their own while they have dates. A Petromin night counts as a community ride
 *  here; Petromin Days takes its own (eventCards). */
export const EVENT_OF: Record<RideKind, string> = { jcc: "jcc", saturday: "community", swim: "community", petromin: "community", workshop: "workshop", snd96: "snd96", event: "event", runher: "runher", vlap: "vlap" };

/** The event cards in the order the page shows them, each with its texts' prefix in Experiences'
 *  events section and whether it shows with no date. Petromin Days first (the owner, 2026-10-12), then
 *  Victory Lap (2026-10-17) and Run for Her, as on the booking app's landing. */
export const EVENT_CARDS = [
  { key: "petromin", p: "pm", always: false }, { key: "vlap", p: "vl", always: false }, { key: "runher", p: "rh", always: false }, { key: "snd96", p: "snd", always: false },
  { key: "jcc", p: "jcc", always: true }, { key: "community", p: "comm", always: true }, { key: "workshop", p: "ws", always: false }, { key: "event", p: "ev", always: false },
] as const;
export type EventCard = (typeof EVENT_CARDS)[number];

/** The cards the visitor sees, in order, each with its dates (soonest first, as given). Petromin Days
 *  lists the Petromin nights alone, to a Petromin tag holder alone (the owner, 2026-10-12: "a new
 *  event card that has the name Petromin Days that only is visible for petromin tag holders"). The
 *  website's community card lists no Petromin nights, as before (community members book them in the
 *  booking app's MicroMobility Experiences), and nobody else sees them. */
export function eventCards<T extends Pick<RideSession, "kind">>(all: T[], v: { member: boolean; petromin: boolean }): { card: EventCard; sessions: T[] }[] {
  const of = (key: string) => (key === "petromin"
    ? all.filter((s) => v.petromin && s.kind === "petromin")
    : all.filter((s) => EVENT_OF[s.kind] === key && s.kind !== "petromin"));
  return EVENT_CARDS.map((card) => ({ card, sessions: of(card.key) })).filter((c) => c.card.always || c.sessions.length > 0);
}

/** The booking app opened on a card and one of its dates (?ev=<card>&session=<id>): Petromin Days
 *  hands over ev=petromin, which the booking app opens under its own Petromin Days. A link that is
 *  not a full address is used as it is. */
export function bookingAt(bookHref: string, ev: string, session: string): string {
  try {
    const u = new URL(bookHref);
    u.searchParams.set("ev", ev);
    u.searchParams.set("session", session);
    return u.toString();
  } catch {
    return bookHref;
  }
}
