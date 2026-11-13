import { ACCOUNT_COOKIE, decodeSession, sameOrigin } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { emAbsent } from "@/lib/emergency";
import { cookieValue } from "@/lib/live";
import { withinLimit } from "@/lib/rate-limit";
import { comingAnswer, comingBody } from "@/lib/still-coming";

// POST /api/account/coming {session}: "I'm coming" on a ticket's "Still coming?" (TicketCard, TicketComing; the booking
// app's _stcYes, 2026-11-13), through booking_coming (rentals migration 20261114080200) with the account cookie's id and
// token: every seated row of the account's own booking on that session is stamped, and an answer already given for the
// date stands. Answers {ok: true, at}, or {ok: false, error}: "invalid" for a body it cannot read, "closed" when the
// session is called off, not yet within its time or already started, "none" when the account holds no seated booking
// there (the ticket then draws the page again: what the server knows wins), "absent" when the database has no such
// function yet (the buttons go), "signin" when the account is signed out, "busy" or "generic". Only this site's pages may
// call it; a connection sends 30 a minute at most.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store, private" } });
const REFUSED: Record<string, number> = { signin: 401, generic: 502 }; // the database's other answers are 409

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ ok: false, error: "signin" }, 401);
  if (!(await withinLimit(req, "account-check"))) return json({ ok: false, error: "busy" }, 429);
  let body: unknown = null;
  try { body = await req.json(); } catch { /* empty body */ }
  const b = comingBody(body);
  if (!b) return json({ ok: false, error: "invalid" }, 400);
  const r = await rpcServer<unknown>("booking_coming", { p_id: acct.id, p_token: acct.token, p_session: b.session });
  if (r.status === 0 || r.status >= 500) return json({ ok: false, error: "generic" }, 502);
  if (r.status >= 400) return emAbsent(r) ? json({ ok: false, error: "absent" }, 404) : json({ ok: false, error: "generic" }, 502);
  const a = comingAnswer(r.data);
  if (a.ok) return json(a);
  return json(a, REFUSED[a.error] ?? 409);
}
