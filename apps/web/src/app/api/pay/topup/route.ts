import { guard, json, langOf, payError } from "@/lib/pay/http";
import { payRpc, type PayView } from "@/lib/pay/server";

// POST /api/pay/topup {amount, lang}: adding money to the account's wallet by card (behind the pay.topup
// switch, off until staff turn it on: card-funded stored value needs a legal check before live).
export async function POST(req: Request) {
  const g = await guard(req, { signin: true });
  if (!g.ok) return g.res;
  const amount = Number(g.body.amount);
  if (!Number.isInteger(amount) || amount < 1 || amount > 10000) return json({ ok: false, error: "amount" }, 400);
  const r = await payRpc<PayView>("pay_topup_start", { p_id: g.acct!.id, p_token: g.acct!.token, p_amount: amount, p_lang: langOf(g.body.lang) });
  if (r.status !== 200 || !r.data) { const e = payError(r); return json({ ok: false, error: e.error }, e.status); }
  return json({ ok: true, pay: r.data.id, url: `/pay/${r.data.id}` });
}
