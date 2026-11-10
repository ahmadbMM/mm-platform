import { getCloudflareContext } from "@opennextjs/cloudflare";

// What stands between the sign-in form and a password-guessing script. customer_login already
// locks one email or mobile, and one account, after repeated failures; that does nothing against
// one password tried across many accounts. So a connection gets 10 sign-in tries a minute here
// (Cloudflare's rate limiter, wrangler.jsonc), and - once its keys are set - every try carries a
// Cloudflare Turnstile check. Neither can lock anyone out when it is not there: no limiter (a
// local run) lets every try through, and no Turnstile secret means no check.

type Env = { LOGIN_LIMIT?: { limit(o: { key: string }): Promise<{ success: boolean }> }; TURNSTILE_SECRET_KEY?: string };

function env(): Env {
  try { return getCloudflareContext().env as Env; } catch { return {}; }
}

/** The visitor's address, as Cloudflare saw it. */
export const clientIp = (req: Request) => req.headers.get("cf-connecting-ip") || "";

/** What the tries are counted against: an IPv4 address whole, an IPv6 address's /64. A phone or a server is handed a
 *  whole /64, so a script giving every try a new address in it was never counted twice. An address that cannot be
 *  read is used as it is. */
export function ipNet(ip: string): string {
  if (!ip.includes(":")) return ip;
  if (ip.includes(".")) return ip.slice(ip.lastIndexOf(":") + 1); // an IPv4 address written as IPv6 (::ffff:203.0.113.9)
  const [head, tail] = ip.toLowerCase().split("::");
  const a = head ? head.split(":") : [], b = tail ? tail.split(":") : [];
  const groups = tail === undefined ? a : [...a, ...Array<string>(Math.max(0, 8 - a.length - b.length)).fill("0"), ...b];
  const net = groups.slice(0, 4);
  return net.length === 4 && net.every((g) => /^[0-9a-f]{1,4}$/.test(g)) ? `${net.map((g) => parseInt(g, 16).toString(16)).join(":")}::/64` : ip;
}

/** False once this connection has used its tries for the minute. */
export async function withinTries(req: Request): Promise<boolean> {
  const limiter = env().LOGIN_LIMIT;
  const ip = clientIp(req);
  if (!limiter || !ip) return true;
  try { return (await limiter.limit({ key: `sign-in:${ipNet(ip)}` })).success; } catch { return true; }
}

/** Whether the Turnstile check passes: true when Turnstile is not set up. */
export async function passesCheck(req: Request, token: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const secret = env().TURNSTILE_SECRET_KEY || process.env.TURNSTILE_SECRET_KEY || "";
  if (!secret) return true;
  if (!token) return false;
  try {
    const body = new FormData();
    body.set("secret", secret);
    body.set("response", token.slice(0, 2048));
    const ip = clientIp(req);
    if (ip) body.set("remoteip", ip);
    const r = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, signal: AbortSignal.timeout(5000) });
    const j = (await r.json()) as { success?: boolean };
    return j.success === true;
  } catch {
    return false; // the check could not be made: refuse, as Cloudflare advises
  }
}
