import { payEnv } from "@/lib/pay/config";
import { safeEqual } from "@/lib/pay/moyasar";
import { reconcile } from "@/lib/pay/server";

// POST /api/pay/reconcile: the Worker's own cron (worker.js scheduled, every 5 minutes) asks Moyasar about
// payments still open or let go, and sends card refunds that never reached it. Only the Worker itself
// calls it: the request carries the server key.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const env = payEnv();
  const k = req.headers.get("x-pay-key") ?? "";
  if (!env.PAY_SERVER_KEY || !safeEqual(k, env.PAY_SERVER_KEY)) return new Response("forbidden", { status: 403 });
  const r = await reconcile(env);
  return Response.json(r, { headers: { "cache-control": "no-store" } });
}
