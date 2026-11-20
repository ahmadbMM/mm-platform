// The Marketplace inbox's unread number (W3): the plain rules of the badge beside the header's Marketplace link, in
// the narrow screen's menu and on My Account's inbox row. It is a file of its own, and imports nothing, because the
// header is on every page of the site: the badge must not bring the rest of the contact side (lib/market/w3.ts, and
// through it the Marketplace's lists and the sign-in's) to pages that have nothing to do with the Marketplace.

/** The unread number is asked for again every 90 seconds while a page is in view, for a signed-in visitor only. */
export const UNREAD_POLL_MS = 90_000;

/** The unread number as the badge writes it: nothing for none, "99+" above 99. */
export function unreadText(n: number): string {
  if (!Number.isFinite(n) || n < 1) return "";
  return n > 99 ? "99+" : String(Math.floor(n));
}

/** What a page knows of the number: how many threads hold something unread, and whether the visitor has an account
 *  (null: not asked yet, or not answered). */
export type UnreadState = { n: number; signedIn: boolean | null };
export const UNREAD_UNKNOWN: UnreadState = { n: 0, signedIn: null };

/** What is known once /api/market/unread has answered `raw` (its JSON, or null for no answer):
 *   {ok: true, signedIn: true, n}    the account's number
 *   {ok: true, signedIn: false}      a visitor with no account: no number
 *   {ok: false, error: "signin"}     a session the database no longer takes: the same as no account
 *   {ok: false, error: "absent"}     a database without the Marketplace: there is no number to ask for
 *   anything else                    (too many requests, no connection, an answer that cannot be read) what was known
 *                                    stays as it was */
export function unreadAfter(was: UnreadState, raw: unknown): UnreadState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return was;
  const b = raw as Record<string, unknown>;
  if (b.ok === true) {
    if (b.signedIn !== true) return { n: 0, signedIn: false };
    return { n: typeof b.n === "number" && Number.isFinite(b.n) ? Math.max(0, Math.floor(b.n)) : 0, signedIn: true };
  }
  return b.error === "signin" || b.error === "absent" ? { n: 0, signedIn: false } : was;
}
/** Whether the number is asked for again on this page: never once the visitor is known to have no account (or the
 *  database no Marketplace); an answer that failed is asked for again. */
export const unreadAsksAgain = (s: UnreadState): boolean => s.signedIn !== false;
