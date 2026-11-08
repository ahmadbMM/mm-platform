import { ACCOUNT_COOKIE, decodeSession, sameOrigin } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { emAbsent } from "@/lib/emergency";
import { cookieValue } from "@/lib/live";
import { withinLimit } from "@/lib/rate-limit";
import { referrerBody, referrerReason } from "@/lib/referral";

// POST /api/account/referrer {code}: a new account names the friend who invited it (customer_set_referrer, rentals
// 20261108160000), with the account cookie's id and token; the database decides whether this account may still be
// referred. Answers {ok: true}, or {ok: false, error}: the database's reason ("invalid", "self", "already", "not_new",
// "off"), "signin" when signed out, "absent" with no such function yet, "busy" or "generic". Only this site's pages may call it.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store, private" } });

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ ok: false, error: "signin" }, 401);
  if (!(await withinLimit(req, "account-check"))) return json({ ok: false, error: "busy" }, 429);
  let body: unknown = null;
  try { body = await req.json(); } catch { /* empty body */ }
  const b = referrerBody(body);
  if (!b) return json({ ok: false, error: "invalid" }, 400);
  const r = await rpcServer<unknown>("customer_set_referrer", { p_id: acct.id, p_token: acct.token, p_code: b.code, p_via: "code" });
  if (r.status === 0 || r.status >= 500) return json({ ok: false, error: "generic" }, 502);
  if (r.status >= 400) return emAbsent(r) ? json({ ok: false, error: "absent" }, 404) : json({ ok: false, error: "generic" }, 502);
  const why = referrerReason(r.data);
  return why === "ok" ? json({ ok: true }) : json({ ok: false, error: why }, 409);
}
