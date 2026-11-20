import { marketGuard, mkAnswer, mkRefuse } from "@/lib/market/route";
import { mkListingState, purgeLater } from "@/lib/market/server";
import { w2BodyState } from "@/lib/market/w2";

// POST /api/market/listing/state: what a seller does to one of their own listings (market_listing_state).
// Body: {id, action: "reserved" | "live" | "sold" | "deleted" | "renew", price?} - `price` is the whole-riyal price it
// sold for, with "sold" and with nothing else.
// Answers {ok: true, listing, commission, purge}: `commission` is {pct, due, how_en, how_ar} when a listing was just
// marked sold and the honour commission is above 0, else null. The photos of a deleted draft are marked by the
// database (`purge`) and removed from the storage behind this answer.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const g = await marketGuard(req);
  if (!g.ok) return g.res;
  const b = w2BodyState(g.body);
  if (!b) return mkRefuse("invalid", 400);
  const r = await mkListingState(g.session, b.id, b.action, b.price, req);
  if (r.ok && r.data.purge > 0) purgeLater();
  return mkAnswer(r);
}
