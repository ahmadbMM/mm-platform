import type { L } from "@/i18n/tx";

// Men only, women only or mixed (the owner, 2026-10-27: "i want the triathlon pool sessions to be for male only or
// female only or mixed and to be mentioned on the card and event everywhere and only allow the gender selected to
// book it and make it visible only for the gender it is for"), as the booking app's _sessGender, _sgTxt, _sgOk,
// _sgErr and _sgErrOf have it. sessions.gender_only is 'male', 'female' or null (mixed; rentals migration
// 20261027150000). The visibility half was taken back the next day: every visitor sees every such session, signed
// in or not, of either gender, as they see a mixed one (the owner, 2026-10-28: "make all pool sessions visible to
// all genders but only male can book male sessions and female can book female sessions"; rentals 20261028100000:
// list_sessions and the table's own read give it to everyone). Only booking it is held to that gender: the database
// refuses anyone else's booking with GENDER_ONLY (its detail: the gender the session is for). The site says the rule
// wherever it shows the session, with the chip the booking app's .sg-chip draws (components/site/site.css), and
// tells a signed-in account of the other gender (or with none on file) so in place of the button that hands the
// booking over. Plain logic, so it can be tested.

export type SessionGender = "male" | "female";

/** sessions.gender_only as the site reads it: 'male' or 'female'; anything else (null, a value it does not know) is mixed. */
export const sessionGender = (v: unknown): SessionGender | null => (v === "male" || v === "female" ? v : null);

/** The kinds staff give the choice on (the booking app's SG_KINDS): the pool. Only they say "Mixed" when open to both. */
export const SG_KINDS: ReadonlySet<string> = new Set(["swim"]);

/** The chip's words, and the refusal's, in the page's language. */
export type GenderText = { male: string; female: string; mixed: string; noMale: string; noFemale: string };

/** The words in the page's language (the booking app's sgMale, sgFemale, sgMixed, errSgMale and errSgFemale). */
export const genderText = (tx: L): GenderText => ({
  male: tx("Men only", "للرجال فقط"),
  female: tx("Women only", "للنساء فقط"),
  mixed: tx("Mixed", "مختلط"),
  noMale: tx("This session is for men only.", "هذه الفعالية للرجال فقط."),
  noFemale: tx("This session is for women only.", "هذه الفعالية للنساء فقط."),
});

/** A session's chip (_sgChip): its class (sg-male, sg-female, sg-mixed) and words. */
export type GenderChip = { cls: SessionGender | "mixed"; label: string };

/** What a session's chip says (_sgTxt): "Men only" or "Women only" on a session for one gender, of any kind; "Mixed"
 *  on a pool session open to both; null (no chip) on any other session. */
export function genderChip(s: { kind?: string | null; gender?: SessionGender | null }, w: Pick<GenderText, "male" | "female" | "mixed">): GenderChip | null {
  const g = s.gender ?? null;
  if (g) return { cls: g, label: g === "male" ? w.male : w.female };
  return s.kind && SG_KINDS.has(s.kind) ? { cls: "mixed", label: w.mixed } : null;
}

/** Whether an account of `gender` may book the session (_sgOk): a mixed one, or one for its own gender. An account
 *  with no gender on file books mixed sessions alone, as the database's guard refuses it the others. */
export const genderOk = (s: { gender?: SessionGender | null }, gender: SessionGender | null): boolean => !s.gender || s.gender === gender;

/** The refusal for anyone else (_sgErr): "This session is for women only." */
export const genderRefusal = (g: SessionGender, w: Pick<GenderText, "noMale" | "noFemale">): string => (g === "male" ? w.noMale : w.noFemale);

/** The database's refusal (GENDER_ONLY from _gender_entry_guard, its detail the gender the session is for) in words
 *  (_sgErrOf), or "" for any other error. Reads PostgREST's {code, message, details} and the site's own shape alike. */
export function genderErrorOf(err: unknown, w: Pick<GenderText, "noMale" | "noFemale">): string {
  const e = err && typeof err === "object" ? (err as Record<string, unknown>) : {};
  const S = (v: unknown) => (typeof v === "string" ? v : "");
  const detail = S(e.details) || S(e.detail);
  if (!/GENDER_ONLY/.test(`${S(e.code)} ${S(e.message)} ${detail}`)) return "";
  // \bmale\b never matches "female"
  return genderRefusal(/\bmale\b/.test(detail) ? "male" : "female", w);
}

/** Who is looking: the signed-in account's gender (customer_profile; null when none is on file). Null: not signed in. */
export type GenderViewer = { gender: SessionGender | null } | null;

/** What a visitor reads in place of the button that hands the booking over (the owner, 2026-10-28): "This session is
 *  for women only." to a signed-in account of the other gender, or with none on file; null when the button stays: on
 *  a mixed session, to an account of the session's gender, and to a visitor who is not signed in, whom the button
 *  takes to sign in first, the database judging the booking then (GENDER_ONLY, which the booking app says the same
 *  way). */
export function genderBlock(s: { gender?: SessionGender | null }, viewer: GenderViewer, w: Pick<GenderText, "noMale" | "noFemale">): string | null {
  return s.gender && viewer && !genderOk(s, viewer.gender) ? genderRefusal(s.gender, w) : null;
}
