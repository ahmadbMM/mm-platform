import { onBike, weekOf, type RecordSession } from "./ride-record";
import type { TicketRow } from "./tickets";

// My records on My Account's Stats, as the booking app's Account > Stats draws them (_recHtml, rentals d971a564; the user,
// 2026-11-18: "My records in Stats: most Saturdays in a row, best month, and bike types and routes tried. Only the member
// sees them. It stays in Stats because the streak line on home was removed for good."). For every rider with two or more
// finished sessions (checked in or done), counted from the account's own bookings, one row per session (the rider's own,
// the lowest number, as Your rides counts them); nothing more is read than the record already reads, save the type of a
// bike handed over on a booking made for no type. Each tile is a number, its name and at most one value:
// - Saturdays in a row: the longest run ever of weeks (Sunday to Saturday, weekOf) each with a finished Saturday ride,
//   from 2, with the month it ended (the first of equal runs). Never a current streak.
// - Sessions in your best month: the month with the most finished sessions of any kind, from 2, the earliest of a tie,
//   with its month.
// - Bike types tried: the fleet's types (the app's BIKE_INFO) ridden on a bike session, "3 of 5"; the type booked, or for
//   a booking made for no type (Any) the type of the bike handed over; a pool or other bike-free session never counts.
// - Routes ridden: the routes (sessions.route_slug) of finished sessions, from 1.
// Plain logic, so it can be tested; the account page hands in the rows, the sessions and the bikes' types.

/** The fleet's bike types, in the booking app's BIKE_INFO order: "n of 5". */
export const FLEET_TYPES = ["Road", "Road Carbon", "Hybrid", "Mountain", "Kids"] as const;

export type MyRecords = {
  /** The longest run of Saturdays, and the day it ended ("YYYY-MM-DD"); null under two. */
  sat: { n: number; end: string } | null;
  /** The best month ("YYYY-MM") and its sessions; null under two. */
  month: { n: number; ym: string } | null;
  /** Fleet types ridden, of FLEET_TYPES.length; 0: no tile. */
  types: number;
  /** Routes ridden; 0: no tile. */
  routes: number;
};

/** The rows the tiles count: checked in or done, one a session, the rider's own (the lowest number). */
function finished(rows: TicketRow[]): TicketRow[] {
  const by = new Map<string, TicketRow>();
  for (const r of rows) {
    if (r.status !== "done" && r.status !== "active") continue;
    const c = by.get(r.sessionId);
    if (!c || (r.queueNum ?? 0) < (c.queueNum ?? 0)) by.set(r.sessionId, r);
  }
  return [...by.values()];
}

/** The tiles, or null when there is no card: fewer than two finished sessions, or no tile to show. `bikeType(id)`: the type
 *  of a bike handed over (null when unknown). */
export function myRecords(rows: TicketRow[], sessions: Map<string, RecordSession>, bikeType: (id: string) => string | null = () => null): MyRecords | null {
  const N = finished(rows);
  if (N.length < 2) return null;
  const day = (r: TicketRow) => r.date.slice(0, 10);
  // Saturdays in a row: the latest day each week held, then the longest run of weeks one after another
  const W = new Map<number, string>();
  for (const r of N) {
    const d = day(r);
    if (sessions.get(r.sessionId)?.kind !== "saturday" || !/^\d{4}-\d\d-\d\d$/.test(d)) continue;
    const w = weekOf(d), was = W.get(w);
    if (!was || d > was) W.set(w, d);
  }
  let best = 0, end = "", run = 0, prev = Number.NaN;
  for (const w of [...W.keys()].sort((a, b) => a - b)) {
    run = w === prev + 1 ? run + 1 : 1;
    prev = w;
    if (run > best) { best = run; end = W.get(w) ?? ""; }
  }
  // the best month: the most sessions of any kind, the earliest of a tie
  const M = new Map<string, number>();
  for (const r of N) { const m = day(r).slice(0, 7); if (/^\d{4}-\d\d$/.test(m)) M.set(m, (M.get(m) ?? 0) + 1); }
  let bm = "";
  for (const m of [...M.keys()].sort()) if (!bm || (M.get(m) ?? 0) > (M.get(bm) ?? 0)) bm = m;
  // the fleet's types ridden on a bike session: the type booked, else the bike handed over's
  const fleet: readonly string[] = FLEET_TYPES;
  const types = new Set(N.filter((r) => onBike(r.sessionId, sessions))
    .map((r) => (r.type !== "Any" ? r.type : r.bikeId ? bikeType(r.bikeId) ?? "" : ""))
    .filter((t) => fleet.includes(t)));
  const routes = new Set(N.map((r) => sessions.get(r.sessionId)?.route).filter((x): x is string => !!x));
  const out: MyRecords = {
    sat: best > 1 ? { n: best, end } : null,
    month: bm && (M.get(bm) ?? 0) > 1 ? { n: M.get(bm) ?? 0, ym: bm } : null,
    types: types.size, routes: routes.size,
  };
  return out.sat || out.month || out.types || out.routes ? out : null;
}
