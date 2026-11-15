import { guard, json } from "@/lib/pay/http";
import { giftCardCheck } from "@/lib/store-api";

// POST /api/store/gift-card {code}: what a gift card still holds and until when (F57; store_gift_card_check, metered in
// the database), so checkout can say it before the order is placed. Answers {ok, code, balance, expires} or
// {ok: false, error} ("gift" unknown, void or empty; "gift_expired"; "busy"). Checkout takes the card's part again.
export async function POST(req: Request) {
  const g = await guard(req, { signin: false });
  if (!g.ok) return g.res;
  const r = await giftCardCheck(typeof g.body.code === "string" ? g.body.code.slice(0, 30) : "");
  if (!r.ok) return json({ ok: false, error: r.error }, r.status);
  if (!(r.data.balance > 0)) return json({ ok: false, error: "gift" }, 409);
  return json({ ok: true, code: r.data.code, balance: r.data.balance, expires: r.data.expires_at });
}
