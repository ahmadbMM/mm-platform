import { getCloudflareContext } from "@opennextjs/cloudflare";
import { payEnv, payMode } from "@/lib/pay/config";
import { MOYASAR_ID, safeEqual, verifyWebhook } from "@/lib/pay/moyasar";
import { settleById } from "@/lib/pay/server";

// POST /api/pay/webhook: Moyasar's webhook (dashboard: Settings > Webhooks, this address, the Secret Token
// = MOYASAR_WEBHOOK_SECRET, events payment_paid, payment_failed, payment_refunded, payment_voided). Moyasar
// signs nothing: the secret token in the body is compared in constant time, and then the payment is
// fetched from Moyasar by its id - the body's own copy is never believed. It answers 200 at once and
// settles after (Moyasar retries 5 more times over ~4 h on anything else). An event of the other mode
// (live vs test) is ignored.
// A new webhook receives nothing until it is verified (2026-11-14): Moyasar posts a `webhook_verification` event once,
// carrying the secret token, the webhook's id and a 6-digit code, and this answers it at once with the secret key
// (verifyWebhook), so adding the webhook in the dashboard is all it takes. Its outcome goes to the Worker's log, never
// the code itself. Should it fail (the code reached us late), the dashboard's Resend code starts it again.
export const dynamic = "force-dynamic";

type Event = { type?: unknown; secret_token?: unknown; live?: unknown; data?: { id?: unknown; webhook_id?: unknown; verification_code?: unknown } };

export async function POST(req: Request) {
  const env = payEnv();
  const secret = env.MOYASAR_WEBHOOK_SECRET ?? "";
  let e: Event = {};
  try { e = (await req.json()) as Event; } catch { return new Response("bad request", { status: 400 }); }
  if (!secret || typeof e.secret_token !== "string" || !safeEqual(e.secret_token, secret)) return new Response("forbidden", { status: 401 });
  if (typeof e.live === "boolean" && e.live !== (payMode(env) === "live")) return new Response("ok");
  if (e.type === "webhook_verification") {
    const hook = typeof e.data?.webhook_id === "string" ? e.data.webhook_id : "";
    const code = typeof e.data?.verification_code === "string" ? e.data.verification_code : String(e.data?.verification_code ?? "");
    const work = verifyWebhook(env.MOYASAR_SECRET_KEY ?? "", hook, code).then(
      (r) => console.log(r.ok ? `moyasar webhook ${hook} verified` : `moyasar webhook ${hook} not verified: ${r.status} ${r.message}`),
      () => undefined,
    );
    try { getCloudflareContext().ctx.waitUntil(work); } catch { await work; }
    return new Response("ok");
  }
  const id = typeof e.data?.id === "string" ? e.data.id : "";
  if (typeof e.type === "string" && e.type.startsWith("payment_") && MOYASAR_ID.test(id)) {
    const work = settleById(id, "webhook", null, env).then(() => undefined, () => undefined);
    try { getCloudflareContext().ctx.waitUntil(work); } catch { await work; }
  }
  return new Response("ok");
}
