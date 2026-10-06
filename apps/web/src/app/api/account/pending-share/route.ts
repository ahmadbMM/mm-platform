import { T as TICKET } from "@/components/booking/tickets.text";
import { experiencesSchema } from "@/content/pages/experiences";
import { serverL, serverLocalize } from "@/i18n/dicts";
import { ACCOUNT_COOKIE, decodeSession, sameOrigin } from "@/lib/account-core";
import { accountBookings, rpcServer } from "@/lib/account";
import { asLocale, resolvePage } from "@/lib/content";
import { kindNames, sessionName } from "@/lib/rides";
import { cookieValue } from "@/lib/live";
import { withinLimit } from "@/lib/rate-limit";
import { isRun, pendingShares, shareCandidates } from "@/lib/share";
import { loadSiteContent } from "@/lib/site";
import { fmtClock, fmtDayDate, venueOf, venueText } from "@/lib/tickets";
import { loadTicketSessions } from "@/lib/tickets-data";
import { SESSION_ID, acceptAnswer } from "@/lib/waiver";
import { riyadhClock } from "@/lib/workshop-days";

// GET /api/account/pending-share?locale=xx[&skip=id,id]: the Run for Her run a signed-in runner must
// agree for before their details go to Sela and JYC (lib/share.ts; the booking app's _pendingShare),
// for the pop-up every page shows once no waiver waits (ShareGateLoader), with what the pop-up shows:
// the run's name, day, time and place, as the waiver's pop-up shows a ride, and the distance the runner
// picked. Signed out it answers from the cookie alone, without asking the database; signed in it reads
// the runner's own bookings once (my_bookings), then the sessions of the rows that have not agreed, to
// know which are runs (the column is on every row, a ride's too), and the site's texts only when a
// run waits. A connection asks 30 times a minute at most (lib/rate-limit.ts; past that, 429 and the
// pop-up waits for the next page).
//
// POST /api/account/pending-share {sessionId}: the runner agrees, through customer_accept_share with
// the account cookie's id and token. The session must still be Run for Her (its kind decides it, here,
// not in the browser): one that is not any more answers "changed", and the pop-up asks again, which no
// longer names it. A database without the function answers ok with `absent`, and the pop-up lets the
// runner through. Only this site's pages may call it.
//
// Both read the sessions with the account's token (list_sessions, lib/rides.ts readSessions): Run for
// Her is for members, and a private session is hidden from the public key.
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
  const today = riyadhClock(new Date()).slice(0, 10);
  const ids = shareCandidates(rows, today, acct.id, skip);
  if (!ids.length) return json({ signedIn: true, pending: null });
  // a run this site cannot see is not asked about, as the booking app asks only for a session it knows
  const sessions = await loadTicketSessions(ids, acct);
  const first = pendingShares(rows, sessions, today, acct.id, skip)[0];
  const s = first && sessions.get(first.sessionId);
  if (!first || !s) return json({ signedIn: true, pending: null });
  const L = asLocale(locale), tx = serverL(locale);
  const content = await loadSiteContent();
  const d = resolvePage(experiencesSchema, content, L).dates;
  const names = { ...kindNames(d), petromin: tx("Petromin", "بترومين") };
  const enNames = kindNames(resolvePage(experiencesSchema, content, "en").dates);
  const t = serverLocalize(TICKET, locale);
  const clock = (x: string) => fmtClock(x, locale);
  // the time as the ticket writes it: "gathering - start" (Run for Her gathers), else a window
  const time = s.times ? (s.gathers ? `${S(d.gather)} ${clock(s.times[0])} · ${S(d.start)} ${clock(s.times[1])}` : `${clock(s.times[0])} – ${clock(s.times[1])}`) : "";
  return json({
    signedIn: true,
    pending: {
      sessionId: first.sessionId,
      name: sessionName(s, names, enNames, L !== "en"),
      when: fmtDayDate(first.date, locale),
      time,
      venue: venueText(venueOf(s), t),
      // the runner's distance in the ticket's words ("5 km"), or null when the row has none
      distance: first.km !== null ? t.rtKm(String(first.km)) : null,
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
  if (!sessionId) return json({ ok: false, error: "invalid" }, 400);
  const s = (await loadTicketSessions([sessionId], acct)).get(sessionId);
  if (!s) return json({ ok: false, error: "generic" }, 502);
  if (!isRun(s)) return json({ ok: false, error: "changed" }, 409);
  const r = await rpcServer<unknown>("customer_accept_share", { p_id: acct.id, p_token: acct.token, p_session_id: sessionId });
  const a = acceptAnswer(r);
  if (a === "ok") return json({ ok: true });
  if (a === "absent") return json({ ok: true, absent: true });
  if (a === "signin") return json({ ok: false, error: "signin" }, 401);
  return a === "refused" ? json({ ok: false, error: "refused" }, 400) : json({ ok: false, error: "generic" }, 502);
}
