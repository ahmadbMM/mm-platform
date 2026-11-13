import { ksaAt, type TicketRow, type TicketSession } from "./tickets";
import { ENTRY_ID } from "./rating";

// "Report a bike problem" on My Account's ticket (the booking app's new features build F15, 2026-11-13: _brpEnd, _brpRows,
// _brpHtml and bike-report.js; rentals migration 20261114081500). A rider checked in with a fleet bike has one button on the
// ticket, until 3 hours after the session's last time; it opens a centred pop-up with the faults and an optional note of
// 300 characters, sent through bike_report (app/api/account/bike-report) to the staff Workshop list. After a report one
// quiet chip stands where the button was for the ten minutes in which the server refuses another; a refusal by the limits
// (one a booking every 10 minutes, 5 a booking, 8 an account a day) shows the same chip and is never said. A read without
// the column shows nothing.

/** The faults, as the database names them (bike_reports.fault), in the pop-up's order. */
export const BRP_FAULTS = ["brakes", "gears", "tyre", "chain", "saddle", "lights", "other"] as const;
export type BrpFault = (typeof BRP_FAULTS)[number];
/** The note's length at most. */
export const BRP_NOTE_MAX = 300;
/** How long the chip stands after a report (the server's one-a-booking limit). */
export const BRP_QUIET_MS = 10 * 6e4;
/** How long after the session's last time a report is taken. */
export const BRP_AFTER_MS = 3 * 3600e3;

/** The session's last moment as the server reads it (the booking app's _brpEnd, _session_window): its window's end, an
 *  end before its start being the next day's; a single time is its own end; a session without times runs 9 to 11. */
export function reportEnd(s: Pick<TicketSession, "date" | "times">): number {
  const [a, z] = s.times ?? ["09:00", "11:00"];
  const from = ksaAt(s.date, a), to = ksaAt(s.date, z);
  return Number.isFinite(to) ? (to < from ? to + 864e5 : to) : from;
}

/** A row's bikes: every one on it, the first being bikeId. */
export const rowBikes = (r: Pick<TicketRow, "bikeId" | "bikeIds">): string[] => r.bikeIds ?? (r.bikeId ? [r.bikeId] : []);

/** The booking's rows that may report now (the booking app's _brpRows): checked in or done, with a bike, carrying the
 *  column, on a bike session known to the page, until 3 hours after its last time. */
export function reportRows(rows: TicketRow[], s: TicketSession | undefined, now: number): TicketRow[] {
  if (!s || !s.bikes || !(now < reportEnd(s) + BRP_AFTER_MS)) return [];
  return rows.filter((r) => (r.status === "active" || r.status === "done") && r.bikeReportAt !== undefined && rowBikes(r).length > 0);
}

/** One bike the pop-up offers: the booking it is on, the bike, and its rider's name (the account's own party). */
export type BrpOption = { booking: string; bike: string; who: string };
/** What the ticket shows (the booking app's _brpHtml): null nothing; else the bikes the pop-up offers, and when each of
 *  those bookings last reported (epoch milliseconds, by booking; brpChipUntil reads it). */
export function bikeReport(rows: TicketRow[], s: TicketSession | undefined, now: number): { options: BrpOption[]; reported: Record<string, number> } | null {
  const L = reportRows(rows, s, now);
  if (!L.length) return null;
  const reported: Record<string, number> = {};
  for (const r of L) {
    const at = r.bikeReportAt ? Date.parse(r.bikeReportAt) : NaN;
    if (Number.isFinite(at)) reported[r.id] = at;
  }
  return { options: L.flatMap((r) => rowBikes(r).map((bike) => ({ booking: r.id, bike, who: r.name }))), reported };
}

/** When the chip gives way to the button again: the chip stands while every booking the pop-up offers reported in the last
 *  ten minutes (a party's other rider still has the button); null when the button shows now. */
export function brpChipUntil(bookings: readonly string[], reported: Readonly<Record<string, number>>, now: number): number | null {
  const ends = [...new Set(bookings)].map((b) => (typeof reported[b] === "number" ? reported[b] + BRP_QUIET_MS : NaN));
  return ends.length > 0 && ends.every((t) => Number.isFinite(t) && t > now) ? Math.min(...ends) : null;
}

/** A report a ticket posts, read safely: {booking, fault, note?, bike?}; the note's spaces tidied and cut to 300, empty as
 *  null; null for a body it cannot take. */
export function bikeReportBody(body: unknown): { booking: string; fault: BrpFault; note: string | null; bike: string | null } | null {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!b || typeof b.booking !== "string" || !ENTRY_ID.test(b.booking)) return null;
  const fault = BRP_FAULTS.find((f) => f === b.fault);
  if (!fault) return null;
  if (b.bike != null && (typeof b.bike !== "string" || !ENTRY_ID.test(b.bike))) return null;
  if (b.note != null && typeof b.note !== "string") return null;
  const note = typeof b.note === "string" ? b.note.replace(/\s+/g, " ").trim().slice(0, BRP_NOTE_MAX).trim() : "";
  return { booking: b.booking, fault, note: note || null, bike: typeof b.bike === "string" ? b.bike : null };
}

/** bike_report's answer as the route says it: ok, or why not - "limit" (refused quietly), "none" (not the rider's booking,
 *  not checked in, or no such bike), "closed" (the time to report is over), "signin" (the token is no longer the account's)
 *  or "generic". */
export function bikeReportAnswer(data: unknown): { ok: true; at: string | null } | { ok: false; error: "limit" | "none" | "closed" | "signin" | "generic" } {
  const d = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  if (d?.ok === true) return { ok: true, at: typeof d.at === "string" ? d.at : null };
  const e = d?.error;
  return { ok: false, error: e === "limit" || e === "none" || e === "closed" ? e : e === "denied" ? "signin" : "generic" };
}
