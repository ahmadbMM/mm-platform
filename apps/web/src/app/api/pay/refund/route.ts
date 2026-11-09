import { payEnv } from "@/lib/pay/config";
import { sendRefund } from "@/lib/pay/server";

// POST /api/pay/refund: a refund staff decide in the staff page (Store > Orders, Payments > Refunds). The
// staff page sends its own signed-in session (Authorization: Bearer <access token>); the database decides
// with it (staff_pay_refund_begin: an admin with the refund right, the PIN, the manager limit) and writes
// the refund. Into the wallet it is done there; to the card, this server - the only holder of Moyasar's
// secret key - sends it and records Moyasar's answer.
// Body: {payment?, refund?, amount, dest: "card"|"wallet", reason, op?, approval?}. Only the staff pages may call it.
export const dynamic = "force-dynamic";

const STAFF_ORIGINS = ["https://staff.micromobility.sa", "https://staff-staging.micromobility.sa", "https://micromobility-staff-staging.pages.dev"];
const allowed = (o: string | null) => !!o && (STAFF_ORIGINS.includes(o) || (process.env.MM_ENV === "staging" && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(o)));

function cors(origin: string | null, res: Response): Response {
  if (allowed(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin!);
    res.headers.set("Vary", "Origin");
  }
  return res;
}
const json = (origin: string | null, body: unknown, status = 200) =>
  cors(origin, new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } }));

export function OPTIONS(req: Request) {
  const o = req.headers.get("origin");
  const res = new Response(null, { status: 204 });
  if (allowed(o)) {
    res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "authorization, content-type");
    res.headers.set("Access-Control-Max-Age", "600");
  }
  return cors(o, res);
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (!allowed(origin)) return new Response("forbidden", { status: 403 });
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!/^[A-Za-z0-9._-]{20,4096}$/.test(jwt)) return json(origin, { ok: false, error: "signin" }, 401);
  let b: Record<string, unknown> = {};
  try { b = (await req.json()) as Record<string, unknown>; } catch { /* empty */ }
  const uuid = (v: unknown) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null);
  const dest = b.dest === "card" || b.dest === "wallet" ? b.dest : null;
  const amount = b.amount == null ? null : Number(b.amount);
  if (!dest || (!uuid(b.payment) && !uuid(b.refund)) || (amount != null && !(amount > 0))) return json(origin, { ok: false, error: "invalid" }, 400);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return json(origin, { ok: false, error: "config" }, 503);
  const res = await fetch(`${url}/rest/v1/rpc/staff_pay_refund_begin`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      p_payment: uuid(b.payment), p_amount: amount, p_dest: dest, p_reason: typeof b.reason === "string" ? b.reason.slice(0, 200) : null,
      p_refund: uuid(b.refund), p_op: typeof b.op === "string" ? b.op.slice(0, 60) : null, p_approval: typeof b.approval === "string" ? b.approval.slice(0, 200) : null,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!res) return json(origin, { ok: false, error: "generic" }, 502);
  const out = (await res.json().catch(() => null)) as { id?: string; status?: string; dest?: string; amount?: number; provider_id?: string | null; message?: string } | null;
  if (!res.ok || !out) return json(origin, { ok: false, error: /^[A-Z_]+/.exec(out?.message ?? "")?.[0] ?? "generic" }, res.status === 401 ? 401 : 409);
  if (out.dest === "card" && out.status === "pending" && out.id) {
    const sent = await sendRefund({ id: out.id, provider_id: out.provider_id ?? null, amount: Number(out.amount) }, payEnv());
    return json(origin, { ok: sent, id: out.id, status: sent ? "done" : "failed", dest: "card", amount: out.amount, error: sent ? undefined : "gateway" }, sent ? 200 : 502);
  }
  return json(origin, { ok: true, ...out });
}
