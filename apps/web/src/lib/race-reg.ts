import { SESSION_ID } from "./waiver";
import { isDefe, type TicketSession } from "./tickets";
import { ENTRY_ID } from "./rating";

// The DEFE 5KM Run's "Have you registered for the race?" (the owner, 2026-10-18; the booking app's
// _defeRegHtml / _defeRegSet): a runner answers Yes or No on their ticket, saved on the booking
// (queue_entries.race_reg) through customer_set_race_reg (app/api/account/race-reg). The place is
// booked whatever the answer; it tells staff who still has to register with Defe.

export type RaceRegAnswer = "yes" | "no";

/** The answer a ticket posts, read safely: {entryId, answer} with a booking id and 'yes' or 'no', else null. */
export function raceRegBody(body: unknown): { entryId: string; answer: RaceRegAnswer } | null {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!b || typeof b.entryId !== "string" || !ENTRY_ID.test(b.entryId)) return null;
  const a = typeof b.answer === "string" ? b.answer.trim().toLowerCase() : "";
  return a === "yes" || a === "no" ? { entryId: b.entryId, answer: a } : null;
}

/** What the question shows: the note that the runner is registered (with Change), or the question, with
 *  the way to Defe's registration page once the answer is No. `asking` is the runner having pressed Change. */
export function raceRegView(answer: RaceRegAnswer | null, asking: boolean): "done" | "ask" | "askNo" {
  if (answer === "yes" && !asking) return "done";
  return answer === "no" ? "askNo" : "ask";
}

// ── The pop-up (the owner, 2026-10-18: "i want it as an unskippable pop up"; the booking app's
// _pendingRaceReg / renderRaceGate): every page asks a signed-in runner whose live place on a Defe run
// from today on has no answer, or No (asked again on each visit until Yes; Done lets a No through for
// this visit, `skip`). RaceGateLoader, app/api/account/pending-race-reg.

const LIVE = new Set(["waiting", "waitlist", "active"]);
const S = (v: unknown) => (typeof v === "string" ? v : "");
type Row = Record<string, unknown>;
export type PendingRaceRegRow = { entryId: string; sessionId: string; date: string; answer: RaceRegAnswer | null };

/** The account's live rows from today on (Riyadh) whose answer is not Yes: the column is there (a read
 *  without it, before the migration, asks nothing), the row not passed on this visit (`skip`). */
export function raceRegCandidates(rows: Row[], today: string, customerId: string, skip: readonly string[] = []): PendingRaceRegRow[] {
  const out: PendingRaceRegRow[] = [];
  for (const r of rows) {
    if (!("race_reg" in r) || r.race_reg === "yes") continue;
    if (!LIVE.has(S(r.status)) || (typeof r.customer_id === "string" && r.customer_id !== customerId)) continue;
    const date = S(r.session_date).slice(0, 10), sid = S(r.session_id), id = S(r.id);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today || !SESSION_ID.test(sid) || !ENTRY_ID.test(id) || skip.includes(id)) continue;
    out.push({ entryId: id, sessionId: sid, date, answer: r.race_reg === "no" ? "no" : null });
  }
  return out;
}

/** The places still to answer, soonest first: the candidates on a session the account can see that is the DEFE 5KM Run. */
export function pendingRaceRegs(rows: Row[], sessions: ReadonlyMap<string, Pick<TicketSession, "kind">>, today: string, customerId: string, skip: readonly string[] = []): PendingRaceRegRow[] {
  return raceRegCandidates(rows, today, customerId, skip)
    .filter((x) => isDefe(sessions.get(x.sessionId)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.entryId.localeCompare(b.entryId));
}
