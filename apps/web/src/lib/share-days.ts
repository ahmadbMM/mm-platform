// The day a badge earned by riding was reached, for its picture (lib/share-picture.ts; the booking app's badge-share.js
// _shrRodeOn, new features build F12, 2026-11-13). Read on the server from the account's own bookings, as the badge
// list is (lib/ride-record.ts), and handed to the badge pop-up as days, so the browser carries none of this.
import { rideCompleted, type TicketRow } from "./tickets";
import { onBike, type RecordSession } from "./ride-record";

// The two ladders that count nights (the app's SHR_NIGHTS and SHR_SATS): the rider's bike rides (First Lap to Corniche
// 25) and their Saturday social rides (Rolling Start to Hall of Fame), counted as the badge list counts them, a night once. The day is that of the night that made the count; a night without a day
// leaves it out rather than guess. Any other badge earned by riding has no one day the site can name.
const NIGHTS: Record<string, number> = { first_lap: 1, regular: 5, podium: 10, corniche25: 25 };
const SATS: Record<string, number> = { rolling_start: 1, slipstream: 5, paceline: 10, peloton: 25, grand_tour: 50, hall_of_fame: 100 };
/** Every one of those badges reached, by slug, with its day ("YYYY-MM-DD"). */
export function shareDays(rows: TicketRow[], sessions: Map<string, RecordSession>): Record<string, string> {
  const rode = (r: TicketRow) => rideCompleted(r, !!sessions.get(r.sessionId)?.freeRide) || (r.type === "Own" && (r.status === "done" || r.status === "active"));
  const all = new Map<string, string>(), sat = new Map<string, string>();
  for (const r of rows) {
    if (!onBike(r.sessionId, sessions) || !rode(r)) continue;
    const d = /^\d{4}-\d\d-\d\d$/.test(String(r.date).slice(0, 10)) ? String(r.date).slice(0, 10) : "";
    all.set(r.sessionId, d);
    if (sessions.get(r.sessionId)?.kind === "saturday") sat.set(r.sessionId, d);
  }
  const out: Record<string, string> = {};
  for (const [L, by] of [[NIGHTS, all], [SATS, sat]] as const) {
    const days = [...by.values()].sort();
    for (const [slug, n] of Object.entries(L)) if (days.length >= n && days[0] !== "") out[slug] = days[n - 1];
  }
  return out;
}
