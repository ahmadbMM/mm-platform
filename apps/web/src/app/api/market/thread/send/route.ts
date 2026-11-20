import { bodyId, bodyText, marketGuard, mkAnswer, mkRefuse } from "@/lib/market/route";
import { mkThreadSend } from "@/lib/market/server";

// POST /api/market/thread/send: one more message in a thread the account is in (market_thread_send). Body
// {thread: number, body: string}. Answers {ok: true, message: {id, mine, body, at}} with the words as the database kept
// them, or {ok: false, error, detail?}: "invalid", "gone" (not a thread of this account), "blocked", "state" (the
// listing was taken down), "link", "phone", "input", "limit" (detail messages | wait: a buyer's three messages before
// the seller's first reply), "birth", "adult", "suspended", "signin", "busy".
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const g = await marketGuard(req);
  if (!g.ok) return g.res;
  const thread = bodyId(g.body.thread), body = bodyText(g.body.body, 4000);
  if (!thread || body === null) return mkRefuse("invalid", 400);
  return mkAnswer(await mkThreadSend(g.session, thread, body, req));
}
