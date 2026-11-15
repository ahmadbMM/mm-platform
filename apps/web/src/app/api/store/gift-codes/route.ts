import { guard, json } from "@/lib/pay/http";
import { giftCodes } from "@/lib/store-api";

// POST /api/store/gift-codes (F57): the order's page, in the browser that placed the order, asks for the whole codes of
// the gift cards it bought. A code is the money, so the database masks them for the order's link alone (Track order hands
// that link to anyone with the order number and the phone); the order's gift key, which the checkout gave this browser
// (lib/store-lists.ts, "mm-gift-keys"), shows them (store_order_get, rentals 20261115200100; CONTRACTS.md Additions by
// lead: gift card codes). Body: {no, key, gift}. Answers {ok: true, cards} (masked again for a wrong gift key) or
// {ok: false, error: invalid | not_found | busy | ...}.
export async function POST(req: Request) {
  const g = await guard(req, { signin: false });
  if (!g.ok) return g.res;
  const b = g.body;
  const no = typeof b.no === "number" ? b.no : typeof b.no === "string" && /^\d{1,9}$/.test(b.no) ? Number(b.no) : NaN;
  const key = typeof b.key === "string" ? b.key.trim() : "";
  const gift = typeof b.gift === "string" ? b.gift.trim() : "";
  const r = await giftCodes({ no, key, gift });
  return r.ok ? json({ ok: true, cards: r.data }) : json({ ok: false, error: r.error }, r.status);
}
