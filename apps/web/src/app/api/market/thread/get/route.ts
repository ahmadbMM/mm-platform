import { listingIdOf } from "@/lib/market/core";
import { marketGuard, mkAnswer, mkRefuse } from "@/lib/market/route";
import { mkThreadGet } from "@/lib/market/server";

// GET /api/market/thread/get?id=<thread>&before=<message>: one thread of the account's and its messages, oldest
// first (market_thread_get): the latest hundred, or the hundred before message `before`; `more` says older ones
// exist. Reading it marks the thread read. The thread's page asks it again at a gentle interval while it is in view.
// Answers {ok: true, thread, messages, more}, or {ok: false, error}: "invalid" (an id that is not a number), "gone"
// (not a thread of this account), "signin", "busy", "absent", "generic".
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await marketGuard(req, { read: true });
  if (!g.ok) return g.res;
  const q = new URL(req.url).searchParams;
  const thread = listingIdOf(q.get("id") ?? "");
  const raw = q.get("before");
  const before = raw === null || raw === "" ? null : listingIdOf(raw);
  if (!thread || (raw !== null && raw !== "" && !before)) return mkRefuse("invalid", 400);
  return mkAnswer(await mkThreadGet(g.session, thread, before, req));
}
