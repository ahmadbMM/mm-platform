import { marketGuard, mkAnswer, mkJson } from "@/lib/market/route";
import { mkUnread } from "@/lib/market/server";

// GET /api/market/unread: how many of the account's Marketplace threads hold something unread (market_unread), for
// the number beside the header's Marketplace link and on My Account's inbox row. A visitor with no account cookie is
// answered {ok: true, signedIn: false, n: 0} from the cookie alone: the database is asked for signed-in accounts only.
// An account: {ok: true, signedIn: true, n}. Never kept, by a browser or at the edge (every Marketplace answer is
// no-store, private; lib/page-cache.ts keeps no /api address). {ok: false, error}: "signin" (a session the database
// refused), "busy", "absent", "generic".
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await marketGuard(req, { read: true, signin: false });
  if (!g.ok) return g.res;
  if (!g.session) return mkJson({ ok: true, signedIn: false, n: 0 });
  return mkAnswer(await mkUnread(g.session), (d) => ({ signedIn: true, n: Math.max(0, Math.floor(Number(d.n) || 0)) }));
}
