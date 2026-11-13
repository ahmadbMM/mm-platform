import { ACCOUNT_COOKIE, decodeSession, sameOrigin } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { calfAnswer, calfBody } from "@/lib/calendar-feed";
import { emAbsent } from "@/lib/emergency";
import { cookieValue } from "@/lib/live";
import { withinLimit } from "@/lib/rate-limit";

// POST /api/account/calendar {op: "get" | "new", lang?}: the key of the rider's own calendar address, for the pop-up of
// My Account's Calendar section (lib/calendar-feed.ts, CalendarFeed.tsx; the booking app's calendar-feed.js, 2026-11-13),
// through calendar_link (rentals migration 20261114082700) with the account cookie's id and token: "get" answers the key,
// making one on the first ask; "new" replaces it, after which the old address answers with an empty calendar. lang is the
// page's language when the booking app speaks it (the events' words), else the stored one stays. A POST, never a GET:
// it writes, and the key must not sit in an answer anything keeps. Answers {ok: true, key}, or {ok: false, error}:
// "signin" when the account is signed out, "absent" when the database has no such function (the section goes),
// "invalid" for a body it cannot read, "busy" or "generic". The key is never written to a log. Only this site's pages may
// call it; a connection asks 30 times a minute at most. My Account asks 'peek' itself, server-side.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store, private" } });

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ ok: false, error: "signin" }, 401);
  if (!(await withinLimit(req, "account-check"))) return json({ ok: false, error: "busy" }, 429);
  let body: unknown = null;
  try { body = await req.json(); } catch { /* empty body */ }
  const b = calfBody(body);
  if (!b) return json({ ok: false, error: "invalid" }, 400);
  const r = await rpcServer<unknown>("calendar_link", { p_id: acct.id, p_token: acct.token, p_lang: b.lang, p_op: b.op });
  if (r.status === 0 || r.status >= 500) return json({ ok: false, error: "generic" }, 502);
  if (r.status >= 400) return emAbsent(r) ? json({ ok: false, error: "absent" }, 404) : json({ ok: false, error: "generic" }, 502);
  const a = calfAnswer(r.data);
  if (a.ok) return json(a);
  return json(a, a.error === "signin" ? 401 : 502);
}
