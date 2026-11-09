import { sameOrigin } from "@/lib/account-core";
import { json } from "@/lib/pay/http";
import { MOYASAR_ID } from "@/lib/pay/moyasar";
import { settleById } from "@/lib/pay/server";
import { withinLimit } from "@/lib/rate-limit";

// POST /api/pay/attach {pay, id}: the payment form's on_completed, right after Moyasar made the payment
// and before 3-D Secure (Moyasar: "highly recommended to save the payment ID before redirecting"). This
// server fetches it and records it against ours (Apple Pay and STC Pay are already paid here, and are
// settled at once). Best effort: the return page, the webhook and the reconcile run do the same.
export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false }, 403);
  if (!(await withinLimit(req, "pay"))) return json({ ok: false }, 429);
  let b: { pay?: unknown; id?: unknown } = {};
  try { b = (await req.json()) as typeof b; } catch { /* empty */ }
  const pay = typeof b.pay === "string" ? b.pay : "", id = typeof b.id === "string" ? b.id : "";
  if (!/^[0-9a-f-]{36}$/i.test(pay) || !MOYASAR_ID.test(id)) return json({ ok: false }, 400);
  const r = await settleById(id, "attach", pay);
  return json({ ok: r.ok, status: r.status });
}
