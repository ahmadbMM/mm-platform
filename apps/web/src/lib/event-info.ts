import { fill as fillAt } from "@/i18n/tx";
import { fill } from "./fill";
import type { RideKind, RideSession } from "./rides";
import { meetsAt, RUN_KMS, venueOf, venueText } from "./tickets";

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
 *  booking app's _infoMembersOnlyEv). */
export const membersOnlyEvent = (key: string): boolean => key === "community" || key === "runher";

/** Whether a card or a date shows its link (the owner: "only show the i buttons in community events
 *  for community members only"): one anyone may book shows it to everyone, a members-only one to a
 *  signed-in community member alone. */
export const infoShown = (membersOnly: boolean, member: boolean): boolean => !membersOnly || member;

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
export type DateTexts = { aboutJcc: string; aboutSat: string; aboutSwim: string; aboutWs: string; aboutRun: string; sndAbout: string; evAbout: string };

/** Which text a date's Details say (the booking app's INFO_DT): its kind's own, filled with its
 *  times, and the circuit's for any kind without one; a ticketed event says its own description
 *  instead, as staff wrote it, when it has one. */
export function dateText(s: Pick<RideSession, "kind" | "description">, texts: DateTexts, times: InfoTimes): string {
  if (s.kind === "event" && s.description) return s.description;
  const of: Partial<Record<RideKind, string>> = {
    jcc: texts.aboutJcc, saturday: texts.aboutSat, swim: texts.aboutSwim, workshop: texts.aboutWs,
    runher: texts.aboutRun, snd96: texts.sndAbout, event: texts.evAbout,
  };
  return fillTimes(of[s.kind] ?? texts.aboutJcc, times);
}

/** Who may book a date (_infoFacts): everyone, or community members - aged 18 and over on Run for Her. */
export function infoWho(s: Pick<RideSession, "members" | "kind">, t: { all: string; members: string; members18: string }): string {
  if (!s.members) return t.all;
  return s.kind === "runher" ? t.members18 : t.members;
}

/** A kind of ride that hands out bikes, priced by the bike (the booking app's _needsBike): not the
 *  pool, the T100 day, a ticketed event or a run. */
export const rentsBikes = (kind: RideKind): boolean => kind !== "swim" && kind !== "workshop" && kind !== "event" && kind !== "runher";

/** What a date costs (_sessFromPrice): the free word on a free ride, an event's price per seat, and
 *  on a paid ride with bikes the cheapest bike ("from SAR 57.5"); null when there is nothing to say.
 *  `seat` and `from` arrive in the page's words. */
export function infoPrice(s: Pick<RideSession, "kind" | "free">, t: { free: string; seat: string | null; from: string | null }): string | null {
  if (s.free) return t.free || null;
  if (s.kind === "event") return t.seat;
  return rentsBikes(s.kind) ? t.from : null;
}

/** Where a date is, by name (lib/tickets.ts venueOf: the meeting point on a ride staff approve that
 *  meets at a map link, the Jeddah Corniche Circuit when staff named no place or "JCC", the Jeddah
 *  Yacht Club for "JYC", else the place as staff wrote it), and its map: the meeting point's link on
 *  a ride that meets at one (meetsAt: a ride staff approve, or Run for Her), the circuit's directions
 *  on the circuit, else none. A session read without its place reads as on the circuit. */
export function infoPlace(s: Pick<RideSession, "kind" | "approval" | "location" | "meetUrl">, t: { meetingPoint: string; venueCircuit: string; venueJyc: string }, circuitMap: string): { name: string; map: string | null } {
  const approval = !!s.approval, meetUrl = s.meetUrl ?? null;
  const v = venueOf({ approval, meetUrl, location: s.location ?? null });
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
 *  session whenever it's added"): the Saturday ride's, as the page's language reads it - its Arabic
 *  name on the Arabic page when the venue gave one, else its name, as its ticket says it (lib/tickets.ts
 *  breakfastFor) - and null on any other ride, or one with no stop yet. The date's card and the
 *  summary say "Breakfast at {name}", and its Details end with it after the places, under "After"
 *  (the booking app's _infoFacts: infoAfter, infoBreakfastAt). */
export function infoBreakfast(s: Pick<RideSession, "kind" | "breakfast" | "breakfastAr">, locale: string): string | null {
  if (s.kind !== "saturday" || !s.breakfast) return null;
  return (locale === "ar" && s.breakfastAr) || s.breakfast;
}
