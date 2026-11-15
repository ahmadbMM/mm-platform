import { guard, json, langOf } from "@/lib/pay/http";
import { reviewAdd } from "@/lib/store-api";

// POST /api/store/review (F94): a verified buyer's review of one product of a delivered order, from the card the order's
// page shows once it is delivered. The order is named by its number and its own key; the database checks it was
// delivered, that the product is one of its lines (never a gift card) and that it was not reviewed yet
// (store_review_add, rentals 20261115235500). It waits for staff to show it; no name, phone or account is kept with it
// (owner rule: nobody's name), and nothing invented ever reaches the product page.
// Body: {no, key, product, rating: 1-5, body, lang}. Answers {ok: true} or
// {ok: false, error: review_state | review_item | review_done | not_found | busy | invalid | ...}.
export async function POST(req: Request) {
  const g = await guard(req, { signin: false });
  if (!g.ok) return g.res;
  const b = g.body;
  const no = typeof b.no === "number" ? b.no : typeof b.no === "string" && /^\d{1,9}$/.test(b.no) ? Number(b.no) : NaN;
  const r = await reviewAdd({
    no, key: typeof b.key === "string" ? b.key.trim() : "", product: typeof b.product === "string" ? b.product.trim().toLowerCase() : "",
    rating: Number(b.rating), body: typeof b.body === "string" ? b.body.slice(0, 1000) : "", lang: langOf(b.lang),
  });
  return r.ok ? json({ ok: true }) : json({ ok: false, error: r.error }, r.status);
}
