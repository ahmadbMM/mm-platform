import { ACCOUNT_COOKIE, decodeSession, sameOrigin } from "@/lib/account-core";
import { cookieValue } from "@/lib/live";
import { ENTRY_ID, bookingOrigin } from "@/lib/rating";
import { loadSiteContent } from "@/lib/site";

// POST /api/google-wallet {bookingId, groupIds?}: the booking app makes the Google Wallet pass
// (its own /api/google-wallet, which reads the booking through the token-checked my_bookings and
// signs a save link); this route adds the rider's id and session token from the HttpOnly account
// cookie and hands the answer back as it came - 501 when the booking app is not set up for Google
// Wallet (the button then hides), 409 while a ride staff approve has not confirmed the rider, the
// save link otherwise. Only this site's pages may call it.
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ ok: false, error: "signin" }, 401);
  let bookingId = "", groupIds: string[] = [];
  try {
    const b = (await req.json()) as { bookingId?: unknown; groupIds?: unknown };
    bookingId = typeof b.bookingId === "string" ? b.bookingId : "";
    groupIds = Array.isArray(b.groupIds) ? b.groupIds.filter((x): x is string => typeof x === "string" && ENTRY_ID.test(x)).slice(0, 50) : [];
  } catch { /* empty body */ }
  if (!ENTRY_ID.test(bookingId)) return json({ ok: false, error: "invalid" }, 400);
  const origin = bookingOrigin(await loadSiteContent());
  try {
    const up = await fetch(`${origin}/api/google-wallet`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ customerId: acct.id, token: acct.token, bookingId, groupIds }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const body = (await up.json().catch(() => null)) as Record<string, unknown> | null;
    // only what the button needs travels back: the outcome and the save link
    const url = body && typeof body.url === "string" && /^https:\/\/pay\.google\.com\//.test(body.url) ? body.url : undefined;
    return json({ ok: up.ok && body?.ok === true && !!url, ...(url ? { url } : {}), ...(body && typeof body.error === "string" ? { error: body.error } : {}) }, up.status);
  } catch {
    return json({ ok: false, error: "network" }, 502);
  }
}
