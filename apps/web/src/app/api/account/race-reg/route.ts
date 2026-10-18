import { ACCOUNT_COOKIE, decodeSession, sameOrigin } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { emAbsent } from "@/lib/emergency";
import { cookieValue } from "@/lib/live";
import { raceRegBody } from "@/lib/race-reg";
import { withinLimit } from "@/lib/rate-limit";

// POST /api/account/race-reg {entryId, answer}: a runner on the DEFE 5KM Run answers "Have you registered
// for the race?" ('yes' or 'no') on their ticket (TicketCard, RaceRegQuestion), through the booking app's
// customer_set_race_reg (rentals migration 20261018150000) with the account cookie's id and token, as the
// booking app's own ticket does (_defeRegSet). The database checks the rest: the row is the account's,
// live, on a Defe run. Answers {ok: true}, or {ok: false, error}: "invalid" for a body it cannot read,
// "absent" when the database has no such function yet, "signin" when the account is signed out, "refused"
// when the database answered false (a token that is no longer the account's, or a row it would not change:
// cancelled, or not a Defe place; the ticket then draws the page again), "busy" or "generic". Only this site's pages may call it; a connection sends 30 a minute at most.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store, private" } });

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ ok: false, error: "signin" }, 401);
  if (!(await withinLimit(req, "account-check"))) return json({ ok: false, error: "busy" }, 429);
  let body: unknown = null;
  try { body = await req.json(); } catch { /* empty body */ }
  const b = raceRegBody(body);
  if (!b) return json({ ok: false, error: "invalid" }, 400);
  const r = await rpcServer<boolean>("customer_set_race_reg", { p_id: acct.id, p_token: acct.token, p_entry_id: b.entryId, p_answer: b.answer });
  if (r.status === 0 || r.status >= 500) return json({ ok: false, error: "generic" }, 502);
  if (r.status >= 400) {
    if (emAbsent(r)) return json({ ok: false, error: "absent" }, 404);
    return json({ ok: false, error: /RATE_LIMITED/.test(r.message) ? "busy" : "generic" }, /RATE_LIMITED/.test(r.message) ? 429 : 502);
  }
  // false: the token is no longer the account's, or the row is not a live Defe place of the account's
  if (r.data !== true) return json({ ok: false, error: "refused" }, 409);
  return json({ ok: true });
}
