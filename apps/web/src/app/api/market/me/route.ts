import { marketGuard, mkAnswer, mkJson } from "@/lib/market/route";
import { mkMe } from "@/lib/market/server";

// GET /api/market/me: what the signed-in account may do in the Marketplace and what its forms need (market_me, with
// the account cookie's id and token): whether it is an adult by the birth date on file, whether it is an established
// account, its seller record and whether it has accepted the current rules, the name "first name and last initial"
// would show, its shop, its limits and what it has used of them today, and its unread threads. The selling form, the
// first-message pop-up, "Share my WhatsApp" and the shop pages all read it.
// Answers {ok: true, signedIn: false} for a visitor with no account cookie (no database call), {ok: true,
// signedIn: true, me: {...}} for an account, or {ok: false, error}: "signin" (a session the database refused), "busy",
// "absent" (a database without the Marketplace yet), "generic".
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await marketGuard(req, { read: true, signin: false });
  if (!g.ok) return g.res;
  if (!g.session) return mkJson({ ok: true, signedIn: false });
  return mkAnswer(await mkMe(g.session, req), (me) => ({ signedIn: true, me }));
}
