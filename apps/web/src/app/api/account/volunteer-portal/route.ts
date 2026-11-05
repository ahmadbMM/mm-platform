import { ACCOUNT_COOKIE, decodeSession } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { cookieValue } from "@/lib/live";

// My Account's way to the volunteer portal (volunteer.micromobility.sa, apps/volunteers): a one-time code
// (customer_handoff_create: two minutes, one use), traded there for the session. Signed out, or if the code cannot be made,
// the portal still opens: its opportunities are for anyone, and it asks for a sign-in when one is needed.
export const dynamic = "force-dynamic";

const PORTAL = "https://volunteer.micromobility.sa/";
const away = (to: string) => new Response(null, { status: 303, headers: { location: to, "cache-control": "no-store", "referrer-policy": "no-referrer" } });

export async function GET(req: Request) {
  const s = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!s) return away(PORTAL);
  const r = await rpcServer<string>("customer_handoff_create", { p_id: s.id, p_token: s.token });
  return away(typeof r.data === "string" && /^[0-9a-f]{48}$/.test(r.data) ? `${PORTAL}?signin=${r.data}` : PORTAL);
}
