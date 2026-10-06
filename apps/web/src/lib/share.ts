import { RUN_KMS, type TicketSession } from "./tickets";
import { SESSION_ID } from "./waiver";

// Run for Her: a runner agrees before their details go to Sela and Jeddah Yacht Club (the owner,
// 2026-10-06: "add a pop up for all customers that are booking or already have booked or even added
// to the run for her and force them to approve it, that we will share the following info about them
// with Sela/JYC in order to participate in the race"; "its for the run for her participants only"),
// as the booking app asks for it (_pendingShare). A runner who books in the booking app agrees on its
// runner step; one who booked before that, or whom staff added, has no stamp
// (queue_entries.data_share_at), so every page puts up that run until they agree (ShareGateLoader,
// app/api/account/pending-share). Agreeing stamps every live row of the account on that run that has
// none (customer_accept_share, migration 20261006180000 in the rentals repo; its answer reads as the
// waiver's, lib/waiver.ts acceptAnswer). Only runs from today on, and only rows still to be run: a run
// already over is not agreed to after the fact. The plain logic, so it can be tested.

const LIVE = new Set(["waiting", "waitlist", "active"]);
const S = (v: unknown) => (typeof v === "string" ? v : "");
type Row = Record<string, unknown>;
export type PendingShareRow = { sessionId: string; date: string; km: number | null };

/** A session whose runners' details go to the race's hosts: Run for Her, by the session's kind. */
export const isRun = (s: Pick<TicketSession, "kind"> | undefined): boolean => s?.kind === "runher";

/** The distance a runner picked (run_km), when it is one the booking app takes (3 or 5 km). */
const kmOf = (r: Row): number | null => {
  const n = typeof r.run_km === "number" ? r.run_km : typeof r.run_km === "string" && r.run_km.trim() ? Number(r.run_km) : NaN;
  return RUN_KMS.includes(n) ? n : null;
};

/** The account's live rows, from today on (Riyadh), that say they have not agreed: the column is
 *  there and empty (a read without it, before the migration, asks nothing), one entry per session. */
function unagreed(rows: Row[], today: string, customerId: string, skip: readonly string[]): Map<string, PendingShareRow> {
  const by = new Map<string, PendingShareRow>();
  for (const r of rows) {
    if (!("data_share_at" in r) || (r.data_share_at !== null && r.data_share_at !== "")) continue;
    if (!LIVE.has(S(r.status)) || (typeof r.customer_id === "string" && r.customer_id !== customerId)) continue;
    const date = S(r.session_date).slice(0, 10), sid = S(r.session_id);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today || !SESSION_ID.test(sid) || skip.includes(sid)) continue;
    const had = by.get(sid);
    if (!had) by.set(sid, { sessionId: sid, date, km: kmOf(r) });
    else if (had.km === null) had.km = kmOf(r);
  }
  return by;
}

/** The sessions to read to know which of them are runs: every one the account could still be asked
 *  about. The column is on every row once the migration is in, so most are rides, not runs. */
export function shareCandidates(rows: Row[], today: string, customerId: string, skip: readonly string[] = []): string[] {
  return [...unagreed(rows, today, customerId, skip).keys()];
}

/** The runs the account still has to agree for, soonest first, each with the distance its runner
 *  picked (null when none was): a session of the candidates that the account can see and that is
 *  Run for Her. A session the site cannot see, or any other kind, asks nothing. `skip` leaves out runs
 *  agreed to on this page already, so a run the database did not stamp can never hold the runner in a loop. */
export function pendingShares(rows: Row[], sessions: ReadonlyMap<string, Pick<TicketSession, "kind">>, today: string, customerId: string, skip: readonly string[] = []): PendingShareRow[] {
  return [...unagreed(rows, today, customerId, skip).values()]
    .filter((x) => isRun(sessions.get(x.sessionId)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.sessionId.localeCompare(b.sessionId));
}
