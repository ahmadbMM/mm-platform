import { ENTRY_ID } from "./rating";

// The DEFE 5KM Run's "Have you registered for the race?" (the owner, 2026-10-18; the booking app's
// _defeRegHtml / _defeRegSet): a runner answers Yes or No on their ticket, saved on the booking
// (queue_entries.race_reg) through customer_set_race_reg (app/api/account/race-reg). The place is
// booked whatever the answer; it tells staff who still has to register on Race Arabia.

export type RaceRegAnswer = "yes" | "no";

/** The answer a ticket posts, read safely: {entryId, answer} with a booking id and 'yes' or 'no', else null. */
export function raceRegBody(body: unknown): { entryId: string; answer: RaceRegAnswer } | null {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!b || typeof b.entryId !== "string" || !ENTRY_ID.test(b.entryId)) return null;
  const a = typeof b.answer === "string" ? b.answer.trim().toLowerCase() : "";
  return a === "yes" || a === "no" ? { entryId: b.entryId, answer: a } : null;
}

/** What the question shows: the note that the runner is registered (with Change), or the question, with
 *  the way to Race Arabia once the answer is No. `asking` is the runner having pressed Change. */
export function raceRegView(answer: RaceRegAnswer | null, asking: boolean): "done" | "ask" | "askNo" {
  if (answer === "yes" && !asking) return "done";
  return answer === "no" ? "askNo" : "ask";
}
