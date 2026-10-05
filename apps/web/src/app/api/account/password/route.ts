import { ACCOUNT_COOKIE, ACCOUNT_MAX_AGE, PENDING_COOKIE, PENDING_PATH, decodeSession, encodeSession, pwdAnswer, sameOrigin } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { passwordOk } from "@/lib/learn";
import { cookieValue } from "@/lib/live";

// POST /api/account/password {password, page?}: the rider's own password in place of a temporary
// one staff issued, after a sign-in that answered must_change (api/account). The held sign-in is
// the short HttpOnly cookie that answer set; customer_set_own_password changes the password only
// while the account is marked, and hands back a new session token (the booking app's
// _pwdMustSave). With it the rider is signed in - the account cookie, as a sign-in sets it - or,
// for the Learn to ride form (page: true), the session goes back to the form and no cookie is set.
// A held sign-in whose mark staff cleared meanwhile ("done") is signed in as it stands. Only this
// site's pages may call it.
const cookie = (name: string, value: string, maxAge: number, path = "/") => `${name}=${value}; Path=${path}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
const json = (body: unknown, status = 200, cookies: string[] = []) => {
  const h = new Headers({ "content-type": "application/json", "cache-control": "no-store" });
  for (const c of cookies) h.append("set-cookie", c);
  return new Response(JSON.stringify(body), { status, headers: h });
};
const unhold = () => cookie(PENDING_COOKIE, "", 0, PENDING_PATH);

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  const held = decodeSession(cookieValue(req.headers.get("cookie"), PENDING_COOKIE));
  if (!held) return json({ ok: false, error: "expired" }, 401);
  let password = "", page = false;
  try {
    const b = (await req.json()) as { password?: unknown; page?: unknown };
    password = String(b.password ?? "").slice(0, 200);
    page = b.page === true;
  } catch { /* empty body */ }
  // the booking app's rule, which the database checks again: 8 or more, an upper-case letter, a digit
  if (!passwordOk(password)) return json({ ok: false, error: "weak" }, 400);
  const a = pwdAnswer(await rpcServer<string>("customer_set_own_password", { p_id: held.id, p_token: held.token, p_new_pwd: password }));
  if ("error" in a && a.error === "expired") return json({ ok: false, error: "expired" }, 401, [unhold()]);
  if ("error" in a && a.error !== "done") return json({ ok: false, error: a.error }, a.error === "generic" ? 502 : 400);
  const session = { id: held.id, token: "token" in a ? a.token : held.token };
  if (page) return json({ ok: true, id: session.id, token: session.token }, 200, [unhold()]);
  return json({ ok: true }, 200, [cookie(ACCOUNT_COOKIE, encodeSession(session), ACCOUNT_MAX_AGE), unhold()]);
}
