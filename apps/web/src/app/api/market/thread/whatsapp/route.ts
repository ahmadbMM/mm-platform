import { bodyId, marketGuard, mkAnswer, mkRefuse } from "@/lib/market/route";
import { mkShareWhatsapp } from "@/lib/market/server";
import { mkUnshareWhatsapp } from "@/lib/market/w3-server";

// POST /api/market/thread/whatsapp: "Share my WhatsApp" in one thread (market_share_whatsapp): the account's own
// number, as the database holds it, is shown to the other person of that thread from then on. The number is never
// sent by the browser and never answered to the one who shares it. Body {thread: number, on?: boolean}: `on` false
// takes the number back (the same function with p_on false; lib/market/w3-server.ts), anything else shares.
// Answers {ok: true, shared}, or {ok: false, error, detail?}: "invalid", "gone", "state" (the other person has not
// replied yet), "new" (a new account), "nophone", "blocked", "suspended", "limit" (detail whatsapp), "signin", "busy",
// and "absent" for taking it back on a database whose function does not take p_on yet.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const g = await marketGuard(req);
  if (!g.ok) return g.res;
  const thread = bodyId(g.body.thread), on = g.body.on;
  if (!thread || (on !== undefined && typeof on !== "boolean")) return mkRefuse("invalid", 400);
  if (on === false) return mkAnswer(await mkUnshareWhatsapp(g.session, thread, req), () => ({ shared: false }));
  return mkAnswer(await mkShareWhatsapp(g.session, thread, req), () => ({ shared: true }));
}
