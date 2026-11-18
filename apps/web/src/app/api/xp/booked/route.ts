import { ACCOUNT_COOKIE, decodeSession } from "@/lib/account-core";
import { rpcCall } from "@/lib/booking-server";
import { cookieValue } from "@/lib/live";
import { payReady } from "@/lib/pay/config";
import { payView } from "@/lib/pay/server";
import { loadTicketSessions } from "@/lib/tickets-data";
import { ticketRow, type TicketRow } from "@/lib/tickets";

// GET /api/xp/booked?pay=<payment>: the tickets a paid ride payment bought, for Experiences' confirmation after the
// payment page (EM09-B; the user, 2026-11-18: "do all"). Read with the rider's own id and token from the account cookie
// (my_bookings returns their rows alone), and only the rows that payment paid; nothing for a payment not yet paid, not
// a ride's, or not theirs. The ride's name is the session's title as the payment page shows it (null on the circuit).
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function GET(req: Request) {
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ ok: false, error: "signin" }, 401);
  const id = new URL(req.url).searchParams.get("pay") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !payReady()) return json({ ok: false, error: "invalid" }, 400);
  const v = await payView(id);
  if (!v || v.kind !== "booking" || !["paid", "partly_refunded"].includes(v.status)) return json({ ok: false, error: "not_found" }, 404);
  const ids = new Set((v.rides ?? []).map((r) => r.id));
  const mine = await rpcCall<Record<string, unknown>[]>("my_bookings", { p_id: acct.id, p_token: acct.token });
  const tickets = (Array.isArray(mine.data) ? mine.data : []).filter((r) => ids.has(String(r.id))).map(ticketRow).filter((x): x is TicketRow => !!x);
  if (!tickets.length) return json({ ok: false, error: "not_found" }, 404);
  const sid = tickets[0].sessionId;
  const session = (await loadTicketSessions([sid], acct)).get(sid) ?? null;
  return json({ ok: true, tickets, session, name: (v.rides ?? [])[0]?.title ?? "" });
}
