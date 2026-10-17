import { ACCOUNT_COOKIE, decodeSession, sameOrigin } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { btOf, btRefused, btValid } from "@/lib/blood-type";
import { emAbsent } from "@/lib/emergency";
import { cookieValue } from "@/lib/live";
import { withinLimit } from "@/lib/rate-limit";

// GET /api/account/blood-type: the signed-in account's blood type (lib/blood-type.ts), read through
// customer_blood_type with the account cookie's id and token: {signedIn: true, type} ("" when none),
// or {absent: true} when the database has no such function yet (the card is not shown). A connection
// asks 30 times a minute at most (lib/rate-limit.ts). My Account reads it server-side itself; this is
// for a page that asks from the browser.
//
// POST /api/account/blood-type {type}: saves it through customer_set_blood_type ("" clears it). Answers
// {ok: true}, or {ok: false, error}: "refused" for a value outside the list, "absent" when the database
// cannot store it yet, "signin" when the account's session has ended, "busy" or "generic". Only this
// site's pages may call it.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store, private" } });

export async function GET(req: Request) {
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ signedIn: false });
  if (!(await withinLimit(req, "account-check"))) return json({ error: "busy" }, 429);
  const r = await rpcServer<unknown>("customer_blood_type", { p_id: acct.id, p_token: acct.token });
  if (r.status >= 400 && emAbsent(r)) return json({ signedIn: true, absent: true });
  if (r.status === 0 || r.status >= 400) return json({ error: "generic" }, 502);
  return json({ signedIn: true, type: btOf(r.data) });
}

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ ok: false, error: "signin" }, 401);
  let body: unknown = null;
  try { body = await req.json(); } catch { /* empty body */ }
  const t = body && typeof body === "object" ? (body as Record<string, unknown>).type : undefined;
  const type = typeof t === "string" ? t.slice(0, 10) : "";
  if (typeof t !== "string" || !btValid(type)) return json({ ok: false, error: "refused" }, 400);
  const r = await rpcServer<boolean>("customer_set_blood_type", { p_id: acct.id, p_token: acct.token, p_type: type });
  if (r.status === 0 || r.status >= 500) return json({ ok: false, error: "generic" }, 502);
  if (r.status >= 400) {
    if (emAbsent(r)) return json({ ok: false, error: "absent" }, 404);
    if (btRefused(r)) return json({ ok: false, error: "refused" }, 400);
    return json({ ok: false, error: /RATE_LIMITED/.test(r.message) ? "busy" : "generic" }, /RATE_LIMITED/.test(r.message) ? 429 : 502);
  }
  // false: the token is no longer the account's (its session ended)
  if (r.data !== true) return json({ ok: false, error: "signin" }, 401);
  return json({ ok: true });
}
