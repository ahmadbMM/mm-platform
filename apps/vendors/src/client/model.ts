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

/** The breakfast questions riders answer after a social ride, in the order the page shows them. */
export const SHARED_KEYS = ["breakfast", "bf_restaurant", "bf_atmosphere", "bf_food", "bf_service"] as const;
export type SharedKey = (typeof SHARED_KEYS)[number];
export const SHARED_LABEL: Record<SharedKey, Key> = {
  breakfast: "srBreakfast",
  bf_restaurant: "srRestaurant",
  bf_atmosphere: "srAtmosphere",
  bf_food: "srFood",
  bf_service: "srService",
};

/** The riders' breakfast ratings MicroMobility chose to share with the venue (vendor_shared_ratings_mine):
 *  averages out of 10 and comments, never a name. */
export type SharedRatings = {
  booking_id: number;
  day: Iso;
  riders: number;
  averages: Partial<Record<SharedKey, number>>;
  comments: { k: string; text: string }[];
  shared_at: string;
};

const isShared = (k: string): k is SharedKey => (SHARED_KEYS as readonly string[]).includes(k);

/** The shared entries by booking id; anything malformed is left out. */
export function sharedByBooking(list: unknown): Map<number, SharedRatings> {
  const out = new Map<number, SharedRatings>();
  if (!Array.isArray(list)) return out;
  for (const s of list as SharedRatings[]) if (s && typeof s.booking_id === "number") out.set(s.booking_id, s);
  return out;
}

/** The averages present, in question order, rounded to one decimal and kept inside 1-10. */
export function sharedScores(s: SharedRatings): { key: SharedKey; label: Key; value: number }[] {
  const a = s.averages && typeof s.averages === "object" ? s.averages : {};
  const out: { key: SharedKey; label: Key; value: number }[] = [];
  for (const key of SHARED_KEYS) {
    const v = a[key];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    out.push({ key, label: SHARED_LABEL[key], value: Math.min(10, Math.max(1, Math.round(v * 10) / 10)) });
  }
  return out;
}

/** The two classes that size a score's bar without an inline style (the CSP forbids those):
 *  the whole part and the tenth, for example 8.4 -> ["bw-8", "bt-4"]. */
export function barClasses(value: number): [string, string] {
  const tenths = Math.min(100, Math.max(0, Math.round(value * 10)));
  return [`bw-${Math.floor(tenths / 10)}`, `bt-${tenths % 10}`];
}

/** "8.4", always with one decimal. */
export function scoreText(lang: Lang, value: number): string {
  return new Intl.NumberFormat(lang === "ar" ? "ar-SA-u-nu-latn" : "en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}

/** The comments grouped by question: the known questions in order, then any other keys as sent.
 *  Empty texts are dropped. */
export function commentGroups(s: SharedRatings): { k: string; label: Key; texts: string[] }[] {
  const groups = new Map<string, string[]>();
  for (const c of Array.isArray(s.comments) ? s.comments : []) {
    const text = typeof c?.text === "string" ? c.text.trim() : "";
    if (!text) continue;
    const k = String(c.k ?? "");
    groups.set(k, [...(groups.get(k) || []), text]);
  }
  const keys = [...SHARED_KEYS.filter((k) => groups.has(k)), ...[...groups.keys()].filter((k) => !isShared(k))];
  return keys.map((k) => ({ k, label: isShared(k) ? SHARED_LABEL[k] : "srOther", texts: groups.get(k)! }));
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
