import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ACCOUNT_COOKIE, decodeSession } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { cookieValue } from "@/lib/live";
import { isStaging } from "@/lib/staging";

// My Account's way to the volunteer portal (volunteer.micromobility.sa, apps/volunteers): a one-time code
// (customer_handoff_create: two minutes, one use), traded there for the session. Signed out, or if the code cannot be made,
// the portal still opens: its opportunities are for anyone, and it asks for a sign-in when one is needed.
export const dynamic = "force-dynamic";

const PORTAL = "https://volunteer.micromobility.sa/";
const away = (to: string) => new Response(null, { status: 303, headers: { location: to, "cache-control": "no-store", "referrer-policy": "no-referrer" } });

/** The portal that reads this site's database, and whether a code made here means anything to it. The code is made in
 *  the database of the site that serves the request, so staging's (staging.micromobility.sa, the staging database) sent
 *  the live portal a code it could never find. The portal is the live one, or the https address this Worker is given as
 *  VOLUNTEER_PORTAL_URL (staging's site: the staging portal on its workers.dev address, apps/volunteers wrangler.jsonc env
 *  "staging"); staging with none given opens the live portal with no code. */
function portal(): { to: string; code: boolean } {
  let v: unknown;
  try { v = (getCloudflareContext().env as { VOLUNTEER_PORTAL_URL?: unknown }).VOLUNTEER_PORTAL_URL; } catch { /* not on the Worker */ }
  try {
    const u = new URL(String(v || process.env.VOLUNTEER_PORTAL_URL || ""));
    if (u.protocol === "https:") return { to: `${u.origin}/`, code: true };
  } catch { /* none given */ }
  return { to: PORTAL, code: !isStaging() };
}

export async function GET(req: Request) {
  const p = portal();
  const s = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!s || !p.code) return away(p.to);
  const r = await rpcServer<string>("customer_handoff_create", { p_id: s.id, p_token: s.token });
  return away(typeof r.data === "string" && /^[0-9a-f]{48}$/.test(r.data) ? `${p.to}?signin=${r.data}` : p.to);
}
