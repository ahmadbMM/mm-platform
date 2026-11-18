import { ACCOUNT_COOKIE, decodeSession } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { cookieValue } from "@/lib/live";

// GET /api/xp/mine: the signed-in rider's own gifts and packs with their codes (EF20, EF21; rentals SX B6:
// customer_xp_purchases), for the payment page once paid (the gift's link to send) and the review's "Use my pack".
// Read with the account cookie's id and token; a database without the function answers an empty list.
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store, private" } });

export async function GET(req: Request) {
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ ok: false, error: "signin" }, 401);
  const r = await rpcServer<unknown[]>("customer_xp_purchases", { p_id: acct.id, p_token: acct.token });
  return json({ ok: true, items: r.status === 200 && Array.isArray(r.data) ? r.data : [] });
}
