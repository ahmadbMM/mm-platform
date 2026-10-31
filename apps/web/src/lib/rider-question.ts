// A question staff put on one rider's account (2026-11-01; the booking app's rider_questions, rentals
// migration 20261101030000, and _riderQLoad / renderRiderQ): every page asks a signed-in rider in a
// pop-up with a box for the answer (QuestionGateLoader, app/api/account/question). Send saves the answer
// once through customer_question_answer; Later lets this visit through, and the next visit asks again.

export type RiderQuestion = { id: number; question: string };
export const ANSWER_MAX = 1000;

const qid = (v: unknown): number | null => (typeof v === "number" && Number.isSafeInteger(v) && v > 0 ? v : null);

/** The open questions customer_questions returns, read safely and in its order, minus those passed with
 *  Later on this visit (`skip`). Anything that is not a list (a bad token answers null) asks nothing. */
export function openQuestions(data: unknown, skip: number[] = []): RiderQuestion[] {
  if (!Array.isArray(data)) return [];
  const out: RiderQuestion[] = [];
  for (const x of data) {
    const r = x && typeof x === "object" ? (x as Record<string, unknown>) : null;
    const id = r && qid(r.id);
    const question = r && typeof r.question === "string" ? r.question.trim() : "";
    if (id && question && !skip.includes(id)) out.push({ id, question });
  }
  return out;
}

/** The `skip` list a pop-up sends (ids passed with Later), read safely. */
export function skipIds(v: string | null): number[] {
  return (v || "").split(",").map(Number).filter((n) => qid(n) !== null).slice(0, 20);
}

/** The answer a pop-up posts, read safely: {id, answer} with a question id and 1 to 1000 characters once
 *  trimmed, else null. */
export function questionAnswerBody(body: unknown): { id: number; answer: string } | null {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const id = b && qid(b.id);
  const answer = b && typeof b.answer === "string" ? b.answer.trim() : "";
  return id && answer && answer.length <= ANSWER_MAX ? { id, answer } : null;
}
