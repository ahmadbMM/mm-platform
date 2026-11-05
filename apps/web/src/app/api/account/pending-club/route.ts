import { bloodName, bloodWords } from "@/content/blood-words";
import { serverL } from "@/i18n/dicts";
import { ACCOUNT_COOKIE, decodeSession, sameOrigin } from "@/lib/account-core";
import { accountBookings, rpcServer } from "@/lib/account";
import { isBloodId, pendingClub } from "@/lib/blood";
import { cookieValue } from "@/lib/live";
import { withinLimit } from "@/lib/rate-limit";
import { fmtDayDate } from "@/lib/tickets";
import { SESSION_ID, acceptAnswer } from "@/lib/waiver";
import { riyadhClock } from "@/lib/workshop-days";

// GET /api/account/pending-club?locale=xx[&skip=id,id]: the Blood Donation session a signed-in account still has to say its
// club or community for (lib/blood.ts pendingClub; the booking app's _pendingClub), for the pop-up every page shows once no
// agreement waits (ClubGateLoader), with every word of it (content/blood-words.ts), so the browser's code names no event.
// Signed out it answers from the cookie alone; a connection asks 30 times a minute at most.
//
// POST /api/account/pending-club {sessionId, club}: the answer, through customer_set_blood_club with the account cookie's id
// and token; a blank club is "I don't have one". A database without the function answers ok with `absent`, and the pop-up lets
// them through. Only this site's pages may call it.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store, private" } });

export async function GET(req: Request) {
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ signedIn: false });
  if (!(await withinLimit(req, "account-check"))) return json({ error: "busy" }, 429);
  const q = new URL(req.url).searchParams;
  const locale = q.get("locale") || "en";
  const skip = (q.get("skip") || "").split(",").filter((x) => SESSION_ID.test(x)).slice(0, 20);
  const rows = await accountBookings(acct);
  const first = pendingClub(rows, riyadhClock(new Date()).slice(0, 10), acct.id, skip);
  if (!first) return json({ signedIn: true, pending: null });
  const tx = serverL(locale);
  return json({ signedIn: true, pending: { sessionId: first.sessionId, name: bloodName(tx), when: fmtDayDate(first.date, locale), words: bloodWords(tx).club } });
}

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ ok: false, error: "signin" }, 401);
  let body: unknown = null;
  try { body = await req.json(); } catch { /* empty body */ }
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const sessionId = typeof b.sessionId === "string" && SESSION_ID.test(b.sessionId) ? b.sessionId : "";
  if (!sessionId || !isBloodId(sessionId) || typeof b.club !== "string" || b.club.length > 400) return json({ ok: false, error: "invalid" }, 400);
  const r = await rpcServer<unknown>("customer_set_blood_club", { p_id: acct.id, p_token: acct.token, p_session_id: sessionId, p_club: b.club });
  const a = acceptAnswer(r);
  if (a === "ok") return json({ ok: true });
  if (a === "absent") return json({ ok: true, absent: true });
  if (a === "signin") return json({ ok: false, error: "signin" }, 401);
  return a === "refused" ? json({ ok: false, error: "refused" }, 400) : json({ ok: false, error: "generic" }, 502);
}
