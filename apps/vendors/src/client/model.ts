// What the database answers, and the plain rules the page draws from it. Pure (tested).

import { addDays, type Iso } from "./dates";
import { fmt, type Key, type Lang } from "./strings";

export type Mode = "single" | "multi" | "recurring";

export type Tier = {
  id: string;
  name_en: string;
  name_ar: string;
  modes: Mode[];
  max_per_month: number | null;
  horizon_days: number;
  min_lead_days: number;
  cancel_cutoff_days: number;
  benefits: { en?: string; ar?: string }[];
};

export type Venue = {
  id: number;
  name: string;
  name_ar: string;
  map_url: string;
  seats: number | null;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  offer_en: string;
  offer_ar: string;
  tier_id: string;
  status: string;
};

export type Me = {
  user: { id: number; name: string; login: string; role: string; must_change: boolean };
  venue: Venue;
  tier: Tier;
  today: Iso;
};

export type BookingStatus = "pending" | "confirmed" | "declined" | "cancelled";

/** The venue's feedback on one breakfast (vendor_feedback_save's answer, and mine.feedback). */
export type Feedback = {
  booking_id: number;
  venue_id: number;
  day: Iso;
  rating: number;
  turnout: number | null;
  went_well: string;
  improve: string;
  created_at: string;
  updated_at: string;
};

/** feedback / feedback_open came with the feedback migration: an older database leaves both out. */
export type Mine = {
  id: number;
  status: BookingStatus;
  kind: Mode;
  series_id: number | null;
  note: string;
  staff_note: string;
  feedback?: Feedback | null;
  feedback_open?: boolean;
};

export type CalDay = { day: Iso; state: "open" | "closed"; reason: string; mine: Mine | null; taken: boolean; riders: number | null };

export type Verdict = "ok" | "taken" | "closed" | "not_open" | "too_soon" | "too_far" | "mine" | "over_quota" | "not_allowed";

export type Checked = { day: Iso; verdict: Verdict; reason: string };

export type DayStatus = "available" | "requested" | "confirmed" | "taken" | "closed" | "not_open" | "past" | "soon" | "far";

/** What a calendar cell shows for a day. With the plan, a free date inside the notice period
 *  reads "soon" and one past the booking window "far", so Available always means bookable. */
export function dayStatus(day: Iso, entry: CalDay | undefined, today: Iso, tier?: Tier): DayStatus {
  const live = entry?.mine && (entry.mine.status === "pending" || entry.mine.status === "confirmed") ? entry.mine : null;
  if (live?.status === "confirmed") return "confirmed";
  if (day < today) return entry ? "past" : "not_open";
  if (live?.status === "pending") return "requested";
  if (!entry) return "not_open";
  if (entry.state === "closed") return "closed";
  if (entry.taken) return "taken";
  if (tier && day < addDays(today, tier.min_lead_days)) return "soon";
  if (tier && day > addDays(today, tier.horizon_days)) return "far";
  return "available";
}

export const STATUS_KEY: Record<DayStatus, Key> = {
  available: "stAvailable",
  requested: "stRequested",
  confirmed: "stConfirmed",
  taken: "stTaken",
  closed: "stClosed",
  not_open: "stNotOpen",
  past: "stPast",
  soon: "stSoon",
  far: "stFar",
};

/** Whether a day can be picked in the booking dialog (the database still has the last word). */
export function pickable(entry: CalDay, today: Iso, tier: Tier): boolean {
  return dayStatus(entry.day, entry, today, tier) === "available";
}

/** A closed date's reason: the staff page saves its presets as codes, anything else as typed. */
const REASON_KEY: Record<string, Key> = { ramadan: "rsRamadan", eid: "rsEid", weather: "rsWeather", holiday: "rsHoliday" };
export function reasonText(lang: Lang, raw: string): string {
  const k = REASON_KEY[raw.trim().toLowerCase()];
  return k ? fmt(lang, k) : raw;
}

/** A preview verdict in words. */
export function verdictText(lang: Lang, c: Checked, tier: Tier): string {
  switch (c.verdict) {
    case "ok": return fmt(lang, "vOk");
    case "taken": return fmt(lang, "vTaken");
    case "closed": return c.reason ? fmt(lang, "vClosed", { reason: reasonText(lang, c.reason) }) : fmt(lang, "vClosedNoReason");
    case "not_open": return fmt(lang, "vNotOpen");
    case "too_soon": return fmt(lang, "vTooSoon", { n: tier.min_lead_days });
    case "too_far": return fmt(lang, "vTooFar");
    case "mine": return fmt(lang, "vMine");
    case "over_quota": return fmt(lang, "vOverQuota", { n: tier.max_per_month ?? "" });
    case "not_allowed": return fmt(lang, "vNotAllowed");
    default: return String(c.verdict);
  }
}

export const BOOKING_KEY: Record<BookingStatus, Key> = {
  pending: "bsPending",
  confirmed: "bsConfirmed",
  declined: "bsDeclined",
  cancelled: "bsCancelled",
};

export const KIND_KEY: Record<Mode, Key> = { single: "kindSingle", multi: "kindMulti", recurring: "kindRecurring" };

/** The note staff left, in words: 'another_venue' is a code, anything else is shown as written. */
export function staffNoteText(lang: Lang, note: string): string {
  return note === "another_venue" ? fmt(lang, "anotherVenue") : note;
}

/** A venue may cancel its own live dates that are still ahead. */
export function cancellable(day: Iso, m: Mine, today: Iso): boolean {
  return (m.status === "pending" || m.status === "confirmed") && day >= today;
}

/** Cancelling this confirmed date now counts as late (inside the plan's cutoff). */
export function lateCancel(day: Iso, m: Mine, today: Iso, tier: Tier): boolean {
  return m.status === "confirmed" && day < addDays(today, tier.cancel_cutoff_days);
}

/** The feedback given on this booking, or null (also when the database does not send it yet). */
export function feedbackOf(m: Mine | null | undefined): Feedback | null {
  const f = m?.feedback;
  return f && typeof f === "object" && typeof f.rating === "number" ? f : null;
}

/** Feedback can be given or edited now: a confirmed breakfast whose window the database says is
 *  open (from the day itself for 14 days). A missing flag reads as closed. */
export function feedbackOpen(day: Iso, m: Mine | null | undefined, today: Iso): boolean {
  return !!m && m.status === "confirmed" && m.feedback_open === true && day <= today;
}

/** A breakfast whose window is open and that has no feedback yet. */
export function awaitsFeedback(day: Iso, m: Mine | null | undefined, today: Iso): boolean {
  return feedbackOpen(day, m, today) && !feedbackOf(m);
}

/** The days in a calendar answer whose breakfast is waiting for the venue's feedback. */
export function awaitingFeedback(days: CalDay[], today: Iso): CalDay[] {
  return days.filter((d) => awaitsFeedback(d.day, d.mine, today));
}

export const RATINGS = [1, 2, 3, 4, 5] as const;
const RATING_KEY: Record<number, Key> = { 1: "fbRate1", 2: "fbRate2", 3: "fbRate3", 4: "fbRate4", 5: "fbRate5" };

/** "4 – Very good". */
export function ratingText(lang: Lang, n: number): string {
  const k = RATING_KEY[n];
  return k ? fmt(lang, k) : String(n);
}

/** The "How many riders came?" box: empty is fine (null), otherwise a whole number 0-1000. */
export function turnoutValue(raw: string): { ok: true; value: number | null } | { ok: false } {
  const v = raw.trim();
  if (!v) return { ok: true, value: null };
  if (!/^\d{1,4}$/.test(v)) return { ok: false };
  const n = Number(v);
  return n <= 1000 ? { ok: true, value: n } : { ok: false };
}

/** The plan's name in the page's language. */
export function tierName(lang: Lang, t: Tier): string {
  return (lang === "ar" ? t.name_ar : t.name_en) || t.name_en;
}

/** The message for an error code the API answered with. */
export function errorKey(code: string): Key {
  switch (code) {
    case "BAD_LOGIN": return "errBadLogin";
    case "LOCKED": return "errLocked";
    case "RATE_LIMIT": return "errRateLimit";
    case "NETWORK": return "errNetwork";
    case "BAD_TOKEN": return "errSession";
    case "WEAK_PASSWORD": return "errWeak";
    case "SAME_PASSWORD": return "errSame";
    case "BAD_PASSWORD": return "errBadPassword";
    case "ONE_DATE": return "errOneDate";
    case "TOO_MANY": return "errTooMany";
    case "BAD_PATTERN": return "errPattern";
    case "BAD_INPUT": case "BAD_RANGE": case "BAD_MODE": return "errInput";
    case "NOT_FOUND": return "errNotFound";
    case "NOT_CONFIRMED": return "errNotConfirmed";
    case "TOO_EARLY": return "errTooEarly";
    case "TOO_LATE": return "errTooLate";
    case "BAD_RATING": return "errRating";
    default: return "errServer";
  }
}

/** The password rules the database enforces (vendor_set_password), checked as the venue types. */
export function passwordRules(p: string): { length: boolean; capital: boolean; number: boolean } {
  return { length: p.length >= 8, capital: /[A-Z]/.test(p), number: /[0-9]/.test(p) };
}
