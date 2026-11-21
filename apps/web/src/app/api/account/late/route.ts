import { ACCOUNT_COOKIE, decodeSession, sameOrigin } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { emAbsent } from "@/lib/emergency";
import { cookieValue } from "@/lib/live";
import { withinLimit } from "@/lib/rate-limit";
import { lateAnswer, lateBody } from "@/lib/still-coming";

// POST /api/account/late {session, min}: "Running late" on a ticket's "Still coming?" (TicketCard, TicketComing; the booking
// app's _rlSave, the customer features round of 2026-11-19, item 1), through booking_late (rentals migration
// 20261119600100) with the account cookie's id and token: every seated row of the account's own booking on that session
// says it will be about 10, 20 or 30 minutes late (min), or is on time again (min null), and a late answer counts as
// coming. Answers {ok: true, min, at, coming} (coming: the party's first yes, which the ticket's chip reads), or
// {ok: false, error}: "invalid" for a body it cannot read, "closed" when the session is called off, outside its time, of a
// kind with no time to turn up or the party is checked in, "none" when the account holds no seated booking there (the
// ticket says so and draws the page again: what the server knows wins), "absent" when the database has no such function
// yet (the button goes), "signin" when the account is signed out, "busy" or "generic". Only this site's pages may call
// it; a connection sends 30 a minute at most (the coming route's own meter).
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store, private" } });
const REFUSED: Record<string, number> = { signin: 401, generic: 502 }; // the database's other answers are 409

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ ok: false, error: "signin" }, 401);
  if (!(await withinLimit(req, "account-check", undefined, acct.id))) return json({ ok: false, error: "busy" }, 429);
  let body: unknown = null;
  try { body = await req.json(); } catch { /* empty body */ }
  const b = lateBody(body);
  if (!b) return json({ ok: false, error: "invalid" }, 400);
  const r = await rpcServer<unknown>("booking_late", { p_id: acct.id, p_token: acct.token, p_session: b.session, p_min: b.min });
  if (r.status === 0 || r.status >= 500) return json({ ok: false, error: "generic" }, 502);
  if (r.status >= 400) return emAbsent(r) ? json({ ok: false, error: "absent" }, 404) : json({ ok: false, error: "generic" }, 502);
  const a = lateAnswer(r.data);
  if (a.ok) return json(a);
  return json(a, REFUSED[a.error] ?? 409);
}
