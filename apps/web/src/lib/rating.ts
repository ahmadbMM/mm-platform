import { BOOKING_URL } from "./links";
import type { SiteContent } from "./site";

// The post-ride rating (app/api/account/rate, components/account/RateRide.tsx) and the Google
// Wallet pass (app/api/google-wallet): the plain logic, so it can be tested. The rating goes to
// customer_booking_update as the booking app sends its own - rating_exp and rating_bike from 1 to
// 10, feedback, and rating_tags, the quick tags of the 2026-09-27 round (eight codes at most,
// from a fixed list) - and the pass is made by the booking app's own /api/google-wallet.

export const RATING_TAGS = ["route", "pace", "bike", "staff", "safety", "fun"] as const;
export type RatingTag = (typeof RATING_TAGS)[number];
export const ENTRY_ID = /^[A-Za-z0-9_-]{1,64}$/;

export type RatingPatch = { rating_exp: number; rating_bike?: number; feedback?: string; rating_tags?: RatingTag[] };

const score = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 10 ? v : null);

/** What the browser sent, checked: the entry and the patch to write, or null when it is not a rating. */
export function cleanRating(body: unknown): { entryId: string; patch: RatingPatch } | null {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!b || typeof b.entryId !== "string" || !ENTRY_ID.test(b.entryId)) return null;
  const exp = score(b.exp);
  if (exp === null) return null;
  const patch: RatingPatch = { rating_exp: exp };
  const bike = score(b.bike);
  if (bike !== null) patch.rating_bike = bike;
  if (typeof b.note === "string" && b.note.trim()) patch.feedback = b.note.replace(/[\u0000-\u0008\u000b-\u001f]/g, "").trim().slice(0, 500);
  if (Array.isArray(b.tags)) {
    const tags = [...new Set(b.tags.filter((t): t is RatingTag => typeof t === "string" && (RATING_TAGS as readonly string[]).includes(t)))];
    if (tags.length) patch.rating_tags = tags;
  }
  return { entryId: b.entryId, patch };
}

/** The same patch for a database that predates rating_tags (the column, or the function that
 *  takes it): the scores and the note still land. */
export function withoutTags(patch: RatingPatch): RatingPatch {
  const rest = { ...patch };
  delete rest.rating_tags;
  return rest;
}

/** Whether a failed write says the tags are what it did not understand. */
export const tagsRefused = (message: string) => /rating_tags/i.test(message);

/** The booking app's origin, where the passes are made: the address staff set (Website > Whole
 *  site > Other addresses), else the site's own default. */
export function bookingOrigin(content: SiteContent | null): string {
  const set = content?.["site.links.booking"];
  const href = set && typeof set === "object" ? String((set as { href?: unknown }).href ?? "") : "";
  try { return new URL(/^https:\/\//i.test(href) ? href : BOOKING_URL).origin; } catch { return new URL(BOOKING_URL).origin; }
}

/** A booking rated already, as my_bookings hands the row back. */
export const isRated = (r: Record<string, unknown>) => r.rating_exp != null || r.rating_bike != null;
