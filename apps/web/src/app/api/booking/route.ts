import { ACCOUNT_COOKIE, decodeSession, sameOrigin } from "@/lib/account-core";
import { makeBooking, readInput, rpcCall } from "@/lib/booking-server";
import { cookieValue } from "@/lib/live";
import { loadTicketSessions } from "@/lib/tickets-data";
import { bfFor, ticketRow, type TicketRow } from "@/lib/tickets";
import { riyadhClock } from "@/lib/workshop-days";

// POST /api/booking: a rider books a ride on the website (the owner, 2026-10-03: full booking on
// the website; the user, 2026-11-19: "make sure all customers can do everything they want in the booking app to do it on
// the main website"), through the booking app's own customer_create_booking with the id and token from the account
// cookie - never from the body. The body names the ride and the riders; every price is the database's
// (_enforce_booking_price), every rule the app's (lib/booking-server.ts) and the database's. Only this site's own pages
// may call it. The answer is the tickets. Paid rides are paid at the desk, as in the booking app: paying online stays on
// staging until Moyasar can run on live (the user, 2026-11-19), so nothing here starts a payment. No email is sent (the
// user, 2026-11-08: no email or SMS messages for now).
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const STATUS: Record<string, number> = { signin: 401, origin: 403, invalid: 400, generic: 502 };

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ ok: false, error: "signin" }, 401);
  let body: unknown = null;
  try { body = await req.json(); } catch { /* empty body */ }
  const input = readInput(body);
  if (!input) return json({ ok: false, error: "invalid" }, 400);
  const prof = await rpcCall<Record<string, unknown>[]>("customer_profile", { p_id: acct.id, p_token: acct.token });
  const profile = Array.isArray(prof.data) ? prof.data[0] : null;
  if (!profile) return json({ ok: false, error: prof.status === 0 || prof.status >= 500 ? "generic" : "signin" }, prof.status === 0 || prof.status >= 500 ? 502 : 401);
  const today = riyadhClock(new Date()).slice(0, 10);
  const r = await makeBooking({ ...acct, name: String(profile.name ?? ""), profile }, input, today);
  if (!r.ok) return json({ ok: false, error: r.error, ...(r.detail ? { detail: r.detail } : {}) }, STATUS[r.error] ?? 409);

  // The tickets as My Account draws them: my_bookings' rows, and the session as the ticket reads it.
  const order = new Map(r.booked.map((b, i) => [b.id, i]));
  const tickets = r.rows.map(ticketRow).filter((x): x is TicketRow => !!x).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  // read with the account's token (list_sessions), as My Account's tickets are: a private ride keeps its name
  const sessions = await loadTicketSessions([input.sessionId], acct);
  // A breakfast spot for community members only (bike_slots._bfm, 2026-11-13; lib/tickets.ts bfFor) is told on the
  // confirmation's ticket to a member alone, as My Account's ticket tells it: the members gate's own answer, asked only
  // for such a ride; a failed check reads as no.
  const read = sessions.get(input.sessionId) ?? null;
  const session = read?.bfMembers ? bfFor(read, (await rpcCall<boolean>("community_member", { p_id: acct.id, p_token: acct.token })).data === true) : read;
  return json({
    ok: true,
    tickets,
    session,
    // the rows as the database stored them, for a ticket my_bookings did not return in time
    booked: r.booked,
    addonsSaved: r.addonsSaved,
    ...(r.lockerSay ? { locker: r.lockerSay } : {}),
  });
}
