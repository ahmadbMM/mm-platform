import { getCloudflareContext } from "@opennextjs/cloudflare";
import { clientIp, ipNet } from "./sign-in-guard";

// Requests a script could repeat without end, each costing a log line or database reads: the page
// error reports (/api/log-error) and the pop-ups' checks every page makes for a signed-in rider
// (/api/account/pending-waiver, /api/account/pending-share, /api/account/pending-rating: one count
// for the three), and the waitlist claim page (/api/claim: a token cannot be guessed, but each try is
// a database read). The Origin check stops another site's pages, not a script. A connection gets 30 of
// each kind a minute (Cloudflare's rate limiter, API_LIMIT in wrangler.jsonc) - far more than a
// rider's pages ask for. With no limiter (a local run) or no address, every request goes through, as
// the sign-in's (lib/sign-in-guard.ts).

type Limiter = { limit(o: { key: string }): Promise<{ success: boolean }> };

function limiter(name: "API_LIMIT" | "API_WIDE_LIMIT" = "API_LIMIT"): Limiter | undefined {
  try { return (getCloudflareContext().env as { API_LIMIT?: Limiter; API_WIDE_LIMIT?: Limiter })[name]; } catch { return undefined; }
}
const wideLimiter = () => limiter("API_WIDE_LIMIT");

/** False once this connection has made the minute's requests of this kind. `who` counts one account on its own
 *  (the Ask pages, "ask": a room answering from one Wi-Fi shares an address, and thirty requests a minute between
 *  them would hold their answers back - each account gets the thirty, a connection with no account shares them).
 *  The signed-in account's checks and actions ("account-check": the pop-ups every page asks for, Wallet, I'm coming, a
 *  bike report...) are counted per account too (bug hunt 2026-11-18: fifteen members on a venue's Wi-Fi used up one
 *  thirty between them, and the pop-ups a rider cannot skip were let through), and the connection as a whole gets a
 *  wider ceiling (API_WIDE_LIMIT, 600 a minute), so a script that makes up a new account id for each request is still
 *  held. */
export async function withinLimit(req: Request, kind: "log-error" | "account-check" | "claim" | "ask", get: () => Limiter | undefined = limiter, who = "", wide: () => Limiter | undefined = wideLimiter): Promise<boolean> {
  const l = get();
  const ip = clientIp(req);
  if (!l || !ip) return true;
  const net = ipNet(ip); // an IPv6 visitor by its /64
  if (kind === "account-check" && who) {
    const w = wide();
    try { if (w && !(await w.limit({ key: `${kind}:${net}` })).success) return false; } catch { /* a limiter that fails holds nobody */ }
  }
  try { return (await l.limit({ key: `${kind}:${net}${who ? `:${who}` : ""}` })).success; } catch { return true; }
}
