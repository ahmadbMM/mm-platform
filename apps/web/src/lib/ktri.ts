import { fill } from "@/i18n/tx";
import { ENTRY_ID } from "./rating";

// The KAUST Triathlon (the user, 2026-11-22: "create a new featured session that shows for everyone but non community
// members gets sent to the registration link directly and for our members put the registration link as the last step
// needed to complete booking the same way we did before"; rentals migration 20261122150000): ride_kind 'ktri', event_kind
// 'community', session id '<date>-kt'. The first is on Friday 4 December 2026 at KAUST Urban Beach (report 6 AM; Olympic
// 6:30, Sprint 7:30, Future Champs 9:00). The race itself is Coastline Recreation's, entered and paid on its own
// registration website (KTRI_REG_URL). A date inside MicroMobility Experiences (the community card), never a card of its
// own, featured as made and shown to every visitor: a community member books a free place in the MicroMobility group in
// the booking app (which asks which race, queue_entries.tri_race), anyone else, signed in or not, is sent to the race's
// registration website instead of the members' note. No bike anywhere, so session and participant words; the activity
// waiver; one place per account. After booking, and on every visit until Yes, the DEFE run's pop-up asks "Have you
// registered through the KAUST Triathlon registration website?" (queue_entries.race_reg; lib/race-reg.ts).
// Its look is the booking app's "Red Sea Dawn", from the race's poster: a sky going pale to white, two sea swells along
// the foot, the sun rising over the water (public/site/ktri-mark.svg, the booking app's assets/ktri-mark.svg), KAUST in
// a heavy blue (Rubik 900) and Triathlon in navy, "SWIM · BIKE · RUN" between two thin blue rules. Plain logic, so it can
// be tested (the booking app's _isKtri, KTRI_RACES, _ktRace, _ktRaceDist, _ktTitleHtml).

/** Where the race itself is entered and paid (the booking app's KTRI_REG_URL, word for word). */
export const KTRI_REG_URL = "https://rec.coastline-fm.com/events/kaust-triathlon-2026/register";
/** The mark: the sun rising over two sea swells (64 by 40). */
export const KTRI_MARK = "/site/ktri-mark.svg";
export const KTRI_MARK_SIZE = { width: 64, height: 40 } as const;
/** When everyone reports at the beach (the booking app's KTRI_REPORT). */
export const KTRI_REPORT = "06:00";
/** Where it is when staff named no place (the booking app's _sessLoc). */
export const KTRI_VENUE = "KAUST Urban Beach";

/** A KAUST Triathlon date, by the session's kind. */
export const isKtri = (s: { kind?: string | null } | null | undefined): boolean => s?.kind === "ktri";

/** The races a member picks from (the booking app's KTRI_RACES, the organiser's own figures): its key, when it starts, its
 *  entry fee in SAR on the organiser's site, and whom that fee is for (one athlete, a relay team, a child). */
export type TriRace = "oly" | "spr" | "oly_team" | "spr_team" | "champs";
export type TriFee = "ind" | "team" | "kid";
export const KTRI_RACES: readonly { key: TriRace; start: string; fee: number; per: TriFee }[] = [
  { key: "oly", start: "06:30", fee: 250, per: "ind" },
  { key: "spr", start: "07:30", fee: 250, per: "ind" },
  { key: "oly_team", start: "06:30", fee: 600, per: "team" },
  { key: "spr_team", start: "07:30", fee: 600, per: "team" },
  { key: "champs", start: "09:00", fee: 30, per: "kid" },
];
export const TRI_RACES: readonly TriRace[] = KTRI_RACES.map((r) => r.key);

/** A race as stored (queue_entries.tri_race), read safely: one of the five, else null. */
export const triRaceOf = (v: unknown): TriRace | null => (typeof v === "string" && (TRI_RACES as readonly string[]).includes(v) ? (v as TriRace) : null);
/** A race's own row, or null. */
export const triRace = (k: unknown) => KTRI_RACES.find((r) => r.key === k) ?? null;

/** Which distances a race says (the booking app's _ktRaceDist): a relay team swims, rides and runs its race's. */
export function triDistKey(k: TriRace): "oly" | "spr" | "champs" {
  return k === "oly" || k === "oly_team" ? "oly" : k === "spr" || k === "spr_team" ? "spr" : "champs";
}

/** The races' words in the page's language (the booking app's ktOly, ktSpr, ktOlyTeam, ktSprTeam, ktChamps, ktOlyD, ktSprD,
 *  ktChampsD, ktStarts, ktFeeInd, ktFeeTeam, ktFeeKid). */
export type KtriRaceWords = {
  ktOly: string; ktSpr: string; ktOlyTeam: string; ktSprTeam: string; ktChamps: string;
  ktOlyD: string; ktSprD: string; ktChampsD: string; ktStarts: string; ktFeeInd: string; ktFeeTeam: string; ktFeeKid: string;
};
/** One race as a page offers it: its name, distances, "Starts 6:30 AM" and "Race entry SAR 250 per team". */
export type KtriRaceOpt = { key: TriRace; name: string; dist: string; start: string; fee: string };
/** The five races in the page's words (the booking app's _ktRaceOptsHtml), `clock` writing a time and `money` an amount. */
export function ktriRaceOpts(w: KtriRaceWords, clock: (hhmm: string) => string, money: (n: number) => string): KtriRaceOpt[] {
  const name: Record<TriRace, string> = { oly: w.ktOly, spr: w.ktSpr, oly_team: w.ktOlyTeam, spr_team: w.ktSprTeam, champs: w.ktChamps };
  const dist = { oly: w.ktOlyD, spr: w.ktSprD, champs: w.ktChampsD };
  const fee: Record<TriFee, string> = { ind: w.ktFeeInd, team: w.ktFeeTeam, kid: w.ktFeeKid };
  return KTRI_RACES.map((r) => ({ key: r.key, name: name[r.key], dist: dist[triDistKey(r.key)], start: fill(w.ktStarts, clock(r.start)), fee: fill(fee[r.per], money(r.fee)) }));
}

/** The race a ticket posts, read safely: {entryId, race} with a booking id and one of the five, else null. */
export function triRaceBody(body: unknown): { entryId: string; race: TriRace } | null {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!b || typeof b.entryId !== "string" || !ENTRY_ID.test(b.entryId)) return null;
  const race = triRaceOf(b.race);
  return race ? { entryId: b.entryId, race } : null;
}

/** The name as the poster sets it (the booking app's _ktTitleHtml): "KAUST" heavy and blue, the rest after it; a title
 *  staff changed so that it no longer starts with KAUST is said as written (`k` null). */
export function ktriTitle(name: string): { k: string | null; rest: string } {
  const m = /^KAUST\s+(.+)$/.exec(name.trim());
  return m ? { k: "KAUST", rest: m[1] } : { k: null, rest: name };
}

/** Whether a visitor is sent to the race's registration website in place of booking (the booking app's _ktGate): anyone
 *  who is not a signed-in community member. */
export const ktriOut = (member: boolean): boolean => !member;
