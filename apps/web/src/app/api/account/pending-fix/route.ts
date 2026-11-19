import { ACCOUNT_COOKIE, decodeSession } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { cookieValue } from "@/lib/live";
import { withinLimit } from "@/lib/rate-limit";

// GET /api/account/pending-fix: whether the signed-in account owes details (customer_fix_fields: what staff asked the rider
// to correct, and what the server asks for itself - a password for an account with none, a real email for a hidden Apple
// one, a community member's birth date and nationality), for the check-up pop-up every page shows once no other waits
// (FixGateLoader; the booking app's 3ebaf706, the user 2026-11-10: "any details or info requested from an account show it
// as an unskippable pop up"). {signedIn: false}, or {signedIn: true, owed, asks}: how many are asked, and which. A database without the
// function, or one that did not answer, owes nothing here. A connection asks 30 times a minute at most.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store, private" } });

export async function GET(req: Request) {
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ signedIn: false });
  if (!(await withinLimit(req, "account-check", undefined, acct.id))) return json({ error: "busy" }, 429);
  const r = await rpcServer<unknown>("customer_fix_fields", { p_id: acct.id, p_token: acct.token });
  const asks = r.status === 200 && Array.isArray(r.data) ? [...new Set(r.data.filter((k): k is string => typeof k === "string" && /^[a-z0-9_]{1,40}$/.test(k)))] : [];
  return json({ signedIn: true, owed: asks.length, asks });
}
