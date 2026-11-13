import { onBike, recordNights, type RecordSession } from "./ride-record";
import { ticketGroups, ticketRow, type TicketRow } from "./tickets";

// The first five rides (the booking app's new features build F1, the owner 2026-11-13; its P5, _p5N and _p5Fin): a
// rider with fewer than five rides ridden, counted as Your rides counts them (ride nights, bike sessions only, completed:
// lib/ride-record.ts recordNights), is on one path of five marks, the first ride one of them. After a bike ride is rated,
// the rating's last screen (app/api/account/rating-fin, components/account/RatingGate.tsx) shows it in place of the
// month's challenge, to members and non-members alike, with Book when nothing is booked ahead. From the fifth ride on
// every screen is as it was. Plain logic, so it can be tested; the route reads the bookings and their sessions' kinds.

type Row = Record<string, unknown>;

/** The path's length (P5). */
export const P5 = 5;

/** The sessions the count must know (whether each has bikes, and whether it costs nothing): those of the account's
 *  finished bookings, the ride just rated among them. */
export function firstFiveIds(rows: Row[]): string[] {
  return [...new Set(rows.map(ticketRow).filter((r): r is TicketRow => !!r && r.status === "done").map((r) => r.sessionId))];
}

/** The path after the ride `ratedId` is rated: n rides of tg, and `book` when nothing is booked ahead (lib/tickets.ts
 *  ticketGroups, the booking app's _bookingAhead), for the screen's Book button. Null for a session without a bike (not
 *  a ride, so no path), and for a rider with no ride yet or with five or more. */
export type FirstFive = { n: number; tg: number; book: boolean };
export function firstFive(rows: Row[], ratedId: string, sessions: Map<string, RecordSession>, today: string): FirstFive | null {
  const all = rows.map(ticketRow).filter((r): r is TicketRow => !!r);
  const rated = all.find((r) => r.id === ratedId);
  if (!rated || !onBike(rated.sessionId, sessions)) return null;
  const n = recordNights(all, sessions).length;
  return n > 0 && n < P5 ? { n, tg: P5, book: ticketGroups(rows, today).length === 0 } : null;
}
