import { fill as fillAt } from "@/i18n/tx";
import { fill } from "./fill";
import { oneTime, type RideKind, type RideSession } from "./rides";
import { hasBreakfast, meetsAt, RUN_KMS, venueOf, venueText } from "./tickets";
import { VL_DIV_KM, vlConfig, type VlDiv, type VlRace } from "./vlap";
import { ahConfig, type AhDiv, type AhRace } from "./arena";

// "About this event" and "Details" on Experiences (the owner, 2026-10-05), as the booking app's event
// picker has them (_infoAboutBtn, _infoDetailsBtn, _infoFacts): under each event card a link opens
// what the event is, and under each date's time another opens what that date is - a short text, then
// the facts read off the date: who may book it, its price, when, where with its map, a run's
// distances, the places left, and what comes after the Saturday ride: breakfast at the stop staff set
// (2026-10-05). The texts are Experiences' own fields (content/pages/experiences.ts,
// events.*About and dates.about*), which the booking app reads too, so one edit in the Website editor
// changes both. Plain logic, so it can be tested: the page puts the words together
// (app/[locale]/experiences/page.tsx) and ExperienceSteps.tsx draws the links and the dialog.

/** The event cards only community members may book: the community rides and Run for Her (the booking app's
 *  _infoMembersOnlyEv; Arena Heros is everyone's since 2026-11-02); and
 *  Petromin Days, which only Petromin tag holders book. Victory Lap is booked by Community members and Victory
 *  Lap tag holders alone, yet its card, its About and its dates' Details are everyone's (the booking app's
 *  _infoShowSess, 2026-10-17). */
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
  // a session with a start time alone (the DEFE 5KM Run's "19:00") has no end, as the booking app's _infoFill reads it
  if (oneTime(s.times)) return { gather: "", start: at(a), end: "", collect: at(s.collect) };
  return s.gather ? { gather: at(a), start: at(b), end: "", collect: at(s.collect) } : { gather: "", start: at(a), end: at(b), collect: at(s.collect) };
}

/** A text with {gather} {start} {end} and {collect} filled in; any other {name} stays as written. */
export const fillTimes = (text: string, t: InfoTimes): string => fill(text, t);

/** The Experiences texts a date's Details start with: the dates section's about* fields, and the
 *  events section's own for the National Day ride and the ticketed events. */
export type DateTexts = { aboutJcc: string; aboutSat: string; aboutPetro: string; aboutSwim: string; aboutWs: string; aboutRun: string; aboutVl: string; aboutDefe: string; aboutAr: string; aboutYoga: string; aboutFarm: string; sndAbout: string; evAbout: string };

/** Which text a date's Details say (the booking app's INFO_DT): its kind's own, filled with its
 *  times, and the circuit's for any kind without one; a ticketed event says its own description
 *  instead, as staff wrote it, when it has one. The Blood Donation event's Details are its poster, no text. */
export function dateText(s: Pick<RideSession, "kind" | "description">, texts: DateTexts, times: InfoTimes): string {
  if (s.kind === "event" && s.description) return s.description;
  const of: Partial<Record<RideKind, string>> = {
    jcc: texts.aboutJcc, saturday: texts.aboutSat, petromin: texts.aboutPetro, swim: texts.aboutSwim, workshop: texts.aboutWs,
    runher: texts.aboutRun, vlap: texts.aboutVl, defe5k: texts.aboutDefe, arena: texts.aboutAr, yoga: texts.aboutYoga, farm: texts.aboutFarm, snd96: texts.sndAbout, event: texts.evAbout, blood: "",
  };
  return fillTimes(of[s.kind] ?? texts.aboutJcc, times);
}

/** Who may book a date (_infoFacts): everyone, or community members - aged 18 and over on Run for
 *  Her, with Petromin's team on a Petromin night (2026-10-12, infoWhoPetromin), with the Victory Lap
 *  athletes, 16 and over, on Victory Lap (infoWhoVlap), in teams of two on Arena Heros (infoWhoArena), and with their
 *  families on the Farm House Night (fhWho, 2026-11-13). */
export function infoWho(s: Pick<RideSession, "members" | "kind">, t: { all: string; members: string; members18: string; petromin: string; vlap: string; arena?: string; arenaAll?: string; farm?: string }): string {
  if (!s.members) return s.kind === "arena" && t.arenaAll ? t.arenaAll : t.all;
  return s.kind === "runher" ? t.members18 : s.kind === "petromin" ? t.petromin : s.kind === "vlap" ? t.vlap : s.kind === "arena" ? t.arena || t.members : s.kind === "farm" ? t.farm || t.members : t.members;
}

/** A kind of ride that hands out bikes, priced by the bike (the booking app's _needsBike): not the
 *  pool, the T100 day, a ticketed event, a run (Run for Her, the DEFE 5KM Run), Victory Lap, Arena Heros, the
 *  Blood Donation event, yoga or the Farm House Night. */
export const rentsBikes = (kind: RideKind): boolean => kind !== "swim" && kind !== "workshop" && kind !== "event" && kind !== "runher" && kind !== "vlap" && kind !== "defe5k" && kind !== "arena" && kind !== "blood" && kind !== "yoga" && kind !== "farm";

/** What a date costs (_sessFromPrice): the free word on a free ride, an event's price per seat, and
 *  on a paid ride with bikes the cheapest bike ("from SAR 57.5"); null when there is nothing to say.
 *  Victory Lap's price per athlete ("SAR 150 · per athlete, VAT included") is `athlete`, which the page
 *  gives only to a visitor who may book it (vlap_member; the owner, 2026-10-17), else null: nothing is
 *  said; so is Arena Heros' ("SAR 140 · per athlete, medals included"), to a community member alone.
 *  `seat`, `from` and `athlete` arrive in the page's words. The Blood Donation event never mentions a price, not
 *  even the free word (the booking app's _sessFromPrice, 2026-11-03). */
export function infoPrice(s: Pick<RideSession, "kind" | "free">, t: { free: string; seat: string | null; from: string | null; athlete?: string | null }): string | null {
  if (s.kind === "blood") return null;
  if (s.free) return t.free || null;
  if (s.kind === "event") return t.seat;
  if (s.kind === "vlap" || s.kind === "arena") return t.athlete ?? null;
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

/** Arena Heros' races, divisions and what each division asks (sessions.vl, every one when unset), in the page's
 *  words: "Women’s Doubles · Men’s Doubles", "Open · Elite", and each division's level and the organisers' guide
 *  to it (the booking app's arLvl_*, arGuide_*); null on any other kind. */
export type AhGuide = { name: string; level: string; text: string };
export function infoArena(s: Pick<RideSession, "kind" | "vl">, t: { races: Record<AhRace, string>; divs: Record<AhDiv, string>; guide: Record<AhDiv, { level: string; text: string }> }): { races: string; divs: string; guide: AhGuide[] } | null {
  if (s.kind !== "arena") return null;
  const c = ahConfig(s.vl);
  return { races: c.races.map((r) => t.races[r]).join(" · "), divs: c.divs.map((d) => t.divs[d]).join(" · "), guide: c.divs.map((d) => ({ name: t.divs[d], ...t.guide[d] })) };
}

/** Where a date is, by name (lib/tickets.ts venueOf: the meeting point on a ride staff approve that
 *  meets at a map link, the Jeddah Corniche Circuit when staff named no place or "JCC", the Jeddah
 *  Yacht Club for "JYC", Arena Heros' venue, else the place as staff wrote it), and its map: the meeting
 *  point's link on a ride that meets at one (meetsAt: a ride staff approve, or Run for Her), Arena Heros'
 *  and the Blood Donation event's own link (sessions.meet_url), the circuit's directions on the circuit, else
 *  none. A session read without its place reads as on the circuit, Arena Heros' as at its venue. Yoga (2026-11-12) is at
 *  the place staff named (SILKDEER) with that place's map (sessions.meet_url); one with a map and no place's name is
 *  at its meeting point (lib/tickets.ts venueOf), never the circuit. The Farm House Night (2026-11-13), a ride staff
 *  approve, opens its map link as every such ride does, and is named by the place staff wrote (Little Farmhouse,
 *  Dhahban), never "Meeting point" (lib/tickets.ts venueOf). */
export function infoPlace(s: Pick<RideSession, "kind" | "approval" | "location" | "meetUrl">, t: { meetingPoint: string; venueCircuit: string; venueJyc: string; venueGymnation?: string }, circuitMap: string): { name: string; map: string | null } {
  const approval = !!s.approval, meetUrl = s.meetUrl ?? null;
  const v = venueOf({ approval, meetUrl, location: s.location ?? null, kind: s.kind });
  let map: string | null = null;
  if ((meetsAt({ approval, kind: s.kind }) || s.kind === "arena" || s.kind === "blood" || s.kind === "yoga") && meetUrl) map = meetUrl;
  else if (v.kind === "circuit") map = circuitMap || null;
  return { name: venueText(v, t), map };
}

/** A run's distances, "3 km · 5 km" from the template "{0} km" (the booking app's RUN_KMS); the DEFE
 *  5KM Run's one, "5 km" (2026-10-18); null on anything else. */
export const infoDistance = (kind: RideKind, km: string): string | null =>
  (kind === "runher" ? RUN_KMS.map((n) => fillAt(km, n)).join(" · ") : kind === "defe5k" ? fillAt(km, 5) : null);

/** The places a date has (_infoFacts): Fully booked on one closed as Full, no waitlist (`t.fbk`, approval ride or not, as
 *  the booking app says it, 2026-11-13); never said on a ride staff approve (they choose who rides);
 *  the waitlist on a full date or one with none left; else how many are left, when they were counted
 *  (lib/rides.ts counts the soonest open dates), and nothing when they were not. */
export function infoPlaces(s: Pick<RideSession, "full" | "left" | "approval" | "fbk"> & { kind?: RideKind }, t: { waitlist: string; left1: string; leftN: string; fbk?: string }): string | null {
  if (s.fbk && t.fbk) return t.fbk;
  if (s.approval) return null;
  if (s.full) return t.waitlist;
  if (typeof s.left !== "number") return null;
  // Victory Lap never says how many places are left, only the waitlist once it is full (the owner, 2026-10-17);
  // nor Arena Heros, whose places are an athlete's each while a team books two, nor the Blood Donation event, which
  // has no real cap (the owner, 2026-11-03)
  if (s.kind === "vlap" || s.kind === "arena" || s.kind === "blood") return s.left <= 0 ? t.waitlist : null;
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
 *  community rides, and the National Day ride, the T100 workshop, the ticketed events, Run for Her,
 *  Victory Lap, Arena Heros (ev=arena) and the Blood Donation event (ev=blood), which have cards of their own while they have dates. A Petromin night counts as a community ride
 *  here; Petromin Days takes its own (eventCards). The DEFE 5KM Run (2026-10-18), yoga (2026-11-12) and the Farm House
 *  Night (2026-11-13) are dates inside MicroMobility Experiences, the community card, never cards of their own. */
export const EVENT_OF: Record<RideKind, string> = { jcc: "jcc", saturday: "community", swim: "community", petromin: "community", workshop: "workshop", snd96: "snd96", event: "event", runher: "runher", vlap: "vlap", defe5k: "community", arena: "arena", blood: "blood", yoga: "community", farm: "community" };

/** The event cards in the order the page shows them, each with its texts' prefix in Experiences'
 *  events section and whether it shows with no date. MicroMobility Experiences, the community card, leads (the owner's
 *  pick Q3 a on the booking app's theming page, 2026-11-13: the weekly ride most people come for, one-off events after
 *  it); then Petromin Days (the owner, 2026-10-12), the Blood Donation event (2026-11-03), Victory Lap (2026-10-17),
 *  Arena Heros (2026-10-28) and Run for Her, as on the booking app's landing. The Blood Donation event's texts are no
 *  fields of that section: its words are the server's (content/blood-words.ts), and the page gives its card them only
 *  when it has a date. */
export const EVENT_CARDS = [
  { key: "community", p: "comm", always: true },
  { key: "petromin", p: "pm", always: false }, { key: "blood", p: "bld", always: false }, { key: "vlap", p: "vl", always: false }, { key: "arena", p: "ar", always: false }, { key: "runher", p: "rh", always: false }, { key: "snd96", p: "snd", always: false },
  { key: "jcc", p: "jcc", always: true }, { key: "workshop", p: "ws", always: false }, { key: "event", p: "ev", always: false },
] as const;
export type EventCard = (typeof EVENT_CARDS)[number];

/** The cards the visitor sees, in order, each with its dates (soonest first, as given). A Farm House Night is a community
 *  date a signed-in community member alone sees (lib/farm.ts farmForMembers, 2026-11-13). Petromin Days
 *  lists the Petromin nights alone, to a Petromin tag holder alone (the owner, 2026-10-12: "a new
 *  event card that has the name Petromin Days that only is visible for petromin tag holders"). The
 *  website's community card lists no Petromin nights, as before (community members book them in the
 *  booking app's MicroMobility Experiences), and nobody else sees them. A card that shows only while it has dates needs
 *  one that may be booked (the booking app's _runHerLive, _vlLive and the like read the live sessions alone): a date
 *  closed as Full, no waitlist (lib/rides.ts fbkOf) is listed under a card that shows, and never brings one back. */
export function eventCards<T extends Pick<RideSession, "kind" | "fbk">>(all: T[], v: { member: boolean; petromin: boolean }): { card: EventCard; sessions: T[] }[] {
  const of = (key: string) => (key === "petromin"
    ? all.filter((s) => v.petromin && s.kind === "petromin")
    : all.filter((s) => EVENT_OF[s.kind] === key && s.kind !== "petromin" && (s.kind !== "farm" || v.member)));
  return EVENT_CARDS.map((card) => ({ card, sessions: of(card.key) })).filter((c) => c.card.always || c.sessions.some((s) => !s.fbk));
}

/** The first date of a list that may be booked, never one closed as Full, no waitlist (the booking app's _infoNextOf and
 *  _vlSoon read the live sessions alone): an event's About says it as the next date, and Victory Lap's, Arena Heros' and
 *  the Blood Donation event's cards say its day. */
export const nextOpen = <T extends { fbk?: unknown }>(sessions: readonly T[]): T | undefined => sessions.find((s) => !s.fbk);

/** How many Featured cards the event step shows (the booking app's FEAT_LAND_MAX). */
export const FEATURED_MAX = 4;

/** The event step's Featured cards (the booking app's _featLand, 2026-11-13): the featured dates among those the
 *  visitor's cards list, soonest first, four at most, each with the card it is booked under. It is given the cards as
 *  the page shows them (eventCards, cut to the dates each lists), so a card stands only for a date the visitor would
 *  find in its event's list: a community date to everyone, a Petromin night to a Petromin tag holder. */
export function featuredDates<T extends Pick<RideSession, "id" | "date" | "times" | "featured">>(cards: { card: { key: string }; sessions: T[] }[], max: number = FEATURED_MAX): { ev: string; id: string }[] {
  return cards.flatMap(({ card, sessions }) => sessions.filter((s) => s.featured).map((s) => ({ ev: card.key, s })))
    .sort((a, b) => a.s.date.localeCompare(b.s.date) || (a.s.times?.[0] ?? "").localeCompare(b.s.times?.[0] ?? ""))
    .slice(0, Math.max(0, max))
    .map(({ ev, s }) => ({ ev, id: s.id }));
}

/** A list of dates with the featured ones first (the booking app's renderRegister, 2026-11-13): `featured` lead it
 *  under "Featured", `rest` follow under "Upcoming", each in the order given and every date once. With nothing
 *  featured the list is as it was: no `featured`, and `rest` is the list itself. */
export function featuredFirst<T>(sessions: T[], featured: (s: T) => boolean): { featured: T[]; rest: T[] } {
  const lead = sessions.filter(featured);
  return { featured: lead, rest: lead.length ? sessions.filter((s) => !featured(s)) : sessions };
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
