import { ACCOUNT_COOKIE, ACCOUNT_MAX_AGE, PENDING_COOKIE, PENDING_PATH, decodeSession, encodeSession, pwdAnswer, sameOrigin, sessionCookie } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { bodyOf, json as jsonOut, unreachable, writeSession } from "@/lib/account-route";
import { passwordError, passwordOk } from "@/lib/account-profile";
import { cookieValue } from "@/lib/live";

// POST /api/account/password: one route for the website's password changes.
//
// {password, page?} - a held sign-in (components/account/ChangePassword): the rider's own password in
//   place of a temporary one staff issued, after a sign-in that answered must_change (api/account).
//   The held sign-in is the short HttpOnly cookie that answer set; customer_set_own_password changes
//   the password only while the account is marked, and hands back a new session token (the booking
//   app's _pwdMustSave). With it the rider is signed in - the account cookie, as a sign-in sets it -
//   or, for the Learn to ride form (page: true), the session goes back to the form and no cookie is
//   set. A held sign-in whose mark staff cleared meanwhile ("done") is signed in as it stands.
//
// {mode, current?, next} - the account signed in here (My Account, components/account/Password):
//   mode "change" - whenever the rider likes (customer_change_password): an account with a
//     password gives it (five wrong tries lock changes for 15 minutes); one that signs in with
//     Google or Apple only sets one without.
//   mode "forced" - the temporary password staff gave must be replaced (customer_set_own_password).
//   Either way the database mints a new session token, which signs every other device out; this
//   device keeps going with it, in the same HttpOnly cookie.
//
// The rule (8+, a capital, a digit) is checked here and again by the database. Only this site's
// pages may call it.
const STATUS: Record<string, number> = { bad: 403, weak: 400, same: 400, locked: 429, notdue: 409, signin: 401, generic: 502 };

const cookie = (name: string, value: string, maxAge: number, path = "/") => `${name}=${value}; Path=${path}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
const json = (body: unknown, status = 200, cookies: string[] = []) => {
  const h = new Headers({ "content-type": "application/json", "cache-control": "no-store" });
  for (const c of cookies) h.append("set-cookie", c);
  return new Response(JSON.stringify(body), { status, headers: h });
};
const unhold = () => cookie(PENDING_COOKIE, "", 0, PENDING_PATH);

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  const b = await bodyOf(req);
  if (b.mode !== undefined) return signedIn(req, b);

  const held = decodeSession(cookieValue(req.headers.get("cookie"), PENDING_COOKIE));
  if (!held) return json({ ok: false, error: "expired" }, 401);
  const password = String(b.password ?? "").slice(0, 200);
  const page = b.page === true;
  // the booking app's rule, which the database checks again: 8 or more, an upper-case letter, a digit
  if (!passwordOk(password)) return json({ ok: false, error: "weak" }, 400);
  const a = pwdAnswer(await rpcServer<string>("customer_set_own_password", { p_id: held.id, p_token: held.token, p_new_pwd: password }));
  if ("error" in a && a.error === "expired") return json({ ok: false, error: "expired" }, 401, [unhold()]);
  if ("error" in a && a.error !== "done") return json({ ok: false, error: a.error }, a.error === "generic" ? 502 : 400);
  const session = { id: held.id, token: "token" in a ? a.token : held.token };
  if (page) return json({ ok: true, id: session.id, token: session.token }, 200, [unhold()]);
  return json({ ok: true }, 200, [cookie(ACCOUNT_COOKIE, encodeSession(session), ACCOUNT_MAX_AGE), unhold()]);
}

/** A password change for the account signed in on this site (the account cookie). */
async function signedIn(req: Request, b: Record<string, unknown>) {
  const w = writeSession(req);
  if ("refuse" in w) return w.refuse;
  const { id, token } = w.session;
  const mode = b.mode === "forced" ? "forced" : b.mode === "change" ? "change" : null;
  const next = typeof b.next === "string" ? b.next : "";
  const current = typeof b.current === "string" ? b.current.slice(0, 200) : "";
  if (!mode) return jsonOut({ ok: false, error: "invalid" }, 400);
  if (!passwordOk(next)) return jsonOut({ ok: false, error: "weak" }, 400);
  const r = mode === "forced"
    ? await rpcServer<string>("customer_set_own_password", { p_id: id, p_token: token, p_new_pwd: next })
    : await rpcServer<string>("customer_change_password", { p_id: id, p_token: token, p_current: current, p_new: next });
  if (unreachable(r)) return jsonOut({ ok: false, error: "generic" }, 502);
  if (r.status >= 400) { const e = passwordError(r.message); return jsonOut({ ok: false, error: e }, STATUS[e] ?? 400); }
  const tok = typeof r.data === "string" ? r.data : "";
  if (!/^[A-Za-z0-9_-]{16,200}$/.test(tok)) return jsonOut({ ok: false, error: "generic" }, 502);
  return jsonOut({ ok: true }, 200, { "set-cookie": sessionCookie(encodeSession({ id, token: tok })) });
}
