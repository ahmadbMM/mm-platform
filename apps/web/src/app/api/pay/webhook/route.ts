import { getCloudflareContext } from "@opennextjs/cloudflare";
import { payEnv, payMode } from "@/lib/pay/config";
import { MOYASAR_ID, safeEqual } from "@/lib/pay/moyasar";
import { settleById } from "@/lib/pay/server";

// POST /api/pay/webhook: Moyasar's webhook (dashboard: Settings > Webhooks, this address, the Secret Token
// = MOYASAR_WEBHOOK_SECRET, events payment_paid, payment_failed, payment_refunded, payment_voided). Moyasar
// signs nothing: the secret token in the body is compared in constant time, and then the payment is
// fetched from Moyasar by its id - the body's own copy is never believed. It answers 200 at once and
// settles after (Moyasar retries 5 more times over ~4 h on anything else). An event of the other mode
// (live vs test) is ignored.
export const dynamic = "force-dynamic";

type Event = { type?: unknown; secret_token?: unknown; live?: unknown; data?: { id?: unknown } };

export async function POST(req: Request) {
  const env = payEnv();
  const secret = env.MOYASAR_WEBHOOK_SECRET ?? "";
  let e: Event = {};
  try { e = (await req.json()) as Event; } catch { return new Response("bad request", { status: 400 }); }
  if (!secret || typeof e.secret_token !== "string" || !safeEqual(e.secret_token, secret)) return new Response("forbidden", { status: 401 });
  if (typeof e.live === "boolean" && e.live !== (payMode(env) === "live")) return new Response("ok");
  const id = typeof e.data?.id === "string" ? e.data.id : "";
  if (typeof e.type === "string" && e.type.startsWith("payment_") && MOYASAR_ID.test(id)) {
    const work = settleById(id, "webhook", null, env).then(() => undefined, () => undefined);
    try { getCloudflareContext().ctx.waitUntil(work); } catch { await work; }
  }
  return new Response("ok");
}
