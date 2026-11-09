import { ACCOUNT_COOKIE, decodeSession } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { cookieValue } from "@/lib/live";

// My Account's Manage on Your lockers (2026-11-09): the lockers page (micromobility.sa/lockers), signed in there by a
// one-time code (customer_handoff_create: two minutes, one use) it trades for the session, so Change and Remove are a
// tap away. Signed out, or if the code cannot be made, the page still opens and asks for the sign-in itself.
export const dynamic = "force-dynamic";

const away = (to: string) => new Response(null, { status: 303, headers: { location: to, "cache-control": "no-store", "referrer-policy": "no-referrer" } });

export async function GET(req: Request) {
  const lang = new URL(req.url).searchParams.get("lang") === "ar" ? "ar" : "en";
  const to = `/lockers?lang=${lang}`;
  const s = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!s) return away(to);
  const r = await rpcServer<string>("customer_handoff_create", { p_id: s.id, p_token: s.token });
  return away(typeof r.data === "string" && /^[0-9a-f]{48}$/.test(r.data) ? `${to}&code=${r.data}` : to);
}
