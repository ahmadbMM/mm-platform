import { marketGuard, mkAnswer } from "@/lib/market/route";
import { mkMyListings } from "@/lib/market/server";

// GET /api/market/listing/mine: every listing of the signed-in account but the deleted ones, the newest change first,
// and the account's limits (market_my_listings). My listings and the selling form read it again after a change.
// Answers {ok: true, items, limits}, or {ok: false, error}: "signin", "busy", "absent", "generic".
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await marketGuard(req, { read: true });
  if (!g.ok) return g.res;
  return mkAnswer(await mkMyListings(g.session, req));
}
