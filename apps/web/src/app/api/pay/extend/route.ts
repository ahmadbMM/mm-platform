import { guard, json, payError } from "@/lib/pay/http";
import { payRpc, type PayView } from "@/lib/pay/server";

// POST /api/pay/extend {id}: Keep my place (WCAG 2.2.1, 2026-11-11). The pay page warns a minute before a held payment
// lets go, and this asks the database for more time (rentals 20261111163000 pay_hold_extend): the hold starts again
// from now, never past twice its normal length from when the payment began (then PAY_HOLD_MAX, "hold_max"). It answers
// the new expiry and the time left by this server's clock, never the phone's, as the page itself counts. The payment's
// id is its own key, as on the page (nobody can guess it), so no sign-in is asked: a store order may be a guest's.
export async function POST(req: Request) {
  const g = await guard(req, { signin: false });
  if (!g.ok) return g.res;
  const id = typeof g.body.id === "string" ? g.body.id : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ ok: false, error: "invalid" }, 400);
  const r = await payRpc<PayView>("pay_hold_extend", { p_pay: id });
  if (r.status !== 200 || !r.data) { const e = payError(r); return json({ ok: false, error: e.error }, e.status); }
  const at = Date.parse(r.data.expires_at);
  if (!Number.isFinite(at)) return json({ ok: false, error: "generic" }, 502);
  return json({ ok: true, expires_at: r.data.expires_at, leftMs: at - Date.now() });
}
