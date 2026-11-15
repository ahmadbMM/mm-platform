import { payView } from "@/lib/pay/server";
import { isTabbyId, tabbySettle } from "@/lib/pay/tabby";
import { storeEnv } from "@/lib/store-api";

// GET /api/pay/tabby/return?pay=<ours>&payment_id=<Tabby's>: where Tabby sends the shopper after they approve (F84).
// The address is never believed: the payment is read from Tabby, captured and settled (lib/pay/tabby.ts). A paid store
// order goes to its order page; anything else back to its payment page, which says Tabby did not go through.
export const dynamic = "force-dynamic";

const go = (req: Request, path: string) => Response.redirect(new URL(path, req.url).toString(), 303);

export async function GET(req: Request) {
  const u = new URL(req.url);
  const pay = u.searchParams.get("pay") ?? "";
  const id = u.searchParams.get("payment_id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(pay)) return go(req, "/");
  if (isTabbyId(id)) await tabbySettle(pay, id, "return", await payView(pay), storeEnv());
  const v = await payView(pay);
  if (!v) return go(req, "/");
  if (v.kind === "order" && v.order_no && v.order_key && v.status !== "initiated") return go(req, `/store/order/${v.order_no}?k=${v.order_key}`);
  return go(req, `/pay/${pay}${v.status === "initiated" ? "?tabby=fail" : ""}`);
}
