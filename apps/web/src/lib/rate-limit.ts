import { getCloudflareContext } from "@opennextjs/cloudflare";
import { clientIp } from "./sign-in-guard";

// Requests a script could repeat without end, each costing a log line or database reads: the page
// error reports (/api/log-error) and the pop-ups' checks every page makes for a signed-in rider
// (/api/account/pending-waiver, /api/account/pending-share, /api/account/pending-rating: one count
// for the three). The Origin check stops another site's pages, not a script. A connection gets 30 of
// each kind a minute (Cloudflare's rate limiter, API_LIMIT in wrangler.jsonc) - far more than a
// rider's pages ask for. With no limiter (a local run) or no address, every request goes through, as
// the sign-in's (lib/sign-in-guard.ts).

type Limiter = { limit(o: { key: string }): Promise<{ success: boolean }> };

function limiter(): Limiter | undefined {
  try { return (getCloudflareContext().env as { API_LIMIT?: Limiter }).API_LIMIT; } catch { return undefined; }
}

/** False once this connection has made the minute's requests of this kind. */
export async function withinLimit(req: Request, kind: "log-error" | "account-check", get: () => Limiter | undefined = limiter): Promise<boolean> {
  const l = get();
  const ip = clientIp(req);
  if (!l || !ip) return true;
  try { return (await l.limit({ key: `${kind}:${ip}` })).success; } catch { return true; }
}
