import { ACCOUNT_COOKIE, decodeSession, sameOrigin } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { badgeRequestBody, reqRefusal } from "@/lib/badge-request";
import { emAbsent } from "@/lib/emergency";
import { cookieValue } from "@/lib/live";
import { withinLimit } from "@/lib/rate-limit";

// POST /api/account/badge-request {slug, comment?, proof?, proofName?}: a rider asks for a badge staff give, with an
// optional comment and an optional proof (a JPEG the page made small, or a PDF of 2 MB at most, as a data: URL), through
// the booking app's customer_badge_request (rentals migration 20261108210000) with the account cookie's id and token, as
// the booking app's own dialog does (_bdrSend). The database checks the rest: the badge is one staff give and not
// retired, the account does not hold it, fewer than ten wait. Answers {ok: true, id}, or {ok: false, error}: "invalid"
// for a body it cannot read, "absent" when the database has no such function yet, "signin" when the account is signed
// out, "held", "limit", "badge" or "proof" when the database refused it so, "busy" or "generic". Only this site's pages
// may call it; a connection sends 30 a minute at most.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store, private" } });
// the proof (3 MB at most, as the database takes it) with the rest of the body
const MAX_BODY = 3_200_000;

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ ok: false, error: "signin" }, 401);
  if (Number(req.headers.get("content-length") || 0) > MAX_BODY) return json({ ok: false, error: "invalid" }, 413);
  if (!(await withinLimit(req, "account-check"))) return json({ ok: false, error: "busy" }, 429);
  let body: unknown = null;
  try { body = await req.json(); } catch { /* empty body */ }
  const b = badgeRequestBody(body);
  if (!b) return json({ ok: false, error: "invalid" }, 400);
  const r = await rpcServer<unknown>("customer_badge_request",
    { p_id: acct.id, p_token: acct.token, p_badge: b.slug, p_comment: b.comment, p_proof: b.proof, p_proof_name: b.proofName },
    b.proof ? 20_000 : 4000);
  if (r.status === 0 || r.status >= 500) return json({ ok: false, error: "generic" }, 502);
  if (r.status >= 400) {
    if (emAbsent(r)) return json({ ok: false, error: "absent" }, 404);
    return json({ ok: false, error: /RATE_LIMITED/.test(r.message) ? "busy" : "generic" }, /RATE_LIMITED/.test(r.message) ? 429 : 502);
  }
  const d = r.data as Record<string, unknown> | null;
  if (d && d.ok === true) return json({ ok: true, id: Number(d.id) || 0 });
  const e = reqRefusal(d);
  return json({ ok: false, error: e }, e === "signin" ? 401 : e === "generic" ? 502 : 409);
}
