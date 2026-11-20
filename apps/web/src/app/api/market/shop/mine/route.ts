import { marketGuard, mkAnswer } from "@/lib/market/route";
import { mkShopMine } from "@/lib/market/server";

// GET /api/market/shop/mine: the signed-in account's own shop, or null when it has none (market_shop_mine): every
// field of its application, its state, staff's note on a refusal, and how many of its listings are on sale. The
// account is the one in the HttpOnly cookie. Answers {ok: true, shop: ShopMine | null} or {ok: false, error}.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await marketGuard(req, { read: true });
  if (!g.ok) return g.res;
  return mkAnswer(await mkShopMine(g.session, req), (d) => ({ shop: d.shop ?? null }));
}
