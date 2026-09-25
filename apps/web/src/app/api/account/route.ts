import { ACCOUNT_COOKIE, ACCOUNT_MAX_AGE, encodeSession, sameOrigin } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { normalizePhone } from "@/lib/rpc-client";
import { passesCheck, withinTries } from "@/lib/sign-in-guard";

// Sign in (POST {identifier, password}) and out (DELETE) with a Micromobility account. The
// password goes to the booking app's own customer_login (which meters failed tries per email /
// mobile and per account); the session it hands back is kept in an HttpOnly cookie. Only this
// site's own pages may call it, a connection gets a few tries a minute, and a Turnstile check
// rides along once its keys are set (lib/sign-in-guard.ts).
const cookie = (value: string, maxAge: number) => `${ACCOUNT_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  if (!(await withinTries(req))) return json({ ok: false, error: "slow" }, 429, { "retry-after": "60" });
  let identifier = "", password = "", check = "";
  try {
    const b = (await req.json()) as { identifier?: unknown; password?: unknown; check?: unknown };
    identifier = String(b.identifier ?? "").trim().slice(0, 254);
    password = String(b.password ?? "").slice(0, 200);
    check = String(b.check ?? "");
  } catch { /* empty body */ }
  if (!identifier || !password) return json({ ok: false, error: "missing" }, 400);
  if (!(await passesCheck(req, check))) return json({ ok: false, error: "check" }, 403);
  // As the booking app signs in: an email in lower case, a mobile in the stored +966 form. A
  // number typed 05…/5… never matched the stored one, and every try counted toward the lock.
  identifier = identifier.includes("@") ? identifier.toLowerCase() : normalizePhone(identifier);
  const r = await rpcServer<{ id?: string; name?: string; session_token?: string }[]>("customer_login", { p_identifier: identifier, p_pwd: password });
  if (/LOCKED/.test(r.message)) return json({ ok: false, error: "locked" }, 429);
  const row = Array.isArray(r.data) ? r.data[0] : null;
  if (!row?.id || !row.session_token) return json({ ok: false, error: r.status === 0 || r.status >= 500 ? "generic" : "wrong" }, r.status === 0 || r.status >= 500 ? 502 : 401);
  return json({ ok: true, name: row.name || "" }, 200, { "set-cookie": cookie(encodeSession({ id: row.id, token: row.session_token }), ACCOUNT_MAX_AGE) });
}

export async function DELETE(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  return json({ ok: true }, 200, { "set-cookie": cookie("", 0) });
}
