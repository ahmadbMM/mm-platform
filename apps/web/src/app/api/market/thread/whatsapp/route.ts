import { bodyId, marketGuard, mkAnswer, mkRefuse } from "@/lib/market/route";
import { mkShareWhatsapp } from "@/lib/market/server";

// POST /api/market/thread/whatsapp: "Share my WhatsApp" in one thread (market_share_whatsapp): the account's own
// number, as the database holds it, is shown to the other person of that thread from then on (the contract: once
// shared it stays on the thread). The number is never sent by the browser and never answered to the one who shares it.
// Body {thread: number}. Answers {ok: true, shared: true}, or {ok: false, error, detail?}: "invalid", "gone", "state"
// (the other person has not replied yet), "new" (a new account), "nophone", "blocked", "suspended", "limit" (detail
// whatsapp), "signin", "busy".
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const g = await marketGuard(req);
  if (!g.ok) return g.res;
  const thread = bodyId(g.body.thread);
  if (!thread) return mkRefuse("invalid", 400);
  return mkAnswer(await mkShareWhatsapp(g.session, thread, req), () => ({ shared: true }));
}
