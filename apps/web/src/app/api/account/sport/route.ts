import { ACCOUNT_COOKIE, decodeSession, sameOrigin } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { emAbsent } from "@/lib/emergency";
import { cookieValue } from "@/lib/live";
import { withinLimit } from "@/lib/rate-limit";
import { SP_OTHER, spClean, spKnown, spOf, spOptionsOf, spOtherClean, spRefusal } from "@/lib/sport";

// GET /api/account/sport: whether the signed-in account competes in a sport (lib/sport.ts), read through customer_sport
// with the account cookie's id and token, for the pop-up every page shows a Community member who has not answered
// (SportGateLoader; the booking app's check-up asks it the same way, 2026-11-10): {signedIn: true, need, competes,
// federations}, need being the database's own "asked". Signed out it answers from the cookie alone, without asking the
// database; a token that is no longer the account's (no row) is signed out too. A database without the function holds
// nobody ({signedIn: true, need: false, absent: true}), nor does one that cannot be reached just now. A connection asks
// 30 times a minute at most (lib/rate-limit.ts; past that, 429 and the pop-up waits for the next page). With need, it
// brings the sports staff added to the list too (options, sport_option_list), which the pop-up offers. My Account reads
// both server-side itself.
//
// POST /api/account/sport {competes: true, federations: [codes], other?} or {competes: false}: saves it through
// customer_set_sport. Checked here first by the database's rules (a yes needs one code or more, each one of the user's
// list, an added sport's or Other; Other needs its text, 2 to 60 characters), and again by the database, which alone
// knows the added list. Answers {ok: true}, or {ok: false, error}: "refused" for an answer it does not take (problem
// "pick": neither yes nor no; "feds": no code, or one outside the lists; "other": Other's text), "absent" when the
// database cannot store it yet, "signin" when the account's session has ended, "busy" or "generic". Only this site's
// pages may call it.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store, private" } });

export async function GET(req: Request) {
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ signedIn: false });
  if (!(await withinLimit(req, "account-check"))) return json({ error: "busy" }, 429);
  const r = await rpcServer<unknown[]>("customer_sport", { p_id: acct.id, p_token: acct.token });
  if (r.status >= 400 && emAbsent(r)) return json({ signedIn: true, need: false, absent: true });
  if (!Array.isArray(r.data)) return json({ signedIn: true, need: false });
  // No row: the token is no longer the account's (its session ended) - the page is signed out.
  const row = spOf(r.data[0]);
  if (!row) return json({ signedIn: false });
  const options = row.asked
    ? await rpcServer<unknown>("sport_option_list", {}).then((o) => (o.status === 200 ? spOptionsOf(o.data) : []))
    : [];
  return json({ signedIn: true, need: row.asked, competes: row.competes, federations: row.feds, other: row.other, ...(row.asked ? { options } : {}) });
}

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ ok: false, error: "signin" }, 401);
  let body: unknown = null;
  try { body = await req.json(); } catch { /* empty body */ }
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  if (typeof b.competes !== "boolean") return json({ ok: false, error: "refused", problem: "pick" }, 400);
  const raw = Array.isArray(b.federations) ? b.federations.slice(0, 200) : [];
  const feds = spClean(raw);
  // a yes needs a code, and every code sent must have a code's shape (the database refuses one it does not hold)
  if (b.competes && (!feds.length || !raw.every(spKnown))) return json({ ok: false, error: "refused", problem: "feds" }, 400);
  const other = b.competes && feds.includes(SP_OTHER) ? spOtherClean(b.other) : null;
  if (b.competes && feds.includes(SP_OTHER) && !other) return json({ ok: false, error: "refused", problem: "other" }, 400);
  const r = await rpcServer<boolean>("customer_set_sport", {
    p_id: acct.id, p_token: acct.token, p_competes: b.competes, p_federations: b.competes ? feds : null, p_other: other,
  });
  if (r.status === 0 || r.status >= 500) return json({ ok: false, error: "generic" }, 502);
  if (r.status >= 400) {
    if (emAbsent(r)) return json({ ok: false, error: "absent" }, 404);
    const bad = spRefusal(r);
    if (bad) return json({ ok: false, error: "refused", problem: bad }, 400);
    return json({ ok: false, error: /RATE_LIMITED/.test(r.message) ? "busy" : "generic" }, /RATE_LIMITED/.test(r.message) ? 429 : 502);
  }
  // false: the token is no longer the account's (its session ended)
  if (r.data !== true) return json({ ok: false, error: "signin" }, 401);
  return json({ ok: true });
}
