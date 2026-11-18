import { sameOrigin } from "@/lib/account-core";
import { WALLET_ORIGIN, relayStatus } from "@/lib/rating";
import { withinLimit } from "@/lib/rate-limit";

// POST /api/store/google-pass {no, key, lang}: the Google Wallet pickup pass of a store order (N02, builder B4), made by
// the booking app (its /api/google-wallet with {storeOrder: {no, key, lang}}, reading the order through store_order_pass
// as the Apple pass does) and answered as a save link. Only this site's pages may call it, metered per visitor; it only
// ever calls the booking app's own origin, and only a pay.google.com link travels back. 501 while the booking app is not
// set up for Google Wallet (the button asks GET /api/google-wallet?ready first and is drawn only on yes).
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  if (!(await withinLimit(req, "pay"))) return json({ ok: false, error: "busy" }, 429);
  let no = 0, key = "", lang = "en";
  try {
    const b = (await req.json()) as Record<string, unknown>;
    no = typeof b.no === "number" ? b.no : Number(b.no);
    key = typeof b.key === "string" ? b.key.trim().toLowerCase() : "";
    if (b.lang === "ar") lang = "ar";
  } catch { /* empty body */ }
  if (!Number.isInteger(no) || no < 1 || no > 999999999 || !/^[0-9a-f]{32}$/.test(key)) return json({ ok: false, error: "invalid" }, 400);
  try {
    const up = await fetch(`${WALLET_ORIGIN}/api/google-wallet`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ storeOrder: { no, key, lang } }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const body = (await up.json().catch(() => null)) as Record<string, unknown> | null;
    const url = body && typeof body.url === "string" && /^https:\/\/pay\.google\.com\//.test(body.url) ? body.url : undefined;
    return json({ ok: up.ok && body?.ok === true && !!url, ...(url ? { url } : {}), ...(body && typeof body.error === "string" ? { error: body.error } : {}) }, relayStatus(up.status));
  } catch {
    return json({ ok: false, error: "network" }, 502);
  }
}
