import { ACCOUNT_COOKIE, decodeSession, sameOrigin } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { emAbsent } from "@/lib/emergency";
import { cookieValue } from "@/lib/live";
import { withinLimit } from "@/lib/rate-limit";
import { remindAnswer, remindBody, remindMine } from "@/lib/open-remind";

// POST /api/account/remind: "Tell me in Updates" in a date's Remind me pop-up (RemindBell, lib/open-remind.ts; the booking
// app's _ormSet and _ormMine, the customer features round of 2026-11-19, item 2), with the account cookie's id and token:
// {op: "mine"} reads the session ids the account is waiting on (open_reminders_mine, rentals migration 20261119600200),
// asked once when a bell is first on screen, answering {ok: true, ids}; {op: "set", session, on} stores or removes the
// ask (open_reminder_set: the database writes the booking app's Updates row when booking opens for the account),
// answering {ok: true, on}. Or {ok: false, error}: "invalid" for a body it cannot read, "none" (a date nobody could be
// reminded of), "booked" (the account holds a place on it), "open" (it is open for them now: the page draws itself again),
// "limit" (twenty asks waiting), "absent" when the database has no such function yet (the pop-up offers the calendar
// alone), "signin" when the account is signed out, "busy" or "generic". Only this site's pages may call it; a connection
// sends 30 a minute at most (the account's checks' meter).
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store, private" } });
const REFUSED: Record<string, number> = { signin: 401, generic: 502 }; // the database's other answers are 409

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ ok: false, error: "signin" }, 401);
  if (!(await withinLimit(req, "account-check", undefined, acct.id))) return json({ ok: false, error: "busy" }, 429);
  let body: unknown = null;
  try { body = await req.json(); } catch { /* empty body */ }
  const b = remindBody(body);
  if (!b) return json({ ok: false, error: "invalid" }, 400);
  const r = b.op === "mine"
    ? await rpcServer<unknown>("open_reminders_mine", { p_id: acct.id, p_token: acct.token })
    : await rpcServer<unknown>("open_reminder_set", { p_id: acct.id, p_token: acct.token, p_session: b.session, p_on: b.on });
  if (r.status === 0 || r.status >= 500) return json({ ok: false, error: "generic" }, 502);
  if (r.status >= 400) return emAbsent(r) ? json({ ok: false, error: "absent" }, 404) : json({ ok: false, error: "generic" }, 502);
  const a = b.op === "mine" ? remindMine(r.data) : remindAnswer(r.data);
  if (a.ok) return json(a);
  return json(a, REFUSED[a.error] ?? 409);
}
