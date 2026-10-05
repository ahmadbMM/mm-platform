import { BOOKING_URL } from "./links";

// The post-ride rating (app/api/account/rate, components/account/RateRide.tsx and RatingGate.tsx)
// and the Google Wallet pass (app/api/google-wallet): the plain logic, so it can be tested.
//
// The rating is the booking app's own (app.src.html, "Post-ride rating: an unskippable page",
// 2026-10-03). What it asks depends on the ride: a circuit or Petromin ride (and any other kind)
// scores service, the bike and the experience; a Saturday social ride scores the ride (check-in
// and collection, staff, bike, route), the breakfast (restaurant, atmosphere, food, service) and
// the whole experience. Every score is 1-10, and one of 8 or under carries the rider's reason. It
// goes to customer_booking_update as the booking app sends it: rating_bike and rating_exp (the
// bike, and the experience or overall score), feedback, and rating_detail
// {form, s: {question: score}, why: {question: reason}, skip_bf?}, which the database cleans the
// same way (migration 20261003150000_rating_detail.sql in the rentals repo).

export const ENTRY_ID = /^[A-Za-z0-9_-]{1,64}$/;
/** A score at or under this asks why. */
export const RG_LOW = 8;
/** Only rides from the day the forced rating went live are asked about. */
export const RATE_FROM = "2026-10-03";
export const REASON_MAX = 300;
export const NOTE_MAX = 1000;

export type RatingForm = "rental" | "social";
/** [question, sub-questions], in the order the form asks them. */
export const RG_FORMS: Record<RatingForm, ReadonlyArray<readonly [string, readonly string[]]>> = {
  rental: [["service", []], ["bike", []], ["experience", []]],
  social: [["ride", ["ride_checkin", "ride_staff", "ride_bike", "ride_route"]], ["breakfast", ["bf_restaurant", "bf_atmosphere", "bf_food", "bf_service"]], ["overall", []]],
};
const BIKE_KEYS = new Set(["bike", "ride_bike"]);
const BREAKFAST_KEYS = new Set(["breakfast", "bf_restaurant", "bf_atmosphere", "bf_food", "bf_service"]);
const KEY = /^[a-z_]{1,24}$/;

/** The form a ride asks: the Saturday social ride's (a community ride of no other kind), else the rental's. */
export const formOf = (kind: string | null | undefined): RatingForm => (kind === "saturday" ? "social" : "rental");

/** The questions a ride asks, as [question, sub-questions]: no bike question for a rider on their
 *  own bike or an activity with none, no breakfast once the rider says they did not stay. */
export function questionTree(form: RatingForm, o: { noBike?: boolean; skipBf?: boolean } = {}): Array<[string, string[]]> {
  return RG_FORMS[form]
    .filter(([k]) => !(o.noBike && k === "bike") && !(o.skipBf && k === "breakfast"))
    .map(([k, sub]) => [k, sub.filter((x) => !(o.noBike && x === "ride_bike"))]);
}
export const questionKeys = (form: RatingForm, o: { noBike?: boolean; skipBf?: boolean } = {}) =>
  questionTree(form, o).flatMap(([k, sub]) => [k, ...sub]);

/** What a rider must fix before the rating can be sent: per question, "pick" (no score) or "why"
 *  (8 or under with no reason). Empty when it is complete. */
export function ratingErrors(keys: string[], s: Record<string, number>, why: Record<string, string>): Record<string, "pick" | "why"> {
  const err: Record<string, "pick" | "why"> = {};
  for (const k of keys) {
    const v = s[k];
    if (!(Number.isInteger(v) && v >= 1 && v <= 10)) err[k] = "pick";
    else if (v <= RG_LOW && !String(why[k] ?? "").trim()) err[k] = "why";
  }
  return err;
}

export type RatingDetail = { form: RatingForm; s: Record<string, number>; why: Record<string, string>; skip_bf?: true };
export type RatingPatch = { rating_exp: number; rating_bike: number | null; feedback: string | null; rating_detail?: RatingDetail };

const score = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 10 ? v : null);
const cleanText = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim().slice(0, max) : "";
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** What the browser sent, checked: the entry and the patch to write, or null when it is not a
 *  rating. The rating is {entryId, form, s, why, skipBf, note}, as the form sends it: the scores
 *  and reasons are cleaned as the database cleans them (question keys [a-z_]{1,24}, scores 1-10,
 *  reasons trimmed to 300 characters, at most 20 of each), a question the form does not ask is
 *  dropped, every question it asks must be scored (the bike may be left out: only the page knows
 *  the rider's own bike; the breakfast too, once skipped), and a score of 8 or under needs its
 *  reason. A body from before the detailed rating ({entryId, exp, bike?, note?}, a page open
 *  across a deploy) still lands its scores and note; its old quick tags are ignored. */
export function cleanRating(body: unknown): { entryId: string; patch: RatingPatch } | null {
  const b = isObj(body) ? body : null;
  if (!b || typeof b.entryId !== "string" || !ENTRY_ID.test(b.entryId)) return null;
  const note = cleanText(b.note, NOTE_MAX) || null;
  if (b.form === undefined) {
    const exp = score(b.exp);
    if (exp === null) return null;
    return { entryId: b.entryId, patch: { rating_exp: exp, rating_bike: score(b.bike), feedback: note } };
  }
  if (b.form !== "rental" && b.form !== "social") return null;
  const form: RatingForm = b.form;
  const skipBf = form === "social" && b.skipBf === true;
  const asked = new Set(questionKeys(form, { skipBf }));
  const sIn = isObj(b.s) ? b.s : {}, whyIn = isObj(b.why) ? b.why : {};
  const s: Record<string, number> = {}, why: Record<string, string> = {};
  for (const [k, v] of Object.entries(sIn).slice(0, 20)) {
    if (!KEY.test(k) || !asked.has(k)) continue;
    const n = score(v);
    if (n === null) return null;
    s[k] = n;
  }
  for (const [k, v] of Object.entries(whyIn).slice(0, 20)) {
    const w = cleanText(v, REASON_MAX);
    if (KEY.test(k) && s[k] !== undefined && s[k] <= RG_LOW && w) why[k] = w;
  }
  for (const k of asked) {
    if (s[k] === undefined && !BIKE_KEYS.has(k) && !(skipBf && BREAKFAST_KEYS.has(k))) return null;
    if (s[k] !== undefined && s[k] <= RG_LOW && !why[k]) return null;
  }
  const exp = s.experience ?? s.overall;
  if (exp === undefined) return null;
  const detail: RatingDetail = { form, s, why, ...(skipBf ? { skip_bf: true as const } : {}) };
  return { entryId: b.entryId, patch: { rating_bike: s.bike ?? s.ride_bike ?? null, rating_exp: exp, feedback: note, rating_detail: detail } };
}

/** Where the Google Wallet passes are made, the rider's session token going with the request: the
 *  booking app's own origin, fixed in the code (BOOKING_URL). Never the address staff can edit
 *  (Website > Whole site > Other addresses, which the site's links follow): a token must only ever
 *  go where the code says, and the booking app keeps that address whatever domain it adds. */
export const WALLET_ORIGIN = new URL(BOOKING_URL).origin;

/** The booking app's status as the Google Wallet route's own: a status that cannot carry a JSON
 *  body (204, 205, 304) or is not a final answer made `new Response` throw, so it reads as a 502. */
export function relayStatus(s: number): number {
  return Number.isInteger(s) && s >= 200 && s <= 599 && s !== 204 && s !== 205 && s !== 304 ? s : 502;
}

const S = (v: unknown) => (typeof v === "string" ? v : "");
const dayOf = (r: Record<string, unknown>) => (S(r.session_date) || S(r.session_id)).slice(0, 10);

/** A booking rated already, as my_bookings hands the row back. A ride from RATE_FROM on counts only
 *  with the full form (rating_detail): a quick score with tags, from the old form or a phone on an
 *  older build, asks again, as the booking app's _rgRated does (the owner, 2026-10-03). */
export const isRated = (r: Record<string, unknown>) =>
  (r.rating_detail != null && typeof r.rating_detail === "object") || ((r.rating_exp != null || r.rating_bike != null) && dayOf(r) < RATE_FROM);

export type UnratedRide = {
  /** The row the rating is written to: the lowest queue number (a party rates once). */
  entryId: string; sessionId: string; date: string;
  /** Every one of the account's rows that night is on its own bike. */
  ownBike: boolean;
};

/** The account's finished rides with no rating yet, one per night (a night counts as rated once
 *  any of its rows is), oldest first. */
export function unratedRides(rows: Array<Record<string, unknown>>, today: string): UnratedRide[] {
  const by = new Map<string, Array<Record<string, unknown>>>();
  for (const r of rows) {
    const d = dayOf(r);
    if (r.status !== "done" || typeof r.id !== "string" || !ENTRY_ID.test(r.id) || !/^\d{4}-\d{2}-\d{2}$/.test(d) || d > today) continue;
    const sid = S(r.session_id) || d;
    by.set(sid, [...(by.get(sid) ?? []), r]);
  }
  const out: UnratedRide[] = [];
  for (const [sessionId, list] of by) {
    if (list.some(isRated)) continue;
    const qn = (r: Record<string, unknown>) => (typeof r.queue_num === "number" ? r.queue_num : 0);
    const first = [...list].sort((a, b) => qn(a) - qn(b))[0];
    out.push({ entryId: S(first.id), sessionId, date: dayOf(first), ownBike: list.every((r) => r.type_preference === "Own") });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** The ride the rider must rate before anything else (the booking app's _pendingRatingId): the
 *  oldest unrated ride from RATE_FROM to today, or null. */
export const pendingRating = (rows: Array<Record<string, unknown>>, today: string): UnratedRide | null =>
  unratedRides(rows, today).find((r) => r.date >= RATE_FROM) ?? null;
