import { codeReady, ksaAt, type TicketRow, type TicketSession } from "./tickets";
import { bookingLink } from "./links";
import { ENTRY_ID } from "./rating";
import { SESSION_ID } from "./waiver";

// "Still coming?" on My Account's ticket (the booking app's new features build F2, 2026-11-13: _stcTm, _stcAt, _stcHtml,
// _stcYes; rentals migration 20261114080200). From 24 hours before the time to turn up until the session starts, a booking
// that holds a place shows two buttons: "I'm coming" stamps it (booking_coming, through app/api/account/coming: the
// rider's own seated rows on that session, every rider of the booking at once, the first answer for the date stands) and
// "Can't come" opens the booking app's My Bookings at that ticket (/my-bookings?tk=<booking>&no=1: the evening-before
// reminder's own link, and no=1 answers the ticket's own Can't come there, 2026-11-20: on a Saturday Social Ride one box,
// "Not coming?", whose red button cancels the booking; on any other session the cancel dialog). After a yes one quiet chip stands where the buttons were; no line goes with them
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

// "Running late" (the booking app's customer features round, 2026-11-19, item 1: _rlWin, _rlMin, _ltrAt; rentals migration
// 20261119600100). The user: "'Still coming?' gets a third answer next to I'm coming / Can't come: Running late (10, 20 or
// 30 min). The desk sees it ... so staff stop chasing riders who already said so." Only on a session with a time to turn
// up (Late arrivals: a ride that gathers, or a workshop, event, yoga or the DEFE run; never the circuit, Petromin, the pool,
// blood or the Arena race), from two hours before that time until an hour after the start, while the place is held; after
// the start it is the only button. A pick saves at once (booking_late through app/api/account/late: every rider of the
// booking, and it counts as coming); one amber chip then says it and opens the pop-up again, with "I'm on time" to take
// it back. A read without the columns offers nothing.

/** The minutes a rider may say they will be late (the booking app's RL_MINS, the database's check). */
export const RL_MINS: readonly number[] = [10, 20, 30];
/** The kinds where everyone starts together, besides the rides that gather (the booking app's LTR_KINDS). */
const LTR_KINDS = new Set(["workshop", "event", "yoga", "defe5k", "ktri"]);

/** The moment to turn up that being late is counted from (epoch ms; the booking app's _ltrAt): a gathering ride's
 *  gathering, the start of a session where everyone starts together; null anywhere riders come any time. */
export function lateFrom(s: Pick<TicketSession, "date" | "times" | "gathers" | "kind">): number | null {
  if (!s.times) return null;
  const at = s.gathers || LTR_KINDS.has(s.kind) ? ksaAt(s.date, s.times[0]) : NaN;
  return Number.isFinite(at) ? at : null;
}

/** Running late may be said now (the booking app's _rlWin): from two hours before the time to turn up until an hour after
 *  the start. */
export function lateWindow(s: Pick<TicketSession, "date" | "times" | "gathers" | "kind">, m: { st: number }, now: number): boolean {
  const at = lateFrom(s);
  return at !== null && now >= at - 2 * 3600e3 && now < m.st + 3600e3;
}

/** The party's answer (its first rider's), when it was given for this date: the server takes one from three hours before
 *  the first time (the booking app's _rlMin); 0 for none. */
export function lateSaid(r: Pick<TicketRow, "lateMin" | "lateAt">, m: { go: number }): number {
  const at = r.lateMin ? Date.parse(r.lateAt ?? "") : NaN;
  return Number.isFinite(at) && at >= m.go - 3 * 3600e3 ? r.lateMin ?? 0 : 0;
}

/** What the ticket's "Still coming?" row shows (the booking app's _stcHtml): `ask` I'm coming / Can't come within its
 *  window, `ok` every waiting rider said yes, `late` the minutes the party said it will be late (its chip, which reopens the
 *  pop-up), `lateOn` Running late may be offered now; the session the answers go to and the booking Can't come opens. */
export type StillComing = { ask: boolean; ok: boolean; late: number; lateOn: boolean; sessionId: string; bookingId: string } | null;

/** What the ticket shows (the booking app's _stcHtml, drawn where `_held` and the first row waits): null nothing; else
 *  StillComing. `now` is the server's clock when it drew the page. */
export function stillComing(rows: TicketRow[], s: TicketSession | undefined, now: number, past = false): StillComing {
  if (past || !s || s.calledOff || !rows.length || !codeReady(rows, s)) return null;
  const st = rows.some((r) => r.status === "active") ? "active" : rows[0].status;
  if (st !== "waiting") return null;
  const L = rows.filter((r) => r.status === "waiting");
  if (!L.length) return null;
  const m = comingMoments(s);
  if (!m) return null;
  const ask = !L.some((r) => r.comingAt === undefined) && now >= m.go - DAY && now < m.st;
  const rlOn = !L.some((r) => r.lateMin === undefined);
  const lateOn = rlOn && lateWindow(s, m, now);
  if (!ask && !lateOn) return null;
  return { ask, ok: ask && L.every((r) => comingCounts(r.comingAt, m)), late: rlOn ? lateSaid(L[0], m) : 0, lateOn, sessionId: L[0].sessionId, bookingId: L[0].id };
}

/** The booking app's My Bookings at this booking's ticket (its reminder's link, read by _readStcTk), with no=1 so the
 *  app answers that ticket's own Can't come (_stcNo: the "Not coming?" box on a Saturday Social Ride, the cancel dialog
 *  elsewhere), in the page's language; null when the app's address cannot be read. */
export function comingCancelLink(bookings: string | null | undefined, bookingId: string, locale: string): string | null {
  if (!bookings || !ENTRY_ID.test(bookingId)) return null;
  try {
    const u = new URL(bookings);
    u.searchParams.set("tk", bookingId);
    u.searchParams.set("no", "1");
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

/** The Running late pick a ticket posts, read safely: {session, min} with a session's id and 10, 20 or 30 minutes, or null
 *  for "I'm on time"; else null. */
export function lateBody(body: unknown): { session: string; min: number | null } | null {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!b || typeof b.session !== "string" || !SESSION_ID.test(b.session)) return null;
  if (b.min !== null && !(typeof b.min === "number" && RL_MINS.includes(b.min))) return null;
  return { session: b.session, min: b.min };
}

/** booking_late's answer as the route says it: ok (the minutes, when, and the party's first yes, which a late answer gives),
 *  or why not - "closed" (called off, outside its time, a kind without a time to turn up, the party checked in), "none"
 *  (no seated booking there), "signin" (the token is no longer the account's) or "generic" for anything else. */
export function lateAnswer(data: unknown): { ok: true; min: number | null; at: string | null; coming: string | null } | { ok: false; error: "closed" | "none" | "signin" | "generic" } {
  const d = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  if (d?.ok === true) {
    const min = typeof d.late_min === "number" && RL_MINS.includes(d.late_min) ? d.late_min : null;
    return { ok: true, min, at: min && typeof d.late_at === "string" ? d.late_at : null, coming: typeof d.coming_at === "string" ? d.coming_at : null };
  }
  const e = d?.error;
  return { ok: false, error: e === "closed" || e === "none" ? e : e === "denied" ? "signin" : "generic" };
}
