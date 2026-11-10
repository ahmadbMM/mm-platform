import { sameOrigin } from "@/lib/account-core";
import { WALLET_ORIGIN, relayStatus } from "@/lib/rating";

// POST /api/petromin-pass {bookingNo, phone, sessionId, lang}: the Apple Wallet pass of a Petromin registration
// (forms/petromin, its "Add to Apple Wallet" button). The booking app makes it (its /api/wallet-pass, which reads the
// registration through rider_lookup with the number and the phone the booking was made with, as "Find my booking"
// does) and this route hands the file back from this site's own address: the form's page may not call another site
// from the browser. Only this site's pages may call it, and it only ever calls the booking app's own origin.
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const BOOKING_NO = /^[A-Z]-\d{3,4}$/;
const PHONE = /^\+\d{8,15}$/;
const SESSION = /^[A-Za-z0-9_-]{1,40}$/;
const LANG = /^[a-z]{2,3}$/;

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  let bookingNo = "", phone = "", sessionId = "", lang = "en";
  try {
    const b = (await req.json()) as Record<string, unknown>;
    bookingNo = typeof b.bookingNo === "string" ? b.bookingNo.trim().toUpperCase() : "";
    phone = typeof b.phone === "string" ? b.phone.trim() : "";
    sessionId = typeof b.sessionId === "string" ? b.sessionId : "";
    if (typeof b.lang === "string" && LANG.test(b.lang)) lang = b.lang;
  } catch { /* empty body */ }
  if (!BOOKING_NO.test(bookingNo) || !PHONE.test(phone) || !SESSION.test(sessionId)) return json({ ok: false, error: "invalid" }, 400);
  try {
    const up = await fetch(`${WALLET_ORIGIN}/api/wallet-pass`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/vnd.apple.pkpass, application/json" },
      body: JSON.stringify({ petromin: { bookingNo, phone, sessionId, lang } }),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (up.ok && /pkpass/.test(up.headers.get("content-type") ?? "")) {
      return new Response(up.body, {
        status: 200,
        headers: { "content-type": "application/vnd.apple.pkpass", "content-disposition": `attachment; filename="booking-${bookingNo}.pkpass"`, "cache-control": "no-store" },
      });
    }
    // only the outcome travels back: 404 the booking was not found, 501 the booking app makes no passes yet
    const body = (await up.json().catch(() => null)) as Record<string, unknown> | null;
    return json({ ok: false, ...(body && typeof body.error === "string" ? { error: body.error } : {}) }, up.ok ? 502 : relayStatus(up.status));
  } catch {
    return json({ ok: false, error: "network" }, 502);
  }
}
