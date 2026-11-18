import { MOYASAR_ID } from "@/lib/pay/moyasar";
import { payView, settleById } from "@/lib/pay/server";
import { withinLimit } from "@/lib/rate-limit";

// GET /api/pay/return?pay=<ours>&id=<Moyasar's>&status=&message=: Moyasar's callback_url, where the
// rider's browser lands after paying (after 3-D Secure, or at once for Apple Pay and STC Pay). The
// status in the address is never believed: this server fetches the payment from Moyasar and settles it
// (lib/pay/server.ts), then sends the rider on - a store order to its order page, anything else back to
// its payment page, which says paid, or why not and lets them try again. Our own payment is read first: an address
// naming none never reaches Moyasar (each settle is a call with the secret key), and the settles are metered per
// connection as the other pay routes are; a rider over the meter lands on the payment page all the same, and the webhook
// or the reconcile settles it (bug hunt 2026-11-18).
export const dynamic = "force-dynamic";

const go = (req: Request, path: string) => Response.redirect(new URL(path, req.url).toString(), 303);

export async function GET(req: Request) {
  const u = new URL(req.url);
  const pay = u.searchParams.get("pay") ?? "";
  const id = u.searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(pay)) return go(req, "/");
  const first = await payView(pay);
  if (!first) return go(req, "/");
  const settled = MOYASAR_ID.test(id) && (await withinLimit(req, "pay")) ? await settleById(id, "return", pay) : null;
  const v = settled ? (await payView(pay)) ?? first : first;
  if (v.kind === "order" && v.order_no && v.order_key && v.status !== "initiated") {
    return go(req, `/store/order/${v.order_no}?k=${v.order_key}`);
  }
  return go(req, `/pay/${pay}${v.status === "initiated" ? "?tried=1" : ""}`);
}
