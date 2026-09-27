import { ACCOUNT_COOKIE, decodeSession } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { SESSION_ID, cookieValue, liveAnswer, type LiveAnswer } from "@/lib/live";

// GET /api/live?session=<id>: where the ride leader (and the sweeper) is on that session, for the
// live map (components/live/LiveMap.tsx), which asks every ten seconds. The rider's id and session
// token come from the account cookie (HttpOnly, so the page's script never sees them) and go to
// live_positions_for, which answers only a rider with a booking on the session and only rows from
// the last ten minutes. A database that does not have the function yet answers "unavailable".
export const dynamic = "force-dynamic";

const json = (body: LiveAnswer, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function GET(req: Request) {
  const session = new URL(req.url).searchParams.get("session") ?? "";
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ ok: false, error: "signin" }, 401);
  if (!SESSION_ID.test(session)) return json({ ok: false, error: "not_booked" }, 400);
  const r = await rpcServer<unknown>("live_positions_for", { p_session_id: session, p_id: acct.id, p_token: acct.token });
  const a = liveAnswer(r);
  return json(a, a.ok ? 200 : a.error === "signin" ? 401 : a.error === "network" ? 502 : 200);
}
