import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ACCOUNT_COOKIE, decodeSession, sameOrigin } from "@/lib/account-core";
import { makeBooking, payableOnline, readInput, rpcCall } from "@/lib/booking-server";
import { payReady } from "@/lib/pay/config";
import { langOf } from "@/lib/pay/http";
import { payRpc, refusal } from "@/lib/pay/server";
import { paySettings } from "@/lib/pay/settings";
import { loadSiteContent } from "@/lib/site";
import { BOOKING_URL } from "@/lib/links";
import { cookieValue } from "@/lib/live";
import { loadTicketSessions } from "@/lib/tickets-data";
import { ticketRow, type TicketRow } from "@/lib/tickets";
import { riyadhClock } from "@/lib/workshop-days";

// POST /api/booking: a rider books a ride on the website (the owner, 2026-10-03: full booking on
// the website), through the booking app's own customer_create_booking with the id and token from
// the account cookie - never from the body. The body names the ride and the riders; every price
// is the database's (_enforce_booking_price), every rule the app's (lib/booking-server.ts) and
// the database's. Only this site's own pages may call it. The answer is the tickets.
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const STATUS: Record<string, number> = { signin: 401, origin: 403, invalid: 400, generic: 502 };

/** The confirmation email, as the booking app sends it (_sendBookingEmail): its own
 *  /api/booking-confirm re-reads the booking with the rider's token and emails the address on
 *  it. It does nothing until the booking app's email keys are set. Fire and forget. */
function sendConfirmation(customerId: string, token: string, bookingId: string) {
  let origin = "";
  try { origin = new URL(BOOKING_URL).origin; } catch { return; }
  const p = fetch(`${origin}/api/booking-confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ customerId, token, bookingId }),
    signal: AbortSignal.timeout(5000),
  }).then(() => undefined, () => undefined);
  try { getCloudflareContext().ctx.waitUntil(p); } catch { /* a local run: the promise runs on its own */ }
}

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
  if (!r.ok) return json({ ok: false, error: r.error }, STATUS[r.error] ?? 409);

  // Paying online (2026-11-10, staging first): a paid ride is paid now when staff made it required, or when
  // the rider chose it where it is optional. The places just booked are held for pay.holdMinutes while the
  // rider pays on /pay/<id> and let go by themselves when unpaid (rentals 20261110150000). A waitlisted place
  // pays nothing now. If the payment cannot even start where paying is required, the booking is undone
  // rather than left as a place nobody pays for.
  const ps = paySettings(await loadSiteContent());
  const seated = r.booked.filter((b) => b.status !== "waitlist").map((b) => b.id);
  let payDue = false;
  if (ps.enabled && payReady() && ps.bookings !== "off" && payableOnline(r.session) && seated.length
      && (ps.bookings === "required" || input.payNow)) {
    const p = await payRpc<{ id: string | null }>("pay_booking_start", {
      p_id: acct.id, p_token: acct.token, p_ids: seated, p_hold: true, p_wallet: input.wallet, p_lang: langOf((body as Record<string, unknown> | null)?.lang),
    });
    if (p.status === 200 && p.data?.id) return json({ ok: true, pay: { id: p.data.id, url: `/pay/${p.data.id}` } });
    if (!(p.status === 200 && p.data) && ps.bookings === "required") {
      // The undo is read (bug hunt 2026-11-11): asked twice, and a second answer that the rows are no longer open
      // means the first one went through unheard. An undo that still fails leaves the places booked and unpaid, so
      // the rider is given the tickets with Pay now rather than told nothing was booked.
      const undo = () => payRpc("pay_booking_cancel", { p_id: acct.id, p_token: acct.token, p_ids: r.booked.map((b) => b.id), p_dest: "wallet" });
      let u = await undo();
      if (u.status !== 200) u = await undo();
      if (u.status === 200 || refusal(u) === "PAY_NOT_OPEN") return json({ ok: false, error: "pay_start" }, 502);
      payDue = true;
    }
    // the wallet paid it all, or (paying being the rider's choice) it could not start: the tickets, paid at the desk
  }
  sendConfirmation(acct.id, acct.token, r.booked[0].id);
  // The tickets as My Account draws them: my_bookings' rows, and the session as the ticket reads it.
  const order = new Map(r.booked.map((b, i) => [b.id, i]));
  const tickets = r.rows.map(ticketRow).filter((x): x is TicketRow => !!x).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  // read with the account's token (list_sessions), as My Account's tickets are: a private ride keeps its name
  const sessions = await loadTicketSessions([input.sessionId], acct);
  return json({
    ok: true,
    tickets,
    session: sessions.get(input.sessionId) ?? null,
    // the rows as the database stored them, for a ticket my_bookings did not return in time
    booked: r.booked,
    addonsSaved: r.addonsSaved,
    // paying was required but could not start, and the booking could not be undone: the tickets carry Pay now
    ...(payDue ? { payDue: true } : {}),
  });
}
