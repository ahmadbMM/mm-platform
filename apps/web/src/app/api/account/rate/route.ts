import { ACCOUNT_COOKIE, decodeSession, sameOrigin } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { cookieValue } from "@/lib/live";
import { cleanRating } from "@/lib/rating";
import { bizOf } from "@/lib/biz";
import { loadSiteContent } from "@/lib/site";

// POST /api/account/rate {entryId, form, s, why, skipBf?, note?}: a rider rates a completed booking,
// as the booking app's own post-ride rating does (lib/rating.ts cleanRating), through
// customer_booking_update with the account cookie's id and token (the function checks the token
// and that the booking is the rider's own, and cleans rating_detail again). Only this site's pages
// may call it.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ ok: false, error: "signin" }, 401);
  let body: unknown = null;
  try { body = await req.json(); } catch { /* empty body */ }
  // A rating at all (no reason asked of any score yet), before the site's content is read; then
  // checked again with the booking app's rg_low: a score at or under it needs its reason (Settings >
  // Business, lib/biz.ts).
  if (!cleanRating(body, 0)) return json({ ok: false, error: "invalid" }, 400);
  const rating = cleanRating(body, bizOf(await loadSiteContent()).rgLow);
  if (!rating) return json({ ok: false, error: "invalid" }, 400);
  const r = await rpcServer<unknown>("customer_booking_update", { p_id: acct.id, p_token: acct.token, p_entry_id: rating.entryId, p_patch: rating.patch });
  if (r.status === 0 || r.status >= 500) return json({ ok: false, error: "generic" }, 502);
  // The database's own refusals of a booking change (rentals, 2026-10-05), said as such: a waiver
  // older than the ride's (the page is out of date) and a paid booking moved to another fare.
  if (/WAIVER_OUTDATED/.test(r.message)) return json({ ok: false, error: "outdated" }, 409);
  if (/PAID_MOVE/.test(r.message)) return json({ ok: false, error: "paid_move" }, 409);
  if (r.status >= 400) return json({ ok: false, error: /denied|token|FORBIDDEN/i.test(r.message) ? "signin" : "refused" }, r.status === 401 || r.status === 403 ? 401 : 400);
  if (r.data === false) return json({ ok: false, error: "refused" }, 409);
  return json({ ok: true });
}
