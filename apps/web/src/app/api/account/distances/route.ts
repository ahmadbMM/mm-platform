import { ACCOUNT_COOKIE, decodeSession, sameOrigin } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { jsonCapped, TOO_BIG } from "@/lib/capped-body";
import { claimBody, claimRefusal } from "@/lib/distance-board";
import { readMyDistances } from "@/lib/distance-board-server";
import { emAbsent } from "@/lib/emergency";
import { cookieValue } from "@/lib/live";
import { withinLimit } from "@/lib/rate-limit";

// The signed-in rider's own distances on the leaderboards (rentals migration 20261127180000, the booking app's
// distance-board.js), with the account cookie's id and token as the booking app's page sends them:
//   GET:  customer_distances: {ok: true, mine} (best, lifetime, this year, the switch, the medal, their distances);
//   POST {action: "claim", kind, km, date, from?, note?, proof, proofName?}: customer_distance_claim, one ride or a total
//         over dates with a picture or a PDF as proof, for staff to approve ({ok: true, id}, or {ok: false, error}: "km",
//         "date", "proof", "limit" as the database refused it);
//   POST {action: "withdraw", id}: customer_distance_withdraw, takes back a waiting claim;
// Besides: "signin" for a signed-out request or a token refused, "invalid" for a body it cannot read, "absent" when the
// database has no such function yet, "busy" or "generic". Only this site's pages may post; a connection sends 30 a
// minute at most.
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store, private" } });
// the proof (3 MB at most, as the database takes it) with the rest of the body
const MAX_BODY = 3_200_000;

export async function GET(req: Request) {
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ ok: false, error: "signin" }, 401);
  if (!(await withinLimit(req, "account-check", undefined, acct.id))) return json({ ok: false, error: "busy" }, 429);
  const mine = await readMyDistances(acct);
  return mine ? json({ ok: true, mine }) : json({ ok: false, error: "generic" }, 502);
}

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ ok: false, error: "signin" }, 401);
  if (Number(req.headers.get("content-length") || 0) > MAX_BODY) return json({ ok: false, error: "invalid" }, 413);
  if (!(await withinLimit(req, "account-check", undefined, acct.id))) return json({ ok: false, error: "busy" }, 429);
  // read no further than MAX_BODY: a chunked body has no Content-Length for the check above
  const body = await jsonCapped(req, MAX_BODY);
  if (body === TOO_BIG) return json({ ok: false, error: "invalid" }, 413);
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const who = { p_id: acct.id, p_token: acct.token };
  let fn: string, args: Record<string, unknown>, slow = false;
  if (b.action === "claim") {
    const c = claimBody(b);
    if (!c) return json({ ok: false, error: "invalid" }, 400);
    fn = "customer_distance_claim"; args = { ...who, ...c }; slow = true;
  } else if (b.action === "withdraw") {
    const id = typeof b.id === "number" && Number.isSafeInteger(b.id) && b.id > 0 ? b.id : null;
    if (!id) return json({ ok: false, error: "invalid" }, 400);
    fn = "customer_distance_withdraw"; args = { ...who, p_claim: id };
  } else return json({ ok: false, error: "invalid" }, 400);
  const r = await rpcServer<unknown>(fn, args, slow ? 20_000 : 4000);
  if (r.status === 0 || r.status >= 500) return json({ ok: false, error: "generic" }, 502);
  if (r.status >= 400) {
    if (emAbsent(r)) return json({ ok: false, error: "absent" }, 404);
    return json({ ok: false, error: /RATE_LIMITED/.test(r.message) ? "busy" : "generic" }, /RATE_LIMITED/.test(r.message) ? 429 : 502);
  }
  const d = r.data as Record<string, unknown> | null;
  if (d && d.ok === true) return json(fn === "customer_distance_claim" ? { ok: true, id: Number(d.id) || 0 } : { ok: true });
  const e = fn === "customer_distance_claim" ? claimRefusal(d) : d && d.error === "token" ? "signin" : "generic";
  return json({ ok: false, error: e }, e === "signin" ? 401 : e === "generic" ? 502 : 409);
}
