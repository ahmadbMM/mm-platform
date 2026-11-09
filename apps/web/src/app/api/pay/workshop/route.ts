import { guard, json, langOf, payError } from "@/lib/pay/http";
import { payRpc, type PayView } from "@/lib/pay/server";

// POST /api/pay/workshop {ref, phone, lang}: paying a workshop job from its tracker (the reference and
// phone the tracker already asks for, as workshop_track reads them), once staff set its final price and
// it is ready or completed.
export async function POST(req: Request) {
  const g = await guard(req, { signin: false });
  if (!g.ok) return g.res;
  const ref = typeof g.body.ref === "string" ? g.body.ref.slice(0, 20) : "";
  const phone = typeof g.body.phone === "string" ? g.body.phone.slice(0, 20) : "";
  if (!ref || !phone) return json({ ok: false, error: "invalid" }, 400);
  const r = await payRpc<PayView>("pay_workshop_start", { p_ref: ref, p_phone: phone, p_lang: langOf(g.body.lang) });
  if (r.status !== 200 || !r.data) { const e = payError(r); return json({ ok: false, error: e.error }, e.status); }
  return json({ ok: true, pay: r.data.id, url: `/pay/${r.data.id}` });
}
