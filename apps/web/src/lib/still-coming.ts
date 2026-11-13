import { codeReady, ksaAt, type TicketRow, type TicketSession } from "./tickets";
import { bookingLink } from "./links";
import { ENTRY_ID } from "./rating";
import { SESSION_ID } from "./waiver";

// "Still coming?" on My Account's ticket (the booking app's new features build F2, 2026-11-13: _stcTm, _stcAt, _stcHtml,
// _stcYes; rentals migration 20261114080200). From 24 hours before the time to turn up until the session starts, a booking
// that holds a place shows two buttons: "I'm coming" stamps it (booking_coming, through app/api/account/coming: the
// rider's own seated rows on that session, every rider of the booking at once, the first answer for the date stands) and
// "Can't come" opens the booking app's My Bookings at that ticket (/my-bookings?tk=<booking>, the evening-before
// reminder's own link), where Cancel is. After a yes one quiet chip stands where the buttons were; no line goes with them
// (the owner: no hint lines), never on a waitlisted booking, nor on one staff have not confirmed yet (an approval ride only
// once its list is out), nor on a session called off. A read without the column asks nothing.

const DAY = 864e5;

/** When to turn up and when it starts, as epoch milliseconds (the booking app's _stcTm, as its countdown reads them): the
 *  gathering on a ride that gathers, the start on a session without bikes, else bike collection; the start is the
 *  gathering's second time, else the first (a start before the time to turn up is the next day's). Null without times. */
export function comingMoments(s: Pick<TicketSession, "date" | "times" | "gathers" | "bikes" | "collect">): { go: number; st: number } | null {
  if (!s.times) return null;
  const [a, b] = s.times;
  const go = ksaAt(s.date, s.gathers || !s.bikes ? a : s.collect || a);
  let st = ksaAt(s.date, s.gathers ? b || a : a);
  if (!Number.isFinite(go)) return null;
  if (!Number.isFinite(st)) st = go;
  else if (st < go) st += DAY;
  return { go, st };
}

/** A yes counts when it was given for this session's date: from 48 hours before the time to turn up (the server takes
 *  one from then; a booking moved to another date loses it there). The booking app's _stcAt. */
export function comingCounts(at: string | null | undefined, m: { go: number }): boolean {
  const t = at ? Date.parse(at) : NaN;
  return Number.isFinite(t) && t >= m.go - 2 * DAY;
}

export type StillComing = { ok: boolean; sessionId: string; bookingId: string } | null;

/** What the ticket shows (the booking app's _stcHtml, drawn where `_held` and the first row waits): null nothing; else the
 *  chip when every waiting rider has said yes (`ok`), or the two buttons, for the session "I'm coming" answers and the
 *  booking "Can't come" opens. `now` is the server's clock when it drew the page. */
export function stillComing(rows: TicketRow[], s: TicketSession | undefined, now: number, past = false): StillComing {
  if (past || !s || s.calledOff || !rows.length || !codeReady(rows, s)) return null;
  const st = rows.some((r) => r.status === "active") ? "active" : rows[0].status;
  if (st !== "waiting") return null;
  const L = rows.filter((r) => r.status === "waiting");
  if (!L.length || L.some((r) => r.comingAt === undefined)) return null;
  const m = comingMoments(s);
  if (!m || now < m.go - DAY || now >= m.st) return null;
  return { ok: L.every((r) => comingCounts(r.comingAt, m)), sessionId: L[0].sessionId, bookingId: L[0].id };
}

/** The booking app's My Bookings at this booking's ticket (its reminder's link, read by _readStcTk), in the page's
 *  language; null when the app's address cannot be read. */
export function comingCancelLink(bookings: string | null | undefined, bookingId: string, locale: string): string | null {
  if (!bookings || !ENTRY_ID.test(bookingId)) return null;
  try {
    const u = new URL(bookings);
    u.searchParams.set("tk", bookingId);
    return bookingLink(u.toString(), locale);
  } catch { return null; }
}

/** The yes a ticket posts, read safely: {session} with a session's id, else null. */
export function comingBody(body: unknown): { session: string } | null {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  return b && typeof b.session === "string" && SESSION_ID.test(b.session) ? { session: b.session } : null;
}

/** booking_coming's answer as the route says it: ok (with when, the party's first yes), or why not - "closed" (called off,
 *  too early, already started), "none" (no seated booking there), "signin" (the token is no longer the account's) or
 *  "generic" for anything else. */
export function comingAnswer(data: unknown): { ok: true; at: string | null } | { ok: false; error: "closed" | "none" | "signin" | "generic" } {
  const d = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  if (d?.ok === true) return { ok: true, at: typeof d.coming_at === "string" ? d.coming_at : null };
  const e = d?.error;
  return { ok: false, error: e === "closed" || e === "none" ? e : e === "denied" ? "signin" : "generic" };
}
