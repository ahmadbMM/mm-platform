import { ACCOUNT_COOKIE, ACCOUNT_MAX_AGE, PENDING_COOKIE, PENDING_MAX_AGE, PENDING_PATH, encodeSession, mustChange, sameOrigin } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { normalizePhone } from "@/lib/rpc-client";
import { passesCheck, withinTries } from "@/lib/sign-in-guard";

// Sign in (POST {identifier, password}) and out (DELETE) with a Micromobility account. The
// password goes to the booking app's own customer_login (which meters failed tries per email /
// mobile and per account); the session it hands back is kept in an HttpOnly cookie. Only this
// site's own pages may call it, a connection gets a few tries a minute, and a Turnstile check
// rides along once its keys are set (lib/sign-in-guard.ts).
//
// A password staff issued (a temporary one, customer_pwd_state) must be replaced before the
// account is used, as the booking app asks: the sign-in answers must_change and is held, not
// signed in, in a short HttpOnly cookie for api/account/password (components/account/ChangePassword.tsx).
//
// The Learn to ride form signs in here too (page: true), for its own page only: the answer carries
// the session (its id and token, its name and email) and no cookie is set - the form keeps it in
// the page, as it keeps an account it makes, and nothing else on the site is signed in.
const cookie = (name: string, value: string, maxAge: number, path = "/") => `${name}=${value}; Path=${path}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
const json = (body: unknown, status = 200, cookies: string[] = [], headers: Record<string, string> = {}) => {
  const h = new Headers({ "content-type": "application/json", "cache-control": "no-store", ...headers });
  for (const c of cookies) h.append("set-cookie", c);
  return new Response(JSON.stringify(body), { status, headers: h });
};

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  if (!(await withinTries(req))) return json({ ok: false, error: "slow" }, 429, [], { "retry-after": "60" });
  let identifier = "", password = "", check = "", page = false;
  try {
    const b = (await req.json()) as { identifier?: unknown; password?: unknown; check?: unknown; page?: unknown };
    identifier = String(b.identifier ?? "").trim().slice(0, 254);
    password = String(b.password ?? "").slice(0, 200);
    check = String(b.check ?? "");
    page = b.page === true;
  } catch { /* empty body */ }
  if (!identifier || !password) return json({ ok: false, error: "missing" }, 400);
  if (!(await passesCheck(req, check))) return json({ ok: false, error: "check" }, 403);
  // As the booking app signs in: an email in lower case, a mobile in the stored +966 form. A
  // number typed 05…/5… never matched the stored one, and every try counted toward the lock.
  identifier = identifier.includes("@") ? identifier.toLowerCase() : normalizePhone(identifier);
  const r = await rpcServer<{ id?: string; name?: string; email?: string; session_token?: string }[]>("customer_login", { p_identifier: identifier, p_pwd: password });
  if (/LOCKED/.test(r.message)) return json({ ok: false, error: "locked" }, 429);
  const row = Array.isArray(r.data) ? r.data[0] : null;
  if (!row?.id || !row.session_token) return json({ ok: false, error: r.status === 0 || r.status >= 500 ? "generic" : "wrong" }, r.status === 0 || r.status >= 500 ? 502 : 401);
  const session = { id: row.id, token: row.session_token };
  const must = mustChange(await rpcServer<boolean>("customer_pwd_state", { p_id: session.id, p_token: session.token }));
  if (must === null) return json({ ok: false, error: "generic" }, 502);
  if (must) return json({ ok: false, error: "must_change" }, 409, [cookie(PENDING_COOKIE, encodeSession(session), PENDING_MAX_AGE, PENDING_PATH)]);
  if (page) return json({ ok: true, id: session.id, token: session.token, name: row.name || "", email: row.email || "" });
  return json({ ok: true, name: row.name || "" }, 200, [cookie(ACCOUNT_COOKIE, encodeSession(session), ACCOUNT_MAX_AGE)]);
}

export async function DELETE(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  return json({ ok: true }, 200, [cookie(ACCOUNT_COOKIE, "", 0), cookie(PENDING_COOKIE, "", 0, PENDING_PATH)]);
}
