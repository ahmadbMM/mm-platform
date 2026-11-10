import { WAIVER_VERSIONS, type WaiverKind } from "@/content/waivers";
import { ahHold } from "./arena";
import { satNumOk, ticketRow, type TicketRow, type TicketSession } from "./tickets";

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
/** What the pop-up sends back as agreed on this page: a ride, or on a Blood Donation event one role's rows of it
 *  ("<session>.donor", "<session>.visitor"): each role agrees its own words, one after the other. */
export const SKIP_ID = /^[A-Za-z0-9_-]{1,64}(\.(donor|visitor))?$/;
/** A waiver version as the pop-up sends one back: every version the booking app has stamped has this
 *  shape ("2026-10-v3", "swim-2026-10-v3"). One that is no longer the ride's own - a deploy bumped it
 *  while the pop-up stood open - is answered "changed", so the pop-up asks again with the current
 *  words; only a version of another shape is refused as invalid. */
export const WAIVER_VERSION_SHAPE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,47}$/;
const LIVE = new Set(["waiting", "waitlist", "active", "done"]);
const S = (v: unknown) => (typeof v === "string" ? v : "");
type Row = Record<string, unknown>;
/** A Blood Donation row's role (blood_role, rentals 20261105140000): a visitor, else a donor. */
export type BloodRole = "donor" | "visitor";
const roleOf = (r: Row): BloodRole => (r.blood_role === "visitor" ? "visitor" : "donor");
const unsigned = (r: Row) => "waiver_version" in r && (r.waiver_version === null || r.waiver_version === "");
const qn = (r: Row) => (typeof r.queue_num === "number" && Number.isFinite(r.queue_num) ? r.queue_num : null);

/** The waiver a session is agreed under (_waiverKind): the Blood Donation event's own agreement ("there is no
 *  activity involved", the owner, 2026-11-03), the ride's where bikes are handed out, the swim's for the pool, the
 *  activity waiver for anything else (the workshop, an event). */
export const waiverKind = (s: Pick<TicketSession, "kind" | "bikes">): WaiverKind => (s.kind === "blood" ? "blood" : s.bikes ? "ride" : s.kind === "swim" ? "swim" : "activity");
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
    if (!unsigned(r) || !ownLive(r, customerId)) continue;
    const date = S(r.session_date).slice(0, 10), sid = S(r.session_id);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today || !SESSION_ID.test(sid) || skip.includes(sid) || skip.includes(`${sid}.${roleOf(r)}`) || by.has(sid)) continue;
    by.set(sid, date);
  }
  return [...by].map(([sessionId, date]) => ({ sessionId, date })).sort((a, b) => a.date.localeCompare(b.date) || a.sessionId.localeCompare(b.sessionId));
}

/** The account's live rows of a ride, in number order (the booking app's _wgRows). */
const rideRows = (rows: Row[], sessionId: string, customerId: string) =>
  rows.filter((r) => S(r.session_id) === sessionId && ownLive(r, customerId)).sort((a, b) => (qn(a) ?? 0) - (qn(b) ?? 0));

/** On a Blood Donation event, whose agreement the pop-up asks for (the booking app's _wgRow): the role of the first row
 *  with no waiver yet, not one agreed to on this page. A donor and a visitor read different words, each stamped with
 *  its own version (bug hunt 2026-11-10: the visitor's was asked whenever any row of the event was a visitor's). */
export function waiverRole(rows: Row[], sessionId: string, customerId: string, skip: readonly string[] = []): BloodRole {
  const r = rideRows(rows, sessionId, customerId).find((x) => unsigned(x) && !skip.includes(`${sessionId}.${roleOf(x)}`));
  return r ? roleOf(r) : "donor";
}

/** Who is on the booking, as its ticket lists them: every live row of the ride on the account (on a Blood Donation
 *  event, those of the role asked), in number order. Numbers hide where the ticket hides them: a ride staff approve
 *  until a Saturday ride's list is out to a rider on it (satNumOk), an Arena Heros place until it is paid (ahHold). */
export function waiverRiders(rows: Row[], sessionId: string, customerId: string, s: TicketSession, role?: BloodRole): Array<{ name: string; num: number | null }> {
  const live = rideRows(rows, sessionId, customerId);
  const t = live.map(ticketRow).filter((x): x is TicketRow => !!x);
  const hide = (s.approval && !satNumOk(t, s)) || (s.kind === "arena" && ahHold(t));
  return live
    .filter((r) => !role || roleOf(r) === role)
    .map((r) => ({ name: S(r.name).trim(), num: hide ? null : qn(r) }));
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
