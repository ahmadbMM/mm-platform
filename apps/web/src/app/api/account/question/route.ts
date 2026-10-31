import { ACCOUNT_COOKIE, decodeSession, sameOrigin } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { emAbsent } from "@/lib/emergency";
import { cookieValue } from "@/lib/live";
import { withinLimit } from "@/lib/rate-limit";
import { openQuestions, questionAnswerBody, skipIds } from "@/lib/rider-question";

// A question staff put on one rider's account (lib/rider-question.ts; the booking app's rider_questions).
// GET /api/account/question[?skip=id,id]: the first open question of the signed-in account, for the pop-up
// every page shows once no race question waits (QuestionGateLoader): {signedIn, question: {id, question} |
// null}. Signed out it answers from the cookie alone; a database without the function, or a token that is
// no longer the account's, asks nothing. `skip` is the questions passed with Later on this visit.
// POST {id, answer}: saves the answer through customer_question_answer with the account cookie's id and
// token. Answers {ok: true}, or {ok: false, error}: "invalid" for a body it cannot read, "absent" when the
// database has no such function yet, "signin" when the account is signed out, "refused" when the database
// answered false (answered already, or not this account's question), "busy" or "generic". Only this
// site's pages may post; a connection asks 30 times a minute at most.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store, private" } });

export async function GET(req: Request) {
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ signedIn: false });
  if (!(await withinLimit(req, "account-check"))) return json({ error: "busy" }, 429);
  const skip = skipIds(new URL(req.url).searchParams.get("skip"));
  const r = await rpcServer<unknown>("customer_questions", { p_id: acct.id, p_token: acct.token });
  if (r.status === 0 || r.status >= 400) return json({ signedIn: true, question: null });
  return json({ signedIn: true, question: openQuestions(r.data, skip)[0] ?? null });
}

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ ok: false, error: "signin" }, 401);
  if (!(await withinLimit(req, "account-check"))) return json({ ok: false, error: "busy" }, 429);
  let body: unknown = null;
  try { body = await req.json(); } catch { /* empty body */ }
  const b = questionAnswerBody(body);
  if (!b) return json({ ok: false, error: "invalid" }, 400);
  const r = await rpcServer<boolean>("customer_question_answer", { p_id: acct.id, p_token: acct.token, p_qid: b.id, p_answer: b.answer });
  if (r.status === 0 || r.status >= 500) return json({ ok: false, error: "generic" }, 502);
  if (r.status >= 400) {
    if (emAbsent(r)) return json({ ok: false, error: "absent" }, 404);
    return json({ ok: false, error: /RATE_LIMITED/.test(r.message) ? "busy" : "generic" }, /RATE_LIMITED/.test(r.message) ? 429 : 502);
  }
  // false: answered already (on another device), or the token or question is no longer the account's
  if (r.data !== true) return json({ ok: false, error: "refused" }, 409);
  return json({ ok: true });
}
