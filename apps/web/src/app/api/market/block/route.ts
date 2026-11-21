import { bodyId, marketGuard, mkAnswer, mkRefuse } from "@/lib/market/route";
import { mkBlock } from "@/lib/market/server";

// POST /api/market/block: the other person of a thread blocked, or no longer blocked (market_block). Body
// {thread: number, on: boolean}. While a block stands neither of the two can open a thread with, or write to, the
// other; only the one who blocked is ever told there is a block. Answers {ok: true, blocked}, or {ok: false, error}:
// "invalid", "gone" (not a thread of this account), "signin", "busy".
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const g = await marketGuard(req);
  if (!g.ok) return g.res;
  const thread = bodyId(g.body.thread), on = g.body.on;
  if (!thread || typeof on !== "boolean") return mkRefuse("invalid", 400);
  return mkAnswer(await mkBlock(g.session, thread, on, req), (d) => ({ blocked: d.blocked === true }));
}
