import { ACCOUNT_COOKIE, decodeSession } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { bodyOf, json, unreachable, writeSession } from "@/lib/account-route";
import { emAbsent } from "@/lib/emergency";
import { cookieValue } from "@/lib/live";
import { mentorCall, mentorFeedOf } from "@/lib/mentorship";

// The Mentorship programme's reads and writes for /club (components/club/Mentorship.tsx; the booking app's _mtFetch,
// _mtSend and _mtCall), with the account cookie's id and token, never an id the browser sends:
// GET: mentor_feed, read again (lib/mentorship.ts mentorFeedOf) - {ok: true, feed} or {ok: false, error}.
// POST {act, ...}: one of the programme's functions (lib/mentorship.ts mentorCall: ask - register as a mentee or change a
// request staff have not published; join - register as a mentor or change it; offer - "I can help" on a profile; quit -
// leave the programme; answer - Accept or Not now on an offer; leave - step back, withdraw an offer, close the request;
// check - "Still in touch?"), then mentor_feed again, so the page draws what the database now holds: {ok: true, feed}.
// A refusal is {ok: false, error} in the database's own word (gone, own, exists, limit, invalid, consent, register,
// member), or "signin", "absent" (no such function), "refused" (a request it does not take), "generic". The database
// checks everything; nothing names another member but an accepted match's first name and WhatsApp number (the user's own
// request, 2026-11-13). Only this site's pages may write.
const S = (v: unknown) => (typeof v === "string" ? v : "");

async function feed(id: string, token: string) {
  const r = await rpcServer<unknown>("mentor_feed", { p_id: id, p_token: token });
  if (unreachable(r)) return json({ ok: false, error: "generic" }, 502);
  if (r.status >= 400) return emAbsent(r) ? json({ ok: false, error: "absent" }, 404) : json({ ok: false, error: "generic" }, 502);
  const f = mentorFeedOf(r);
  if (f) return json({ ok: true, feed: f });
  const e = S((r.data as Record<string, unknown> | null)?.error);
  return e === "denied" ? json({ ok: false, error: "signin" }, 401) : e === "member" ? json({ ok: false, error: "member" }, 403) : json({ ok: false, error: "generic" }, 502);
}

export async function GET(req: Request) {
  const s = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!s) return json({ ok: false, error: "signin" }, 401);
  return feed(s.id, s.token);
}

export async function POST(req: Request) {
  const w = writeSession(req);
  if ("refuse" in w) return w.refuse;
  const call = mentorCall(await bodyOf(req));
  if (!call) return json({ ok: false, error: "refused" }, 400);
  const { id, token } = w.session;
  const r = await rpcServer<unknown>(call.fn, { p_id: id, p_token: token, ...call.args });
  if (unreachable(r)) return json({ ok: false, error: "generic" }, 502);
  if (r.status >= 400) return emAbsent(r) ? json({ ok: false, error: "absent" }, 404) : json({ ok: false, error: "generic" }, 502);
  const d = r.data && typeof r.data === "object" ? (r.data as Record<string, unknown>) : null;
  if (d?.ok !== true) {
    const e = S(d?.error);
    if (e === "denied") return json({ ok: false, error: "signin" }, 401);
    if (["gone", "own", "exists", "limit", "invalid", "consent", "register", "member"].includes(e)) return json({ ok: false, error: e }, 409);
    return json({ ok: false, error: "generic" }, 502);
  }
  return feed(id, token);
}
