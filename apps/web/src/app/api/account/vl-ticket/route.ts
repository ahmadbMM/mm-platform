import { ACCOUNT_COOKIE, decodeSession, sameOrigin } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { emAbsent } from "@/lib/emergency";
import { cookieValue } from "@/lib/live";
import { withinLimit } from "@/lib/rate-limit";
import { vlTicketBody } from "@/lib/vl-ticket";

// POST /api/account/vl-ticket {entryId, answer, img?}: a Victory Lap athlete says on their ticket whether
// they already have a ticket ('have') or buy one by bank transfer ('buy'), with the transfer receipt's
// picture once they have it (a JPEG data: URL the page made small: VlTicket), through the booking app's
// customer_vl_ticket (rentals migration 20261023160000) with the account cookie's id and token, as the
// booking app's own pop-up does (_vtSave). The database checks the rest: the row is the account's, live,
// on Victory Lap; a receipt is kept (vl_receipts) and waits for staff to confirm it (staff_vl_receipt).
// Answers {ok: true}, or {ok: false, error}: "invalid" for a body it cannot read, "absent" when the
// database has no such function yet (the ticket then puts the question aside), "signin" when the account
// is signed out, "refused" when the database answered false (a token that is no longer the account's, or
// a row it would not change), "busy" or "generic". Only this site's pages may call it; a connection sends
// 30 a minute at most.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store, private" } });
// the receipt (3 MB at most, as the database takes it) with the rest of the body
const MAX_BODY = 3_200_000;

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ ok: false, error: "signin" }, 401);
  if (Number(req.headers.get("content-length") || 0) > MAX_BODY) return json({ ok: false, error: "invalid" }, 413);
  if (!(await withinLimit(req, "account-check"))) return json({ ok: false, error: "busy" }, 429);
  let body: unknown = null;
  try { body = await req.json(); } catch { /* empty body */ }
  const b = vlTicketBody(body);
  if (!b) return json({ ok: false, error: "invalid" }, 400);
  const r = await rpcServer<boolean>("customer_vl_ticket",
    { p_id: acct.id, p_token: acct.token, p_entry_id: b.entryId, p_answer: b.answer, p_img: b.img },
    b.img ? 20_000 : 4000);
  if (r.status === 0 || r.status >= 500) return json({ ok: false, error: "generic" }, 502);
  if (r.status >= 400) {
    if (emAbsent(r)) return json({ ok: false, error: "absent" }, 404);
    return json({ ok: false, error: /RATE_LIMITED/.test(r.message) ? "busy" : "generic" }, /RATE_LIMITED/.test(r.message) ? 429 : 502);
  }
  // false: the token is no longer the account's, or the row is not a live Victory Lap place of the account's
  if (r.data !== true) return json({ ok: false, error: "refused" }, 409);
  return json({ ok: true });
}
