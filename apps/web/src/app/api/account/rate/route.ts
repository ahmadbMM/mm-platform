import { ACCOUNT_COOKIE, decodeSession, sameOrigin } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { cookieValue } from "@/lib/live";
import { cleanRating, tagsRefused, withoutTags } from "@/lib/rating";

// POST /api/account/rate {entryId, exp, bike?, tags?, note?}: a rider rates a completed booking, as
// the booking app's own post-ride rating does, through customer_booking_update with the account
// cookie's id and token (the function checks the token and that the booking is the rider's own).
// A database from before the rating_tags migration refuses the tags: the write is made again
// without them, so the scores and the note still land. Only this site's pages may call it.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ ok: false, error: "signin" }, 401);
  let body: unknown = null;
  try { body = await req.json(); } catch { /* empty body */ }
  const rating = cleanRating(body);
  if (!rating) return json({ ok: false, error: "invalid" }, 400);
  const write = (patch: unknown) => rpcServer<unknown>("customer_booking_update", { p_id: acct.id, p_token: acct.token, p_entry_id: rating.entryId, p_patch: patch });
  let r = await write(rating.patch);
  if (r.status >= 400 && rating.patch.rating_tags && tagsRefused(r.message)) r = await write(withoutTags(rating.patch));
  if (r.status === 0 || r.status >= 500) return json({ ok: false, error: "generic" }, 502);
  if (r.status >= 400) return json({ ok: false, error: /denied|token|FORBIDDEN/i.test(r.message) ? "signin" : "refused" }, r.status === 401 || r.status === 403 ? 401 : 400);
  if (r.data === false) return json({ ok: false, error: "refused" }, 409);
  return json({ ok: true });
}
