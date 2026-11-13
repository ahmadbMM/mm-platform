import { ACCOUNT_COOKIE, decodeSession, sameOrigin } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { emAbsent } from "@/lib/emergency";
import { cookieValue } from "@/lib/live";

// POST /api/account/plan {date: "YYYY-MM-DD", on: boolean}: a member ticks or unticks one of this month's Saturdays in
// Plan my Saturdays on /club (components/club/PlanSaturdays.tsx; the booking app's _planTick, new features F10), through
// hub_plan_set with the account cookie's id and token. A tick books nothing. The database alone decides which days may
// be ticked (a Saturday of the current month, not gone) and that the account is an active member. Answers {ok: true,
// date, on}, or {ok: false, error}: "refused" for a request it does not take (a malformed day or tick, or a day that is
// not one of this month's Saturdays), "past" for a Saturday already gone, "member" when the account is no longer a
// member, "signin" when its session has ended, "absent" when the database has no such function yet, "generic" when it
// could not be done. Only this site's pages may call it.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store, private" } });

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ ok: false, error: "signin" }, 401);
  let body: unknown = null;
  try { body = await req.json(); } catch { /* empty body */ }
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  if (typeof b.date !== "string" || !/^\d{4}-\d\d-\d\d$/.test(b.date) || typeof b.on !== "boolean") return json({ ok: false, error: "refused" }, 400);
  const r = await rpcServer<unknown>("hub_plan_set", { p_id: acct.id, p_token: acct.token, p_date: b.date, p_on: b.on });
  if (r.status === 0 || r.status >= 500) return json({ ok: false, error: "generic" }, 502);
  if (r.status >= 400) return emAbsent(r) ? json({ ok: false, error: "absent" }, 404) : json({ ok: false, error: "generic" }, 502);
  const d = r.data && typeof r.data === "object" ? (r.data as Record<string, unknown>) : null;
  if (d?.ok === true) return json({ ok: true, date: b.date, on: d.on === true });
  const e = d?.error;
  if (e === "denied") return json({ ok: false, error: "signin" }, 401);
  if (e === "member") return json({ ok: false, error: "member" }, 403);
  if (e === "past") return json({ ok: false, error: "past" }, 409);
  if (e === "date") return json({ ok: false, error: "refused" }, 400);
  return json({ ok: false, error: "generic" }, 502);
}
