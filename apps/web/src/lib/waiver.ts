import { WAIVER_VERSIONS, type WaiverKind } from "@/content/waivers";
import type { TicketSession } from "./tickets";

// A desk-added booking's waiver (the owner, 2026-10-04: "for the added riders and walked in ...
// force them to accept the waiver of the session as a pop up"), as the booking app asks for it
// (_pendingWaiver, acceptWaiverGate). A booking made in the booking app carries the waiver it was
// agreed under (waiver_version); a rider staff added (add rider, add group, a walk-in) has none, so
// every page puts up that ride and its waiver until the rider agrees (WaiverGateLoader,
// app/api/account/pending-waiver). Agreeing stamps every row of that ride on the account that has
// no waiver yet (customer_accept_waiver, migration 20261004173000 in the rentals repo). Only rides
// from today on: a ride already ridden is not signed for after the fact. The plain logic, so it can
// be tested.

export const SESSION_ID = /^[A-Za-z0-9_-]{1,64}$/;
const LIVE = new Set(["waiting", "waitlist", "active", "done"]);
const S = (v: unknown) => (typeof v === "string" ? v : "");
type Row = Record<string, unknown>;

/** The waiver a session is agreed under (_waiverKind): the ride's where bikes are handed out, the
 *  swim's for the pool, the activity waiver for anything else (the workshop, an event). */
export const waiverKind = (s: Pick<TicketSession, "kind" | "bikes">): WaiverKind => (s.bikes ? "ride" : s.kind === "swim" ? "swim" : "activity");
export const waiverVersion = (s: Pick<TicketSession, "kind" | "bikes">): string => WAIVER_VERSIONS[waiverKind(s)];

/** One of the account's own live rows (the row's customer, when my_bookings names it, is the account). */
const ownLive = (r: Row, customerId: string) =>
  LIVE.has(S(r.status)) && (typeof r.customer_id !== "string" || r.customer_id === customerId);

/** The rides the account still has to agree a waiver for, soonest first: a session with a live row
 *  of the account's that says it has none (the column is there and empty; a read without it asks
 *  nothing), on a ride day from today on (Riyadh). `skip` leaves out rides agreed to on this page
 *  already, so a ride the database did not stamp can never hold the rider in a loop. */
export function pendingWaivers(rows: Row[], today: string, customerId: string, skip: readonly string[] = []): Array<{ sessionId: string; date: string }> {
  const by = new Map<string, string>();
  for (const r of rows) {
    if (!("waiver_version" in r) || (r.waiver_version !== null && r.waiver_version !== "") || !ownLive(r, customerId)) continue;
    const date = S(r.session_date).slice(0, 10), sid = S(r.session_id);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today || !SESSION_ID.test(sid) || skip.includes(sid) || by.has(sid)) continue;
    by.set(sid, date);
  }
  return [...by].map(([sessionId, date]) => ({ sessionId, date })).sort((a, b) => a.date.localeCompare(b.date) || a.sessionId.localeCompare(b.sessionId));
}

/** Who is on the booking, as its ticket lists them: every live row of the ride on the account, in
 *  number order. A ride staff approve never shows a number. */
export function waiverRiders(rows: Row[], sessionId: string, customerId: string, approval: boolean): Array<{ name: string; num: number | null }> {
  const qn = (r: Row) => (typeof r.queue_num === "number" && Number.isFinite(r.queue_num) ? r.queue_num : null);
  return rows
    .filter((r) => S(r.session_id) === sessionId && ownLive(r, customerId))
    .sort((a, b) => (qn(a) ?? 0) - (qn(b) ?? 0))
    .map((r) => ({ name: S(r.name).trim(), num: approval ? null : qn(r) }));
}

/** A database without the function (PostgREST's PGRST202, Postgres's 42883): the booking app's _rpcAbsent. */
export const rpcAbsent = (r: { status: number; message: string; code?: string }) =>
  r.status === 404 || r.code === "PGRST202" || r.code === "42883" || /pgrst202|could not find the function|function \S+ does not exist/i.test(r.message);

/** What customer_accept_waiver's answer means (lib/account.ts rpcServer's shape): ok (the rows it
 *  stamped, 0 when another device got there first), absent (the migration is not applied: the rider
 *  is let through, never held), signin (-1: the token is no longer accepted), refused (the
 *  database said no) or network (no answer). */
export type AcceptAnswer = "ok" | "absent" | "signin" | "refused" | "network";
export function acceptAnswer(r: { status: number; data: unknown; message: string; code?: string }): AcceptAnswer {
  if (r.status === 0 || r.status >= 500) return "network";
  if (r.status >= 400) return rpcAbsent(r) ? "absent" : "refused";
  if (typeof r.data !== "number" || !Number.isFinite(r.data)) return "network";
  return r.data < 0 ? "signin" : "ok";
}
