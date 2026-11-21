import { mkJson, mkRefuse } from "@/lib/market/route";
import { purgeMarketPhotos } from "@/lib/market/server";
import { withinLimit } from "@/lib/rate-limit";

// POST /api/market/purge: the photos the database no longer wants are removed from the storage (lib/market/server.ts
// purgeMarketPhotos: market_purge_take names them, and the bucket lets go only of a name the database marked). The
// database's daily job asks for it (mm-market-tick, through pg_net) once it has marked the photos of listings deleted
// 30 days ago or expired 60 days ago; the selling routes do the same behind their own answers (purgeLater). It takes
// no account and no body, and anyone may ask: it can only remove what the database already decided to remove, a
// hundred names at a time, and a connection's requests are counted like the Marketplace's others.
// Answers {ok: true, removed: <how many names were sent for removal>}, or {ok: false, error: "busy"}.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await withinLimit(req, "market"))) return mkRefuse("busy", 429);
  return mkJson({ ok: true, removed: await purgeMarketPhotos(100) });
}
