import { marketGuard, mkAnswer } from "@/lib/market/route";
import { mkThreads } from "@/lib/market/server";

// GET /api/market/thread/list: the account's inbox (market_threads): its threads as a buyer and as a seller, the
// newest first, each with the listing's photo and title, the name the other person chose (or a shop's trade name), the
// last message and how many are unread. Nothing else about the other person is in it. Answers {ok: true, items}, or
// {ok: false, error}: "signin", "busy", "absent", "generic".
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await marketGuard(req, { read: true });
  if (!g.ok) return g.res;
  return mkAnswer(await mkThreads(g.session, req));
}
