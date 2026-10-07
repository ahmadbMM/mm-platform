import { ACCOUNT_COOKIE, decodeSession, sameOrigin } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { cookieValue } from "@/lib/live";
import { withinLimit } from "@/lib/rate-limit";
import { EM_RELS, emAbsent, emReadBoth, emRefusal, emState, type EmFields, type EmRel } from "@/lib/emergency";

// GET /api/account/emergency: whether the signed-in account still has to give its emergency contact
// (the owner, 2026-10-07: required and unskippable for every customer; the booking app's check-up),
// for the pop-up every page shows before any other (EmergencyGateLoader), and whether the database
// takes a second contact (one from before 2026-10-07 answers three columns). Signed out it answers
// from the cookie alone, without asking the database; signed in it reads customer_emergency once with
// the account's id and token. A database without the function, or one that cannot be reached, holds
// nobody (`need: false`): the rider is let through. A connection asks 30 times a minute at most
// (lib/rate-limit.ts; past that, 429 and the pop-up waits for the next page).
//
// POST /api/account/emergency {one: {name, cc, phone, rel}, two?: {...}}: saves the contacts through
// customer_set_emergency, then customer_set_emergency2 when the second is filled, with the account
// cookie's id and token; both checked here first by the form's own rules (lib/emergency.ts), and
// again by the database. Answers {ok: true} (with `absent` when the database cannot store a contact
// yet - the pop-up lets the rider through), or {ok: false, error: "refused", problem: {error, which}}
// for a box to fix, "signin" when the account's session has ended, "busy" or "generic". Only this
// site's pages may call it.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store, private" } });

export async function GET(req: Request) {
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ signedIn: false });
  if (!(await withinLimit(req, "account-check"))) return json({ error: "busy" }, 429);
  const r = await rpcServer<unknown[]>("customer_emergency", { p_id: acct.id, p_token: acct.token });
  if (r.status >= 400 && emAbsent(r)) return json({ signedIn: true, need: false, absent: true });
  if (!Array.isArray(r.data)) return json({ signedIn: true, need: false });
  // No row: the token is no longer the account's (its session ended) - the page is signed out.
  if (!r.data.length) return json({ signedIn: false });
  const st = emState(r.data[0]);
  return json({ signedIn: true, need: !st.has, two: st.two });
}

const S = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
function fields(v: unknown): EmFields | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const rel = S(o.rel, 20);
  return { name: S(o.name, 120), cc: /^\+\d{1,4}$/.test(S(o.cc, 6)) ? S(o.cc, 6) : "+966", phone: S(o.phone, 32), rel: (EM_RELS as readonly string[]).includes(rel) ? (rel as EmRel) : "" };
}

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ ok: false, error: "signin" }, 401);
  let body: unknown = null;
  try { body = await req.json(); } catch { /* empty body */ }
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const one = fields(b.one), two = fields(b.two);
  if (!one) return json({ ok: false, error: "invalid" }, 400);
  // the rider's own number is the database's to compare (em_self): it is not read here
  const c = emReadBoth(one, two, "");
  if ("error" in c) return json({ ok: false, error: "refused", problem: c }, 400);
  const calls: [string, { name: string; phone: string; rel: string }, 1 | 2][] = [["customer_set_emergency", c.first, 1]];
  if (c.second) calls.push(["customer_set_emergency2", c.second, 2]);
  for (const [fn, x, which] of calls) {
    const r = await rpcServer<boolean>(fn, { p_id: acct.id, p_token: acct.token, p_name: x.name, p_phone: x.phone, p_relation: x.rel });
    if (r.status === 0 || r.status >= 500) return json({ ok: false, error: "generic" }, 502);
    if (r.status >= 400) {
      if (emAbsent(r)) { if (which === 1) return json({ ok: true, absent: true }); continue; } // no second contact on this database
      const bad = emRefusal(r);
      if (bad) return json({ ok: false, error: "refused", problem: { error: bad, which } }, 400);
      return json({ ok: false, error: /RATE_LIMITED/.test(r.message) ? "busy" : "generic" }, /RATE_LIMITED/.test(r.message) ? 429 : 502);
    }
    if (r.data !== true) return json({ ok: false, error: "signin" }, 401);
  }
  return json({ ok: true });
}
