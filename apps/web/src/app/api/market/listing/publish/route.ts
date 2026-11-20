import { marketGuard, mkAnswer, mkRefuse } from "@/lib/market/route";
import { mkListingPublish } from "@/lib/market/server";
import { w2BodyPublish } from "@/lib/market/w2";

// POST /api/market/listing/publish: one of the account's own drafts goes on sale at once (market_listing_publish).
// Body: {id, nameMode: "short" | "none", consent: boolean, terms: string | null} - how the seller is named on this
// listing (first name and last initial, or no name), the tick that lets it be shown, and the version of the
// Marketplace rules the form showed when the seller ticked them (null when they had accepted them before).
// Answers {ok: true, listing}: its `status` is "live", or "held" when the database kept it for staff to look at.
// The database's refusals come back as they are: "consent", "terms", "input" with the key, "new_only", "declare",
// "serial", "photos", "price", "limit" + "live", "birth", "adult", "suspended", "state", "gone".
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const g = await marketGuard(req);
  if (!g.ok) return g.res;
  const b = w2BodyPublish(g.body);
  if (!b) return mkRefuse("invalid", 400);
  return mkAnswer(await mkListingPublish(g.session, b.id, b.nameMode, b.consent, b.terms, req));
}
