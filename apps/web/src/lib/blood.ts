// The Blood Donation event (the owner, 2026-11-03; rentals migration 20261103180000_blood_donation): hosted at the
// Jeddah Corniche Circuit, open to everyone, free, no bikes, one place per account, booked in the booking app (ride_kind
// 'blood', event_kind 'community', session id '<date>-bd'; the website hands over with ?ev=blood). Nothing names it
// until a session exists: no field of the Website editor, whose schema is public, no word in a browser component or in
// the dictionary every page's browser is sent. Its words are the server's (content/blood-words.ts), its poster too
// (content/blood-info.json), and a page or a route hands them on only for a session or a booking. Staff confirm a
// checked-in donor, which makes a personal code for one free ride, valid one calendar month (customer_blood_rewards).
// The plain rules, so they can be tested; the database holds every rule that matters.

/** A Blood Donation session id, as the booking app makes it ('2026-11-05-bd'): a booking on one is known by it when
 *  its session did not load. */
export const isBloodId = (id: string | null | undefined): boolean => /^\d{4}-\d\d-\d\d-bd(-|$)/.test(id ?? "");

/** A donor's free ride: its code, the last day it is good on ("YYYY-MM-DD"), and whether it has been used. */
export type BloodReward = { code: string; expiresAt: string | null; used: boolean };

/** customer_blood_rewards' answer by booking id: its rows of entry_id, code, expires_at and used. Anything else, a
 *  database without the function among them, is none: the ticket then shows no code, never an error. */
export function bloodRewards(data: unknown): Map<string, BloodReward> {
  const out = new Map<string, BloodReward>();
  for (const x of Array.isArray(data) ? data : []) {
    const r = (x ?? {}) as Record<string, unknown>;
    if (typeof r.entry_id !== "string" || typeof r.code !== "string" || !r.code.trim()) continue;
    out.set(r.entry_id, { code: r.code.trim(), expiresAt: typeof r.expires_at === "string" && /^\d{4}-\d{2}-\d{2}/.test(r.expires_at) ? r.expires_at.slice(0, 10) : null, used: r.used === true });
  }
  return out;
}

/** A free ride still to be taken at `today` (Riyadh): not used, and within its month. */
export const rewardGood = (r: BloodReward | null | undefined, today: string): boolean =>
  !!r && !r.used && (!r.expiresAt || r.expiresAt >= today);
