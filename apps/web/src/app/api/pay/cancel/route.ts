import { guard, json, payError } from "@/lib/pay/http";
import { payRpc, sendRefund, type Refund } from "@/lib/pay/server";

// POST /api/pay/cancel {ids, dest: "wallet" | "card"}: the rider cancels their own bookings. A booking paid
// online and cancelled at least pay.refundDays before the ride day is refunded where the rider chose: into
// the wallet at once, or back to the card (sent to Moyasar now; mada 1-3 working days, credit cards up to
// 14). Later than that nothing is refunded - the ticket says so before the rider confirms.
export async function POST(req: Request) {
  const g = await guard(req, { signin: true });
  if (!g.ok) return g.res;
  const ids = Array.isArray(g.body.ids) ? g.body.ids.filter((x): x is string => typeof x === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(x)).slice(0, 20) : [];
  const dest = g.body.dest === "card" ? "card" : g.body.dest === "wallet" ? "wallet" : "";
  if (!ids.length || !dest) return json({ ok: false, error: "invalid" }, 400);
  const r = await payRpc<{ ok: boolean; refunds: Refund[] }>("pay_booking_cancel", { p_id: g.acct!.id, p_token: g.acct!.token, p_ids: ids, p_dest: dest });
  if (r.status !== 200 || !r.data) { const e = payError(r); return json({ ok: false, error: e.error }, e.status); }
  let sent = 0;
  for (const rf of r.data.refunds ?? []) if (await sendRefund(rf)) sent++;
  return json({ ok: true, refunds: (r.data.refunds ?? []).length, sent });
}
