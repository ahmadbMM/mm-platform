import { T as TICKET } from "@/components/booking/tickets.text";
import { experiencesSchema } from "@/content/pages/experiences";
import { WAIVER_VERSIONS, waiverCopy } from "@/content/waivers";
import { serverL, serverLocalize } from "@/i18n/dicts";
import { ACCOUNT_COOKIE, decodeSession, sameOrigin } from "@/lib/account-core";
import { accountBookings, rpcServer } from "@/lib/account";
import { asLocale, resolvePage } from "@/lib/content";
import { kindNames, sessionName } from "@/lib/rides";
import { cookieValue } from "@/lib/live";
import { withinLimit } from "@/lib/rate-limit";
import { loadSiteContent } from "@/lib/site";
import { fmtClock, fmtDayDate, venueOf, venueText } from "@/lib/tickets";
import { loadTicketSessions } from "@/lib/tickets-data";
import { SESSION_ID, WAIVER_VERSION_SHAPE, acceptAnswer, pendingWaivers, waiverKind, waiverRiders, waiverVersion } from "@/lib/waiver";
import { riyadhClock } from "@/lib/workshop-days";

// GET /api/account/pending-waiver?locale=xx[&skip=id,id]: the ride a signed-in rider must agree a
// waiver for before anything else (lib/waiver.ts; the booking app's _pendingWaiver), for the pop-up
// every page shows (WaiverGateLoader), with what the pop-up shows: the ride's name, day, time and
// place, who is on the booking, and its waiver in the page's language. Signed out it answers from
// the cookie alone, without asking the database; signed in it reads the rider's own bookings once
// (my_bookings) and the sessions of the rides still waiting, and names the soonest one it can see.
// A connection asks 30 times a minute at most (lib/rate-limit.ts; past that, 429 and the pop-up waits
// for the next page).
//
// POST /api/account/pending-waiver {sessionId, version}: the rider agrees, through
// customer_accept_waiver with the account cookie's id and token. The version is the one the pop-up
// showed, and it must still be that ride's own (its kind decides it, here, not in the browser): a
// ride whose kind changed since, or a version a deploy replaced while the pop-up stood open, answers
// "changed", and the pop-up asks again. A database without the function answers ok with `absent`,
// and the pop-up lets the rider through. Only this site's pages may call it.
//
// Both read the rides with the account's token (list_sessions, lib/rides.ts readSessions): a private
// ride - one only its tag holders may see - is hidden from the public key, and a rider staff added to
// one was never asked for its waiver.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store, private" } });
const S = (v: unknown) => (typeof v === "string" ? v : "");

export async function GET(req: Request) {
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ signedIn: false });
  if (!(await withinLimit(req, "account-check"))) return json({ error: "busy" }, 429);
  const q = new URL(req.url).searchParams;
  const locale = q.get("locale") || "en";
  const skip = (q.get("skip") || "").split(",").filter((x) => SESSION_ID.test(x)).slice(0, 20);
  const rows = await accountBookings(acct);
  const list = pendingWaivers(rows, riyadhClock(new Date()).slice(0, 10), acct.id, skip);
  if (!list.length) return json({ signedIn: true, pending: null });
  const L = asLocale(locale), tx = serverL(locale);
  const [sessions, content] = await Promise.all([loadTicketSessions(list.map((x) => x.sessionId), acct), loadSiteContent()]);
  // a ride this site cannot see is not asked about, as the booking app asks only for a session it knows
  const first = list.find((x) => sessions.has(x.sessionId));
  const s = first && sessions.get(first.sessionId);
  if (!first || !s) return json({ signedIn: true, pending: null });
  const d = resolvePage(experiencesSchema, content, L).dates;
  const names = { ...kindNames(d), petromin: tx("Petromin", "بترومين") };
  const enNames = kindNames(resolvePage(experiencesSchema, content, "en").dates);
  const t = serverLocalize(TICKET, locale);
  const clock = (x: string) => fmtClock(x, locale);
  // the time as the ticket writes it: "gathering - start" on a ride that gathers, else a window
  const time = s.times ? (s.gathers ? `${S(d.gather)} ${clock(s.times[0])} · ${S(d.start)} ${clock(s.times[1])}` : `${clock(s.times[0])} – ${clock(s.times[1])}`) : "";
  const kind = waiverKind(s); // Run for Her, with no bike, is agreed under the activity waiver (_waiverKind)
  return json({
    signedIn: true,
    pending: {
      sessionId: first.sessionId,
      version: WAIVER_VERSIONS[kind],
      kind,
      copy: waiverCopy(kind, tx),
      name: sessionName(s, names, enNames, L !== "en"),
      when: fmtDayDate(first.date, locale),
      time,
      venue: venueText(venueOf(s), t),
      ridersLabel: s.bikes ? t.riders : t.participants,
      riders: waiverRiders(rows, first.sessionId, acct.id, s.approval),
    },
  });
}

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ ok: false, error: "signin" }, 401);
  let body: unknown = null;
  try { body = await req.json(); } catch { /* empty body */ }
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const sessionId = typeof b.sessionId === "string" && SESSION_ID.test(b.sessionId) ? b.sessionId : "";
  const version = typeof b.version === "string" ? b.version : "";
  if (!sessionId || !WAIVER_VERSION_SHAPE.test(version)) return json({ ok: false, error: "invalid" }, 400);
  const s = (await loadTicketSessions([sessionId], acct)).get(sessionId);
  if (!s) return json({ ok: false, error: "generic" }, 502);
  if (waiverVersion(s) !== version) return json({ ok: false, error: "changed" }, 409);
  const r = await rpcServer<unknown>("customer_accept_waiver", { p_id: acct.id, p_token: acct.token, p_session_id: sessionId, p_version: version });
  const a = acceptAnswer(r);
  if (a === "ok") return json({ ok: true });
  if (a === "absent") return json({ ok: true, absent: true });
  if (a === "signin") return json({ ok: false, error: "signin" }, 401);
  return a === "refused" ? json({ ok: false, error: "refused" }, 400) : json({ ok: false, error: "generic" }, 502);
}
