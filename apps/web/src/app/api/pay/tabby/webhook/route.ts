import { getCloudflareContext } from "@opennextjs/cloudflare";
import { payView } from "@/lib/pay/server";
import { isTabbyId, TABBY_HOOK_HEADER, tabbyHookOk, tabbySettle } from "@/lib/pay/tabby";
import { storeEnv } from "@/lib/store-api";

// POST /api/pay/tabby/webhook: Tabby's webhook (F84), registered with the header X-Webhook-Secret =
// TABBY_WEBHOOK_SECRET (lib/pay/tabby.ts says how). It catches a shopper who approved on Tabby's page and never came
// back. The header is compared in constant time; the body's own copy of the payment is never believed (the payment is
// read from Tabby by its id, then captured and settled). It answers 200 at once and settles after.
export const dynamic = "force-dynamic";

type Hook = { id?: unknown; status?: unknown; order?: { reference_id?: unknown } };

export async function POST(req: Request) {
  const env = storeEnv();
  if (!tabbyHookOk(req.headers.get(TABBY_HOOK_HEADER), env)) return new Response("forbidden", { status: 401 });
  let h: Hook = {};
  try { h = (await req.json()) as Hook; } catch { return new Response("bad request", { status: 400 }); }
  const id = typeof h.id === "string" ? h.id : "";
  const pay = typeof h.order?.reference_id === "string" ? h.order.reference_id : "";
  if (isTabbyId(id) && /^[0-9a-f-]{36}$/i.test(pay) && /^(authorized|closed)$/i.test(String(h.status ?? ""))) {
    const work = payView(pay).then((v) => tabbySettle(pay, id, "webhook", v, env)).then(() => undefined, () => undefined);
    try { getCloudflareContext().ctx.waitUntil(work); } catch { await work; }
  }
  return new Response("ok");
}
