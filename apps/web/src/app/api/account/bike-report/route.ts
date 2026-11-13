import { ACCOUNT_COOKIE, decodeSession, sameOrigin } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { bikeReportAnswer, bikeReportBody } from "@/lib/bike-report";
import { emAbsent } from "@/lib/emergency";
import { cookieValue } from "@/lib/live";
import { withinLimit } from "@/lib/rate-limit";

// POST /api/account/bike-report {booking, fault, note?, bike?}: "Report a bike problem" from a ticket (TicketCard,
// TicketBikeReport; the booking app's bike-report.js, 2026-11-13), through bike_report (rentals migration 20261114081500)
// with the account cookie's id and token: the account's own booking, checked in, the bike on it (the first when none is
// named), one of the seven faults and a note of 300 characters at most. Answers {ok: true, at}, or {ok: false, error}:
// "limit" when the database's limits refuse it (the ticket shows the same chip as after a report taken and says nothing),
// "none" when the booking or bike is not one it takes, "closed" more than 3 hours after the session (the ticket draws the
// page again for both), "absent" when the database has no such function yet (the button goes), "invalid" for a body it
// cannot read, "signin" when the account is signed out, "busy" or "generic". Only this site's pages may call it; a
// connection sends 30 a minute at most.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store, private" } });
const REFUSED: Record<string, number> = { signin: 401, generic: 502 }; // the database's other answers are 409

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ ok: false, error: "signin" }, 401);
  if (!(await withinLimit(req, "account-check"))) return json({ ok: false, error: "busy" }, 429);
  let body: unknown = null;
  try { body = await req.json(); } catch { /* empty body */ }
  const b = bikeReportBody(body);
  if (!b) return json({ ok: false, error: "invalid" }, 400);
  const r = await rpcServer<unknown>("bike_report", { p_id: acct.id, p_token: acct.token, p_booking: b.booking, p_fault: b.fault, p_note: b.note, p_bike: b.bike });
  if (r.status === 0 || r.status >= 500) return json({ ok: false, error: "generic" }, 502);
  if (r.status >= 400) return emAbsent(r) ? json({ ok: false, error: "absent" }, 404) : json({ ok: false, error: "generic" }, 502);
  const a = bikeReportAnswer(r.data);
  if (a.ok) return json(a);
  return json(a, REFUSED[a.error] ?? 409);
}
