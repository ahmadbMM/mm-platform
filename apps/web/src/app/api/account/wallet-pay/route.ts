import { ACCOUNT_COOKIE, decodeSession, sameOrigin } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { emAbsent } from "@/lib/emergency";
import { cookieValue } from "@/lib/live";
import { withinLimit } from "@/lib/rate-limit";
import { walletPayBody } from "@/lib/wallet";

// POST /api/account/wallet-pay {ids, on}: the Wallet switch on a ticket (WalletPay). On pays what the balance can of the
// rider's own bookings (customer_wallet_pay), off gives it back (customer_wallet_release, rentals 20261103140000), with
// the account cookie's id and token. The database checks the rest: the rows are the account's, and open.
// Answers {ok: true}, or {ok: false, error}: "invalid" for a body it cannot read, "signin" when signed out, "short" when
// the balance no longer covers it, "refused" for a booking it will not take, "absent" with no such function
// yet, "busy" or "generic". Only this site's pages may call it.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store, private" } });

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ ok: false, error: "signin" }, 401);
  if (!(await withinLimit(req, "account-check"))) return json({ ok: false, error: "busy" }, 429);
  let body: unknown = null;
  try { body = await req.json(); } catch { /* empty body */ }
  const b = walletPayBody(body);
  if (!b) return json({ ok: false, error: "invalid" }, 400);
  const r = await rpcServer<unknown>(b.on ? "customer_wallet_pay" : "customer_wallet_release", { p_id: acct.id, p_token: acct.token, p_booking_ids: b.ids });
  if (r.status === 0 || r.status >= 500) return json({ ok: false, error: "generic" }, 502);
  if (r.status >= 400) {
    if (emAbsent(r)) return json({ ok: false, error: "absent" }, 404);
    if (/WALLET_SHORT/.test(r.message)) return json({ ok: false, error: "short" }, 409);
    if (/WALLET_|NOT_FOUND/.test(r.message)) return json({ ok: false, error: "refused" }, 409);
    if (/NOT_AUTHORIZED/.test(r.message)) return json({ ok: false, error: "signin" }, 401);
    return json({ ok: false, error: "generic" }, 502);
  }
  return json({ ok: true });
}
