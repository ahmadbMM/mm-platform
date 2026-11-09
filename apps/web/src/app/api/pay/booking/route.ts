import { guard, json, langOf, payError } from "@/lib/pay/http";
import { payRpc, type PayView } from "@/lib/pay/server";

// POST /api/pay/booking {ids, wallet?, lang}: "Pay now" on a ticket (My Account): the rider's own unpaid
// bookings, paid from their payment page. Nothing is held here (the places are the rider's already); a
// booking made on the website pays through /api/booking, which holds its places while the rider pays.
export async function POST(req: Request) {
  const g = await guard(req, { signin: true });
  if (!g.ok) return g.res;
  const ids = Array.isArray(g.body.ids) ? g.body.ids.filter((x): x is string => typeof x === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(x)).slice(0, 20) : [];
  if (!ids.length) return json({ ok: false, error: "invalid" }, 400);
  const r = await payRpc<PayView & { id: string | null }>("pay_booking_start", {
    p_id: g.acct!.id, p_token: g.acct!.token, p_ids: ids, p_hold: false, p_wallet: g.body.wallet === true, p_lang: langOf(g.body.lang),
  });
  if (r.status !== 200 || !r.data) { const e = payError(r); return json({ ok: false, error: e.error }, e.status); }
  if (!r.data.id) return json({ ok: true, paid: true });  // the wallet covered it
  return json({ ok: true, pay: r.data.id, url: `/pay/${r.data.id}` });
}
