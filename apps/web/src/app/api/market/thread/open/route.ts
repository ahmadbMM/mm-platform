import { isMkNameMode } from "@/lib/market/core";
import { bodyId, bodyText, marketGuard, mkAnswer, mkRefuse } from "@/lib/market/route";
import { mkThreadOpen } from "@/lib/market/server";

// POST /api/market/thread/open: a buyer's first message about a listing (market_thread_open, with the account
// cookie's id and token). Body {listing: number, body: string, nameMode: "short" | "none"}: `nameMode` is how the buyer
// is named to the seller in this thread, "first name and last initial" or not at all, frozen when the thread opens.
// When the buyer already has a thread on the listing the message joins it. Answers {ok: true, thread_id, created}, or
// {ok: false, error, detail?}: "invalid" (a body that is not the above), and the database's own refusals - "gone" (not
// on sale any more), "own", "state" (one of MicroMobility's own listings), "blocked", "link", "phone", "input",
// "limit" (detail threads | messages | wait), "birth", "adult", "suspended", "signin", "busy".
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const g = await marketGuard(req);
  if (!g.ok) return g.res;
  const listing = bodyId(g.body.listing), body = bodyText(g.body.body, 4000), nameMode = g.body.nameMode;
  if (!listing || body === null || !isMkNameMode(nameMode)) return mkRefuse("invalid", 400);
  return mkAnswer(await mkThreadOpen(g.session, listing, body, nameMode, req));
}
