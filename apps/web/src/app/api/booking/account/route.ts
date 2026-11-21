import { ACCOUNT_COOKIE, decodeSession } from "@/lib/account-core";
import { bookingAccount, rpcCall } from "@/lib/booking-server";
import { cookieValue } from "@/lib/live";

// GET /api/booking/account: the signed-in account as the booking steps need it (lib/booking-server.ts bookingAccount): its
// name and height, the bike types staff hid on it, its house rule, the community tag, the sessions it holds or was turned
// down for, the details staff asked for (customer_fix_fields) and the profile page's asks (the nationality from the first
// booking, the birth date from the fourth), and its gender. Read with the id and token from the account cookie only, every
// time the steps open: the page itself is never cached for one rider. { signedIn: false } when there is no session or the
// booking app no longer takes its token; a read that failed says so (502), and the steps offer Try again.
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function GET(req: Request) {
  const s = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!s) return json({ ok: true, signedIn: false });
  const prof = await rpcCall<Record<string, unknown>[]>("customer_profile", { p_id: s.id, p_token: s.token });
  if (prof.status === 0 || prof.status >= 500) return json({ ok: false }, 502);
  const profile = Array.isArray(prof.data) ? prof.data[0] : null;
  if (!profile) return json({ ok: true, signedIn: false });
  try {
    const acct = await bookingAccount({ ...s, name: String(profile.name ?? ""), profile });
    return json({ ok: true, signedIn: true, acct });
  } catch {
    return json({ ok: false }, 502);
  }
}
