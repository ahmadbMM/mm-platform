import { ACCOUNT_COOKIE, decodeSession, sameOrigin } from "@/lib/account-core";
import { rpcCall } from "@/lib/booking-server";
import { cookieValue } from "@/lib/live";

// POST /api/booking/promo {code}: a code that belongs to one account (promo_codes.customer_id),
// looked up with the signed-in rider's own id and token from the cookie, as the booking app's
// applyPromoCode does. Any other code the browser asks promo_lookup about itself, with the public
// key, so the lookups stay metered per visitor (the function meters them per network) and not
// per the site's server. The answer only previews the discount: the booking's price is the
// database's. Only this site's own pages may call it.
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, reason: "origin" }, 403);
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ ok: false, reason: "signin" }, 401);
  let code = "";
  try { code = String(((await req.json()) as { code?: unknown })?.code ?? "").trim(); } catch { /* empty body */ }
  if (!code || code.length > 40) return json({ ok: false, reason: "invalid" });
  const r = await rpcCall<Record<string, unknown>>("promo_lookup", { p_code: code, p_id: acct.id, p_token: acct.token });
  if (r.error || !r.data || typeof r.data !== "object") return json({ ok: false, reason: "generic" }, 502);
  const d = r.data;
  if (d.ok !== true) return json({ ok: false, reason: typeof d.reason === "string" ? d.reason : "invalid" });
  return json({ ok: true, code: d.code, kind: d.kind, value: d.value, applies_to: d.applies_to ?? null });
}
