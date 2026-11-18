import { ACCOUNT_COOKIE, decodeSession, sameOrigin } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { emAbsent } from "@/lib/emergency";
import { cookieValue } from "@/lib/live";
import { intBody, intKeys } from "@/lib/member-interests";

// POST /api/account/interests {keys: [...]}: a member saves My interests on /club (components/club/Interests.tsx; the
// booking app's _intSave, 2026-11-18) through member_interests_set with the account cookie's id and token (rentals
// 20261118210300). The database alone decides who may save (an active Community member), which keys there are and who may
// pick the women's sessions, and holds the save meter (20 an hour). Answers {ok: true, keys}, or {ok: false, error}:
// "refused" for a body it does not take (not a list of known keys), "keys" and "women" as the database says them, "limit"
// past the meter, "member" when the account is no longer a member, "signin" when its session has ended, "absent" when the
// database has no such function yet, "generic" when it could not be done. Only this site's pages may call it.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store, private" } });

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ ok: false, error: "signin" }, 401);
  let body: unknown = null;
  try { body = await req.json(); } catch { /* empty body */ }
  const keys = intBody(body);
  if (!keys) return json({ ok: false, error: "refused" }, 400);
  const r = await rpcServer<unknown>("member_interests_set", { p_id: acct.id, p_token: acct.token, p_keys: keys });
  if (r.status === 0 || r.status >= 500) return json({ ok: false, error: "generic" }, 502);
  if (r.status >= 400) return emAbsent(r) ? json({ ok: false, error: "absent" }, 404) : json({ ok: false, error: "generic" }, 502);
  const d = r.data && typeof r.data === "object" ? (r.data as Record<string, unknown>) : null;
  if (d?.ok === true) return json({ ok: true, keys: Array.isArray(d.keys) ? intKeys(d.keys) : keys });
  const e = d?.error;
  if (e === "denied") return json({ ok: false, error: "signin" }, 401);
  if (e === "member") return json({ ok: false, error: "member" }, 403);
  if (e === "limit") return json({ ok: false, error: "limit" }, 429);
  if (e === "keys" || e === "women") return json({ ok: false, error: e }, 400);
  return json({ ok: false, error: "generic" }, 502);
}
