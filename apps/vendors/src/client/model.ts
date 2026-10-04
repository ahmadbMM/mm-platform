// What the database answers, and the plain rules the page draws from it. Pure (tested).

import { addDays, type Iso } from "./dates";
import { plural } from "./plurals";
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

export type Role = "owner" | "manager" | "viewer";

export type Me = {
  /** sessions: this login's signed-in devices (20261004130000; an older database leaves it out). */
  user: { id: number; name: string; login: string; role: Role | string; must_change: boolean; sessions?: number };
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
  /** Who cancelled, why, and whether it counted as late (20261004130000). */
  cancelled_by?: "venue" | "mm" | null;
  cancel_reason?: string;
  late_cancel?: boolean;
};

/** One date of vendor_calendar. riders: the live bookings on that Saturday's social ride, on the
 *  venue's pending and confirmed dates. ride_time: the ride's "gathering - start". decide_by: the date
 *  MicroMobility answers a pending request by. others_pending: how many other venues wait on the
 *  date (a number only). declined: the venue's own latest request was declined or cancelled. */
export type CalDay = {
  day: Iso; state: "open" | "closed"; reason: string; mine: Mine | null; taken: boolean; riders: number | null;
  ride_time?: string | null; decide_by?: Iso | null; others_pending?: number | null; declined?: boolean;
};

export type Verdict = "ok" | "taken" | "closed" | "not_open" | "too_soon" | "too_far" | "mine" | "over_quota" | "not_allowed";

export type Checked = { day: Iso; verdict: Verdict; reason: string };

export type DayStatus = "available" | "requested" | "confirmed" | "declined" | "cancelled" | "taken" | "closed" | "not_open" | "past" | "soon" | "far";

/** What a calendar cell shows for a day. With the plan, a free date inside the notice period
 *  reads "soon" and one past the booking window "far", so Available always means bookable. */
export function dayStatus(day: Iso, entry: CalDay | undefined, today: Iso, tier?: Tier): DayStatus {
  const live = entry?.mine && (entry.mine.status === "pending" || entry.mine.status === "confirmed") ? entry.mine : null;
  if (live?.status === "confirmed") return "confirmed";
  if (day < today) return entry ? "past" : "not_open";
  if (live?.status === "pending") return "requested";
  if (!entry) return "not_open";
  // The venue's own request that was not chosen reads so; one it cancelled reads Cancelled unless the
  // date can be asked for again.
  if (entry.mine?.status === "declined") return "declined";
  const st: DayStatus = entry.state === "closed" ? "closed" : entry.taken ? "taken"
    : tier && day < addDays(today, tier.min_lead_days) ? "soon" : tier && day > addDays(today, tier.horizon_days) ? "far" : "available";
  if (entry.mine?.status === "cancelled" && st !== "available") return "cancelled";
  return st;
}

export const STATUS_KEY: Record<DayStatus, Key> = {
  available: "stAvailable",
  requested: "stRequested",
  confirmed: "stConfirmed",
  declined: "stDeclined",
  cancelled: "stCancelled",
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
    case "too_soon": return fmt(lang, "vTooSoon", { days: plural(lang, "days", tier.min_lead_days) });
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

/** The policy's 48 hours: a confirmed breakfast whose day starts (Riyadh midnight) less than 48 hours
 *  from now can only be cancelled with a reason, and counts as late (vendor_cancel, LATE_REASON). */
export const LATE_HOURS = 48;
export function within48h(day: Iso, m: Mine, now: number = Date.now()): boolean {
  return m.status === "confirmed" && Date.parse(`${day}T00:00:00+03:00`) - now < LATE_HOURS * 3600_000;
}

/** What each role may do (the database checks the same, FORBIDDEN). */
export const canRequest = (role: string) => role === "owner" || role === "manager";
export const canEditVenue = (role: string) => role === "owner";
export const canCancelSeries = (role: string) => role === "owner";

/** The Saturday ride's times from its "gathering - start" (bike_slots _time), or null. */
export function rideTimes(raw: string | null | undefined): { gather: string; start: string } | null {
  const m = /^\s*(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})\s*$/.exec(String(raw ?? ""));
  if (!m) return null;
  const two = (h: string, mm: string) => `${h.padStart(2, "0")}:${mm}`;
  return { gather: two(m[1], m[2]), start: two(m[3], m[4]) };
}

/** When riders reach the breakfast: between these many minutes after the ride starts. A rough guide
 *  for the venue (the 20 and 40 km loops ride about this long); the owner may adjust it. */
export const ARRIVAL_AFTER_START: [number, number] = [90, 150];
export function arrivalWindow(start: string): [string, string] | null {
  const m = /^(\d{2}):(\d{2})$/.exec(start);
  if (!m) return null;
  const at = (add: number) => { const t = (Number(m[1]) * 60 + Number(m[2]) + add) % 1440; return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };
  return [at(ARRIVAL_AFTER_START[0]), at(ARRIVAL_AFTER_START[1])];
}

/** "06:15" as the page's language writes a time: "6:15 AM" / "6:15 ص". */
export function clockText(lang: Lang, hhmm: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-SA-u-nu-latn" : "en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" })
    .format(new Date(Date.UTC(2000, 0, 1, Number(m[1]), Number(m[2]))));
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
    case "MUST_CHANGE": return "errMustChange";
    case "TEMP_EXPIRED": return "errTempExpired";
    case "FORBIDDEN": return "errForbidden";
    case "LATE_REASON": return "errLateReason";
    case "COMMON_PASSWORD": return "errCommon";
    case "PERSONAL_PASSWORD": return "errPersonal";
    case "BAD_PHONE": return "errPhone";
    case "BAD_EMAIL": return "errEmail";
    case "TOO_LONG": return "errTooLong";
    default: return "errServer";
  }
}

/** The password policy the database enforces (vendor_set_password, NIST SP 800-63B): 10 to 200
 *  characters, no composition rules, not a common password, nothing from the login or the venue's
 *  name. The same list and checks as _vendor_pwd_problem in the rentals migration 20261004130000. */
export const PW_MIN = 10;
export const PW_MAX = 200;
const COMMON = new Set([
  "password", "password1", "password12", "password123", "password1234", "passw0rd", "p@ssw0rd",
  "123456789", "1234567890", "12345678910", "0123456789", "0987654321", "1122334455", "1111111111",
  "qwerty", "qwerty123", "qwertyuiop", "qwerty12345", "asdfghjkl", "1q2w3e4r5t", "zaq12wsx", "abc123456",
  "iloveyou", "letmein", "welcome", "welcome123", "welcome2026", "admin", "admin12345", "administrator",
  "micromobility", "micromobility1", "micromobility123", "micromobility2026", "vendors", "vendor123",
  "breakfast", "breakfast123", "restaurant", "restaurant1", "cafe123456", "saudiarabia", "riyadh123",
  "jeddah123", "dammam123", "khobar123", "changeme", "changeme123", "temppassword", "football",
  "princess", "sunshine", "dragon", "monkey", "master", "superman", "trustno1",
]);
const bare = (x: string) => x.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
export type PwProblem = "" | "WEAK_PASSWORD" | "COMMON_PASSWORD" | "PERSONAL_PASSWORD";
export function passwordProblem(p: string, ctx: { login?: string; venueNames?: string[] } = {}): PwProblem {
  const len = [...p].length;
  if (len < PW_MIN || len > PW_MAX) return "WEAK_PASSWORD";
  const low = p.toLowerCase();
  if (/^(.)\1*$/su.test(low) || COMMON.has(bare(p))) return "COMMON_PASSWORD";
  const login = (ctx.login || "").toLowerCase();
  if (login.includes("@")) {
    const part = login.split("@")[0];
    if (part.length >= 3 && low.includes(part)) return "PERSONAL_PASSWORD";
  } else {
    const digits = login.replace(/\D/g, "");
    const mine = p.replace(/\D/g, "");
    if (digits.length >= 7 && (mine.includes(digits) || mine.includes(digits.slice(-9)))) return "PERSONAL_PASSWORD";
  }
  for (const name of ctx.venueNames || []) {
    for (const part of [name.trim().toLowerCase(), bare(name)]) {
      if ([...part].length >= 3 && (low.includes(part) || bare(p).includes(part))) return "PERSONAL_PASSWORD";
    }
  }
  return "";
}

/** A contact phone as the database keeps it (E.164: "+" and 8-15 digits; a Saudi 05xxxxxxxx or
 *  5xxxxxxxx gets +966), "" for empty, or null when it is not a phone number (BAD_PHONE). */
export function e164(raw: string): string | null {
  const v = raw.trim();
  if (!v) return "";
  if (!/^[0-9+()\s.-]+$/.test(v)) return null;
  let d = v.replace(/\D/g, "");
  if (!v.startsWith("+")) {
    if (d.startsWith("00")) d = d.slice(2);
    else if (/^05\d{8}$/.test(d)) d = `966${d.slice(1)}`;
    else if (/^5\d{8}$/.test(d)) d = `966${d}`;
  }
  return /^[1-9]\d{7,14}$/.test(d) ? `+${d}` : null;
}

/** An email the database accepts for the contact (BAD_EMAIL otherwise); "" is fine. */
export function emailOk(raw: string): boolean {
  const v = raw.trim();
  return !v || (v.length <= 200 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v));
}

/** The venue's insights, from the calendar's past and coming dates and the shared ratings. */
export type Insights = {
  hosted: number;
  upcoming: number;
  recent: { day: Iso; riders: number | null; turnout: number | null }[];
  sharedAvg: number | null;
  sharedCount: number;
  ownAvg: number | null;
  ownCount: number;
};
export function insights(days: CalDay[], shared: SharedRatings[], today: Iso): Insights {
  const conf = days.filter((d) => d.mine?.status === "confirmed").sort((a, b) => a.day.localeCompare(b.day));
  const past = conf.filter((d) => d.day < today);
  const recent = past.slice(-6).reverse().map((d) => ({ day: d.day, riders: d.riders ?? null, turnout: feedbackOf(d.mine)?.turnout ?? null }));
  const lastShared = [...shared].filter((s) => typeof s?.averages?.breakfast === "number").sort((a, b) => b.day.localeCompare(a.day)).slice(0, 6);
  const own = past.map((d) => feedbackOf(d.mine)?.rating).filter((r): r is number => typeof r === "number");
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
  return {
    hosted: past.length,
    upcoming: conf.filter((d) => d.day >= today).length,
    recent,
    sharedAvg: avg(lastShared.map((s) => s.averages.breakfast as number)),
    sharedCount: lastShared.length,
    ownAvg: avg(own),
    ownCount: own.length,
  };
}
