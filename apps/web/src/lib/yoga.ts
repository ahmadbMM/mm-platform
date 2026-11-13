import { fill as fillAt } from "@/i18n/tx";

// Yoga (the user, 2026-11-12: "create a session under micromobility experiences, yoga for the community ... try to theme
// it in the best way possible"; rentals migration 20261112120000): ride_kind 'yoga', event_kind 'community', session id
// '<date>-yg'. The first is Hatha Yoga for Cyclists, with Jassim Alsaady, on Saturday 21 November 2026 from 4 to 5:30 PM at
// SILKDEER. A date inside MicroMobility Experiences (the community card), never a card of its own: members only, free, one
// place per account, first come first served and then the waitlist; no bike anywhere, so session and participant words;
// a start and an end, like the pool; the activity waiver.
// Its look is the booking app's "Sunset Hatha": hatha joins ha, the sun, and tha, the moon, and the session ends just
// before the sun sets over Jeddah. A sun setting on the horizon with a crescent moon above (public/site/yoga-mark.svg,
// the booking app's assets/yoga-mark.svg), warm sand, clay for the title and every action, sage for the moon, the name in
// Marcellus. Plain logic, so it can be tested (the booking app's _isYoga, _ygMins, _ygDurTxt).

/** The mark: a sun setting on the horizon, a crescent moon above it (64 by 40). */
export const YOGA_MARK = "/site/yoga-mark.svg";
export const YOGA_MARK_SIZE = { width: 64, height: 40 } as const;

/** A yoga date, by the session's kind. */
export const isYoga = (s: { kind?: string | null } | null | undefined): boolean => s?.kind === "yoga";

/** How long a yoga date runs, in minutes, from its own start and end ("16:00" to "17:30" is 90; the booking app's _ygMins):
 *  0 when it cannot be told (no times, a start alone, an end before the start). */
export function yogaMinutes(times: readonly [string, string] | null | undefined): number {
  if (!times) return 0;
  const m = (x: string) => {
    const r = /^(\d{1,2}):(\d{2})/.exec(x || "");
    return r ? Number(r[1]) * 60 + Number(r[2]) : null;
  };
  const a = m(times[0]), b = m(times[1]);
  return a !== null && b !== null && b > a ? b - a : 0;
}

/** "90 min" from the page's "{0} min" (the booking app's ygMin, _ygDurTxt), or "" when the length cannot be told. */
export const yogaLength = (times: readonly [string, string] | null | undefined, minWord: string): string => {
  const n = yogaMinutes(times);
  return n ? fillAt(minWord, n) : "";
};

/** What to know before arriving, as [label, value] rows (the booking app's _ygKnowHtml on the ticket, and _infoFacts in a
 *  date's Details with its length after who leads it): who leads it, the level, what to bring. */
export type YogaWords = { leadK: string; leadV: string; durK: string; levelK: string; levelV: string; bringK: string; bringV: string };
export function yogaKnow(w: YogaWords, length = ""): [string, string][] {
  return [[w.leadK, w.leadV], ...(length ? [[w.durK, length] as [string, string]] : []), [w.levelK, w.levelV], [w.bringK, w.bringV]];
}
