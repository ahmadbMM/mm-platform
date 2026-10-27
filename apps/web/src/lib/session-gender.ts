import type { L } from "@/i18n/tx";

// Men only, women only or mixed (the owner, 2026-10-27: "i want the triathlon pool sessions to be for male only or
// female only or mixed and to be mentioned on the card and event everywhere and only allow the gender selected to
// book it and make it visible only for the gender it is for"), as the booking app's _sessGender, _sgTxt, _sgOk,
// _sgErr and _sgErrOf have it. sessions.gender_only is 'male', 'female' or null (mixed; rentals migration
// 20261027150000). The database gives a men-only or women-only session only to a signed-in account of that gender,
// or one holding a booking on it (list_sessions; the table's own read hides it), and refuses anyone else's booking
// with GENDER_ONLY (its detail: the gender the session is for). The site says the rule wherever it shows the
// session, with the chip the booking app's .sg-chip draws (components/site/site.css). Plain logic, so it can be tested.

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

/** Who is looking: the signed-in account's gender (customer_profile; null when none is on file), and the sessions
 *  list_sessions gave it that are for one gender (its own, or one it holds a booking on). Null: not signed in. */
export type GenderViewer = { gender: SessionGender | null; mine?: ReadonlySet<string> } | null;

/** Whether a visitor is shown a session, a second layer to the database's own rule: a mixed session always; one for
 *  a single gender only to a signed-in account of that gender, or one the database gave this account (a session it
 *  holds a booking on stays, as in the booking app). Never to a visitor who is not signed in. */
export function genderShown(s: { id: string; gender?: SessionGender | null }, viewer: GenderViewer): boolean {
  if (!s.gender) return true;
  if (!viewer) return false;
  return s.gender === viewer.gender || !!viewer.mine?.has(s.id);
}

/** The sessions a visitor is shown: the public ones (read for everyone, which never hold a session for one gender),
 *  with the men-only and women-only sessions the database gave the signed-in account added (`view.mine`, read for
 *  it alone: lib/rides.ts loadGenderSessions), each once; then genderShown. */
export function sessionsFor<T extends { id: string; gender?: SessionGender | null }>(pub: readonly T[], view: { gender: SessionGender | null; mine: readonly T[] } | null): T[] {
  const mine = view?.mine ?? [];
  const ids = new Set(mine.map((s) => s.id));
  const viewer: GenderViewer = view ? { gender: view.gender, mine: ids } : null;
  return [...pub.filter((s) => !ids.has(s.id)), ...mine].filter((s) => genderShown(s, viewer));
}
