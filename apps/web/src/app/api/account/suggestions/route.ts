import { ACCOUNT_COOKIE, decodeSession, sameOrigin } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { emAbsent } from "@/lib/emergency";
import { cookieValue } from "@/lib/live";
import { isRsgKind, rsgRow, rsgText } from "@/lib/ride-suggestions";

// POST /api/account/suggestions {kind, body}: a member sends a suggestion from Suggest a ride on /club
// (components/club/SuggestRide.tsx; the booking app's _rsgSend, 2026-11-18) through ride_suggest with the account cookie's
// id and token (rentals 20261118210500). The database alone decides who may send (an active Community member) and holds
// the limits (3 a day, 10 still new). Answers {ok: true, row} (the suggestion as the member sees it), or {ok: false,
// error}: "invalid" for a kind it does not know or a text outside 3 to 500 characters (asked of the database never),
// "day" and "open" past the limits, "member" when the account is no longer a member, "signin" when its session has ended,
// "absent" when the database has no such function yet, "generic" when it could not be done. Only this site's pages may
// call it.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store, private" } });

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ ok: false, error: "signin" }, 401);
  let body: unknown = null;
  try { body = await req.json(); } catch { /* empty body */ }
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const text = rsgText(b.body);
  if (!isRsgKind(b.kind) || !text) return json({ ok: false, error: "invalid" }, 400);
  const r = await rpcServer<unknown>("ride_suggest", { p_id: acct.id, p_token: acct.token, p_kind: b.kind, p_body: text });
  if (r.status === 0 || r.status >= 500) return json({ ok: false, error: "generic" }, 502);
  if (r.status >= 400) return emAbsent(r) ? json({ ok: false, error: "absent" }, 404) : json({ ok: false, error: "generic" }, 502);
  const d = r.data && typeof r.data === "object" ? (r.data as Record<string, unknown>) : null;
  const row = d?.ok === true ? rsgRow(d.row) : null;
  if (row) return json({ ok: true, row });
  const e = d?.error;
  if (e === "denied") return json({ ok: false, error: "signin" }, 401);
  if (e === "member") return json({ ok: false, error: "member" }, 403);
  if (e === "day" || e === "open") return json({ ok: false, error: e }, 429);
  if (e === "invalid") return json({ ok: false, error: "invalid" }, 400);
  return json({ ok: false, error: "generic" }, 502);
}
