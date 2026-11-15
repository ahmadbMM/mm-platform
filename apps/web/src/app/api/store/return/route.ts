import { guard, json } from "@/lib/pay/http";
import { returnRequest } from "@/lib/store-api";
import { RETURN_REASONS, type ReturnReason } from "@/lib/store-order";

// POST /api/store/return (F93): the customer asks, from the order's page, to return or exchange items of a delivered
// order. The order is named by its number and its own key (the order page's link, as Track order and My Account give
// it), never by the account; the database checks the window (7 days to return, 15 to exchange, from the day it was
// delivered), that no request is open, and that each line is the order's own and not more than was bought
// (store_return_request, rentals 20261115235500). Staff approve or refuse it in the staff page; the refund then goes the
// existing way (Payments > Refunds). Nothing is sent by email or SMS: the order's page shows the request.
// Body: {no, key, kind: "return" | "exchange", items: [{item, qty}], reason, note}. Answers {ok: true, order} or
// {ok: false, error: return_window | return_open | return_items | not_found | busy | invalid | ...}.
export async function POST(req: Request) {
  const g = await guard(req, { signin: false });
  if (!g.ok) return g.res;
  const b = g.body;
  const no = typeof b.no === "number" ? b.no : typeof b.no === "string" && /^\d{1,9}$/.test(b.no) ? Number(b.no) : NaN;
  const key = typeof b.key === "string" ? b.key.trim() : "";
  const kind = b.kind === "exchange" ? "exchange" : b.kind === "return" ? "return" : null;
  const reason = typeof b.reason === "string" && (RETURN_REASONS as readonly string[]).includes(b.reason) ? (b.reason as ReturnReason) : null;
  if (!Number.isInteger(no) || no < 1 || !/^[0-9a-f]{32}$/i.test(key) || !kind) return json({ ok: false, error: "invalid" }, 400);
  if (!reason) return json({ ok: false, error: "return_items" }, 400);
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 20).map((x) => {
    const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    return { item: Number(o.item), qty: Number(o.qty) };
  });
  const r = await returnRequest({ no, key, kind, items, reason, note: typeof b.note === "string" ? b.note.slice(0, 300) : "" });
  return r.ok ? json({ ok: true, order: r.data }) : json({ ok: false, error: r.error }, r.status);
}
