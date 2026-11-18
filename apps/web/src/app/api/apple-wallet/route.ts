import { ACCOUNT_COOKIE, decodeSession, sameOrigin } from "@/lib/account-core";
import { cookieValue } from "@/lib/live";
import { ENTRY_ID, WALLET_ORIGIN, relayStatus } from "@/lib/rating";

// POST /api/apple-wallet {bookingId, lang?}: the Apple Wallet pass of the rider's own booking (EF19, the website's
// confirmation and ticket; the user, 2026-11-18: "do all"). The booking app makes it (its /api/wallet-pass, which reads
// the booking through the token-checked my_bookings, as its own Add to Apple Wallet does); this route adds the rider's
// id and session token from the HttpOnly account cookie, never from the body, and hands the file back from this site's
// own address. Only this site's pages may call it, and it only ever calls the booking app's own origin.
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const LANG = /^[a-z]{2,3}$/;

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ ok: false, error: "signin" }, 401);
  let bookingId = "", lang = "en";
  try {
    const b = (await req.json()) as Record<string, unknown>;
    bookingId = typeof b.bookingId === "string" ? b.bookingId : "";
    if (typeof b.lang === "string" && LANG.test(b.lang)) lang = b.lang;
  } catch { /* empty body */ }
  if (!ENTRY_ID.test(bookingId)) return json({ ok: false, error: "invalid" }, 400);
  try {
    const up = await fetch(`${WALLET_ORIGIN}/api/wallet-pass`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/vnd.apple.pkpass, application/json" },
      body: JSON.stringify({ customerId: acct.id, token: acct.token, bookingId, lang }),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (up.ok && /pkpass/.test(up.headers.get("content-type") ?? "")) {
      return new Response(up.body, {
        status: 200,
        headers: { "content-type": "application/vnd.apple.pkpass", "content-disposition": `attachment; filename="booking-${bookingId.slice(0, 6)}.pkpass"`, "cache-control": "no-store" },
      });
    }
    // only the outcome travels back: 404 not the rider's booking, 501 the booking app makes no passes yet
    const body = (await up.json().catch(() => null)) as Record<string, unknown> | null;
    return json({ ok: false, ...(body && typeof body.error === "string" ? { error: body.error } : {}) }, up.ok ? 502 : relayStatus(up.status));
  } catch {
    return json({ ok: false, error: "network" }, 502);
  }
}
