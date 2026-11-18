import { guard, json, payError } from "@/lib/pay/http";
import { payRpc } from "@/lib/pay/server";
import { giftCodeOf, giftCodeOk } from "@/lib/store-checkout";
import { sxRefusal } from "@/lib/sx-b3";

// POST /api/store/gift-card/wallet {code}: a store gift card's balance moved into the signed-in account's wallet (N20,
// 2026-11-18; store_gift_card_to_wallet, only while staff have store.giftCardWallet.on). The account comes from its
// cookie, never the body. Answers {ok: true, amount, balance} or {ok: false, error}.
export async function POST(req: Request) {
  const g = await guard(req, { signin: true });
  if (!g.ok) return g.res;
  const code = giftCodeOf(typeof g.body.code === "string" ? g.body.code.slice(0, 30) : "");
  if (!giftCodeOk(code)) return json({ ok: false, error: "gift" }, 400);
  const r = await payRpc<{ amount: number; balance: number }>("store_gift_card_to_wallet", { p_id: g.acct!.id, p_token: g.acct!.token, p_code: code });
  if (r.status !== 200 || !r.data) {
    const mine = sxRefusal(r.message);
    if (mine) return json({ ok: false, error: mine }, 409);
    const e = payError(r);
    return json({ ok: false, error: e.error }, e.status);
  }
  return json({ ok: true, amount: Number(r.data.amount) || 0, balance: Number(r.data.balance) || 0 });
}
