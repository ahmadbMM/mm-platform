import { rpcServer } from "@/lib/account";
import { encodeSession, sessionCookie } from "@/lib/account-core";
import { bodyOf, json, unreachable, writeSession } from "@/lib/account-route";
import { passwordError, passwordOk } from "@/lib/account-profile";

// POST /api/account/password {mode, current?, next}: a new password for the signed-in account.
//   mode "change" - whenever the rider likes (customer_change_password): an account with a
//     password gives it (five wrong tries lock changes for 15 minutes); one that signs in with
//     Google or Apple only sets one without.
//   mode "forced" - the temporary password staff gave must be replaced (customer_set_own_password).
// Either way the database mints a new session token, which signs every other device out; this
// device keeps going with it, in the same HttpOnly cookie. The rule (8+, a capital, a digit) is
// checked here and again by the database.
const STATUS: Record<string, number> = { bad: 403, weak: 400, same: 400, locked: 429, notdue: 409, signin: 401, generic: 502 };

export async function POST(req: Request) {
  const w = writeSession(req);
  if ("refuse" in w) return w.refuse;
  const { id, token } = w.session;
  const b = await bodyOf(req);
  const mode = b.mode === "forced" ? "forced" : b.mode === "change" ? "change" : null;
  const next = typeof b.next === "string" ? b.next : "";
  const current = typeof b.current === "string" ? b.current.slice(0, 200) : "";
  if (!mode) return json({ ok: false, error: "invalid" }, 400);
  if (!passwordOk(next)) return json({ ok: false, error: "weak" }, 400);
  const r = mode === "forced"
    ? await rpcServer<string>("customer_set_own_password", { p_id: id, p_token: token, p_new_pwd: next })
    : await rpcServer<string>("customer_change_password", { p_id: id, p_token: token, p_current: current, p_new: next });
  if (unreachable(r)) return json({ ok: false, error: "generic" }, 502);
  if (r.status >= 400) { const e = passwordError(r.message); return json({ ok: false, error: e }, STATUS[e] ?? 400); }
  const tok = typeof r.data === "string" ? r.data : "";
  if (!/^[A-Za-z0-9_-]{16,200}$/.test(tok)) return json({ ok: false, error: "generic" }, 502);
  return json({ ok: true }, 200, { "set-cookie": sessionCookie(encodeSession({ id, token: tok })) });
}
