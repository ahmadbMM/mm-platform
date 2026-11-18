import { sameOrigin } from "@/lib/account-core";
import { WALLET_ORIGIN, relayStatus } from "@/lib/rating";
import { withinLimit } from "@/lib/rate-limit";

// POST /api/store/wallet-pass {no, key, lang}: the Apple Wallet pickup pass of a store order (N02, builder B4). The
// booking app makes it (its /api/wallet-pass with {storeOrder: {no, key, lang}}: it reads the order through the
// database's store_order_pass with the order's number and its own key, as the order's link does, and signs a pass that
// holds the order number, a counter QR, the pickup day, the handover window and the showroom) and this route hands the
// file back from this site's own address. Only this site's pages may call it, metered per visitor, and it only ever
// calls the booking app's own origin. 501 while the booking app makes no passes (the button then goes away).
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
    const up = await fetch(`${WALLET_ORIGIN}/api/wallet-pass`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/vnd.apple.pkpass, application/json" },
      body: JSON.stringify({ storeOrder: { no, key, lang } }),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (up.ok && /pkpass/.test(up.headers.get("content-type") ?? "")) {
      return new Response(up.body, {
        status: 200,
        headers: { "content-type": "application/vnd.apple.pkpass", "content-disposition": `attachment; filename="order-MM-${no}.pkpass"`, "cache-control": "no-store" },
      });
    }
    // only the outcome travels back: 404 no such order, 409 not a pickup order still to collect, 501 no passes yet
    const body = (await up.json().catch(() => null)) as Record<string, unknown> | null;
    return json({ ok: false, ...(body && typeof body.error === "string" ? { error: body.error } : {}) }, up.ok ? 502 : relayStatus(up.status));
  } catch {
    return json({ ok: false, error: "network" }, 502);
  }
}
