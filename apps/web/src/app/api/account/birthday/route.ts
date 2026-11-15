import { ACCOUNT_COOKIE, decodeSession } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { cookieValue } from "@/lib/live";
import { withinLimit } from "@/lib/rate-limit";
import { firstName, inBirthdayWeek, riyadhDay } from "@/lib/birthday";

// GET /api/account/birthday: whether today (Riyadh) is in the signed-in account's birthday week (lib/birthday.ts), for
// the confetti every page plays then (components/account/BirthdayConfetti.tsx; the user, 2026-11-15). Read through
// customer_profile with the account cookie's id and token: {signedIn: true, on, day}, with the account's first name
// when on. The birth date itself never leaves the server. Signed out it answers from the cookie alone, without asking
// the database; a token that is no longer the account's (no row) is signed out too, and a database that cannot be
// reached just now answers off. A connection asks 30 times a minute at most (lib/rate-limit.ts), shared with the
// account's other checks.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store, private" } });

export async function GET(req: Request) {
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ signedIn: false });
  if (!(await withinLimit(req, "account-check"))) return json({ error: "busy" }, 429);
  const day = riyadhDay();
  const r = await rpcServer<{ name?: unknown; birth_date?: unknown }[]>("customer_profile", { p_id: acct.id, p_token: acct.token });
  if (r.status !== 200 || !Array.isArray(r.data)) return json({ signedIn: true, on: false, day, error: "unread" });
  const row = r.data[0];
  if (!row) return json({ signedIn: false });
  const first = firstName(row.name);
  const on = !!first && inBirthdayWeek(row.birth_date, day);
  return json(on ? { signedIn: true, on, day, first } : { signedIn: true, on, day });
}
