import { vlDivName, vlWords, type VlWords } from "./vlap";

// Arena Heros Hybrid Race (the owner, 2026-10-28: "create a session for this event and make it exclusive for
// community members"; rentals migration 20261028200000_arena_race): a hybrid fitness race at Gymnation, Tahlia
// Street on Friday 6 November 2026, 06:00 to 20:00 with a prayer break, booked in the booking app (ride_kind
// 'arena', event_kind 'community', session id '<date>-ah', a paid ride at the session's own price: 140 SAR per
// athlete, medals included; how to pay is announced later). Only Community members may book it (the members'
// own check, community_member, as on Run for Her), and only they are told the price. Teams of 2 only, 2 women or
// 2 men: each partner books their own place and the two are joined by a team code (AH-XXXX), as Victory Lap's
// Doubles are. Two divisions, Open and Elite; 7 stations; the organiser assigns each team its heat time. Every
// athlete agrees that their details go to the race's organisers, WeSportify, Mile and Gymnation (lib/share.ts).
// No badge, no wallet pass and no ticket question. The plain rules, so they can be tested; the database holds
// every rule that matters.

/** The two races: a team of 2 women ('wd') or of 2 men ('md'), Victory Lap's Doubles codes, named in its words. */
export const AH_RACES = ["wd", "md"] as const;
export type AhRace = (typeof AH_RACES)[number];
/** The organiser's two divisions: Open (intermediate, reduced loads, distances or volume) and Elite (advanced,
 *  highly trained, the full prescribed loads, distances and volume). */
export const AH_DIVS = ["op", "el"] as const;
export type AhDiv = (typeof AH_DIVS)[number];
/** Where the race is (sessions.location, the booking app's AR_LOC), and where it is when staff named no place:
 *  never the circuit. The venue is named in the page's language (lib/tickets.ts venueText, the booking app's
 *  venueGymnation). */
export const AH_VENUE = "Gymnation, Tahlia Street";
/** The organisers' race details (the owner, 2026-10-28; the booking app's AR_INFO_URL). */
export const AH_INFO_URL = "https://www.instagram.com/p/Dd1Lc87CJrq/";
/** An Arena Heros session id, as the booking app makes it ('2026-11-06-ah'): its places' details are read by it. */
export const isArenaId = (id: string | null | undefined): boolean => /^\d{4}-\d\d-\d\d-ah(-|$)/.test(id ?? "");

/** A division's name: the organiser's own, kept in English in every language but Arabic, as Victory Lap's
 *  Open and Elite are (lib/vlap.ts vlDivName). */
export const ahDivName = (d: AhDiv, locale: string): string => vlDivName(d, locale);

const has = <T extends string>(all: readonly T[], v: unknown): v is T => typeof v === "string" && (all as readonly string[]).includes(v);
const obj = (v: unknown): Record<string, unknown> | null => {
  let o = v;
  if (typeof o === "string") { try { o = JSON.parse(o); } catch { return null; } }
  return o && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, unknown>) : null;
};
const words = (v: unknown): VlWords => {
  const o = obj(v);
  return o ? Object.fromEntries(Object.entries(o).filter((e): e is [string, string] => typeof e[1] === "string")) : {};
};

/** An athlete's place (queue_entries.vl on an Arena Heros booking): the race, the division, the team's code,
 *  and whether they asked our team for a partner (only while they have no code). */
export type AhEntry = { race: AhRace | null; div: AhDiv | null; team: string | null; pair: boolean };

/** queue_entries.vl as the ticket reads it: an object (or its JSON text), else null. A value the booking app
 *  would not take reads as none. */
export function ahEntry(v: unknown): AhEntry | null {
  const o = obj(v);
  if (!o) return null;
  const team = typeof o.team === "string" && /^AH-[A-Z0-9]{1,12}$/.test(o.team.trim().toUpperCase()) ? o.team.trim().toUpperCase() : null;
  return {
    race: has(AH_RACES, o.race) ? o.race : null,
    div: has(AH_DIVS, o.div) ? o.div : null,
    team,
    pair: !team && (o.pair === true || o.pair === "true"),
  };
}

/** The race's settings (sessions.vl, the same shape as Victory Lap's): the races and divisions open to book (all
 *  when unset), whether an athlete may ask for a partner, and staff's own words for how to pay and for what goes
 *  to the organisers, when they set them. */
export type AhConfig = { races: AhRace[]; divs: AhDiv[]; pair: boolean; pay: VlWords; share: VlWords };
export function ahConfig(v: unknown): AhConfig {
  const o = obj(v) ?? {};
  const pick = <T extends string>(a: unknown, all: readonly T[]): T[] => (Array.isArray(a) ? all.filter((x) => a.includes(x)) : [...all]);
  return { races: pick(o.races, AH_RACES), divs: pick(o.divs, AH_DIVS), pair: o.pair !== false, pay: words(o.pay), share: words(o.share) };
}

/** How to pay: staff's words (sessions.vl.pay) in the reader's language, else the page's own `fallback`
 *  ("How to pay will be announced."). */
export const ahPayLine = (cfg: Pick<AhConfig, "pay"> | null | undefined, locale: string, fallback: string): string => vlWords(cfg?.pay, locale) || fallback;
