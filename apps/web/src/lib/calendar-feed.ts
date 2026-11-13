import { BOOKING_URL } from "./links";

// A calendar address of the rider's own on My Account (the booking app's new features build F27, 2026-11-13:
// calendar-feed.js and _calfPeek in app.src.html; rentals migration 20261114082700). The Account part shows a Calendar
// section only once calendar_link's 'peek' has answered (it makes nothing and sends no key); its button opens a centred
// pop-up (components/account/CalendarFeed.tsx) that asks for the key through POST /api/account/calendar ('get', made on
// the first ask; 'new' replaces it, and the old address then answers with an empty calendar). The address is the
// booking app's own /api/ics?k=<key> (its functions/api/ics.js), on the booking app's host, never this site's. The key
// lives only in the open pop-up: never in this page's address, in storage, in a cache or in a log.

/** The key's shape, as the database writes it (calendar_feeds_key_shape). */
export const CALF_KEY = /^[0-9a-f]{64}$/;
/** The languages calendar_link writes the events in: the booking app's ten (any other is kept as stored). */
export const CALF_LANGS = ["en", "ar", "fr", "es", "pt", "ur", "hi", "tl", "ne", "bn"] as const;
/** What the pop-up asks: the rider's key (made on the first ask), or a new one in its place. */
export type CalfOp = "get" | "new";

/** The page's language as calendar_link takes it: one of the booking app's ten, else null (the stored one stays). */
export const calfLang = (locale: unknown): string | null => (CALF_LANGS as readonly unknown[]).includes(locale) ? (locale as string) : null;

/** Whether the section shows: calendar_link's 'peek' answered {ok: true}. No function, an error, a token that is no
 *  longer the account's ({ok: false, error: 'denied'}) or no answer: no section. */
export const calfPeekOn = (r: { status: number; data: unknown }): boolean =>
  r.status === 200 && !!r.data && typeof r.data === "object" && (r.data as Record<string, unknown>).ok === true;

/** What the pop-up posts, read safely: {op: 'get' | 'new', lang?}; null for a body it cannot take. */
export function calfBody(body: unknown): { op: CalfOp; lang: string | null } | null {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!b || (b.op !== "get" && b.op !== "new")) return null;
  return { op: b.op, lang: calfLang(b.lang) };
}

/** calendar_link's answer to 'get' or 'new': the key, or why not - "signin" (the token is no longer the account's) or
 *  "generic" (anything else, a key of the wrong shape included). */
export function calfAnswer(data: unknown): { ok: true; key: string } | { ok: false; error: "signin" | "generic" } {
  const d = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  if (d?.ok === true && typeof d.key === "string" && CALF_KEY.test(d.key)) return { ok: true, key: d.key };
  return { ok: false, error: d?.ok === false && d.error === "denied" ? "signin" : "generic" };
}

/** The route's answer as the pop-up reads it: the key, or why not - "signin" (the page is drawn again), "absent" (the
 *  section goes) or "generic" (said, with Try again; a failed replace keeps the key the rider has). */
export function calfGot(body: unknown): { key: string } | { error: "signin" | "absent" | "generic" } {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (b?.ok === true && typeof b.key === "string" && CALF_KEY.test(b.key)) return { key: b.key };
  return { error: b?.error === "signin" || b?.error === "absent" ? b.error : "generic" };
}

/** The host the address is on: the booking app's, as staff set it (Website > Whole site), else BOOKING_URL's. Never
 *  this site's: micromobility.sa has no /api/ics. */
export function calfHost(app: string): string {
  try {
    const u = new URL(app);
    if ((u.protocol === "https:" || u.protocol === "http:") && !/^(www\.)?micromobility\.sa$/i.test(u.hostname)) return u.host;
  } catch { /* not an address */ }
  return new URL(BOOKING_URL).host;
}

/** The rider's address: webcal for Add to my calendar (the phone's calendar subscribes to it), https for Copy. */
export const calfAddress = (host: string, key: string, scheme: "webcal" | "https"): string =>
  `${scheme}://${host}/api/ics?k=${encodeURIComponent(key)}`;
