import { ACCOUNT_COOKIE, PENDING_COOKIE, PENDING_MAX_AGE, PENDING_PATH, decodeSession, encodeSession, mustChange, sameOrigin, sessionCookie, type Session } from "./account-core";
import { forVisitor, rpcServer } from "./account";
import { jsonCapped, TOO_BIG } from "./capped-body";
import { HANDOFF_COOKIE } from "./handoff";
import { cookieValue } from "./live";
import { payEnv } from "./pay/config";
import { withinLimit } from "./rate-limit";
import { withinTries } from "./sign-in-guard";
import { loadSiteContent } from "./site";
import { isStaging } from "./staging";
import {
  PK_CHALLENGE_COOKIE, PK_CHALLENGE_RE, beginOf, challengeCookie, creationOptions, passkeyItems, passkeyLabel, passkeyRp, passkeysOn,
  pkRefusal, requestOptions, type PkEnv, type PkError,
} from "./sx-B7-passkey";
import {
  assertionInput, canonicalB64url, clientChallenge, credentialIdOf, registrationInput, verifyAssertion, verifyRegistration,
  type RpConfig, type StoredPasskey,
} from "./sx-B7-webauthn";

// Passkeys on the server (N06, B7; the rules are in lib/sx-B7-passkey.ts, the checks in lib/sx-B7-webauthn.ts). Every
// route is POST /api/account/passkey/<action>, from this site's own pages only:
//   signin-start  a challenge for a sign-in (the database's, passkey_begin), with its cookie
//   signin        the passkey's answer: the database hands the stored key once for that challenge (passkey_take),
//                 this server checks the signature and the rest, then the DATABASE signs the account in
//                 (passkey_sign_in: the account's own session token, as customer_login hands it) - the site never makes
//                 a session itself. The cookie is then the password sign-in's, and a temporary password staff gave is
//                 held for a new one the same way (customer_pwd_state, must_change).
//   add-start     signed in: a challenge for a new passkey of this account, with its user handle and the passkeys it
//                 already has (so a device holding one is not asked again)
//   add           signed in: the new passkey checked here, kept by the database (passkey_register: public key only)
//   list, remove  signed in: the account's passkeys (never a key or credential id), and removing one
// Nothing answers while the switch is off (site_content 'account.passkeys'), the server key is missing, or the request
// came in under a host that is not this deployment's: "off", 404. Sign-in tries count with the password's (10 a minute
// per connection, LOGIN_LIMIT); the account's own actions with its other checks (API_LIMIT); the database meters
// challenges per visitor as well.

const MAX_BODY = 16_000;

/** Which relying party this deployment is (lib/sx-B7-passkey.ts PK_RPS). */
export const pkEnv = (): PkEnv => (process.env.NODE_ENV === "development" ? "dev" : isStaging() ? "staging" : "production");

const serverKey = () => payEnv().PAY_SERVER_KEY ?? "";

/** Whether the pages show anything about passkeys: the switch is on and this server holds the database key. */
export const passkeysShown = (content: Record<string, unknown> | null | undefined) => passkeysOn(content) && serverKey().length >= 32;

type Ctx = { req: Request; rp: RpConfig; key: string };

const out = (body: unknown, status = 200, cookies: string[] = [], headers: Record<string, string> = {}) => {
  const h = new Headers({ "content-type": "application/json", "cache-control": "no-store, private", ...headers });
  for (const c of cookies) h.append("set-cookie", c);
  return new Response(JSON.stringify(body), { status, headers: h });
};
const no = (error: PkError | "must_change", status: number, cookies: string[] = []) =>
  out({ ok: false, error }, status, cookies, error === "slow" ? { "retry-after": "60" } : {});
const forget = () => challengeCookie("", 0);
const keep = (name: string, value: string, maxAge: number, path = "/") => `${name}=${value}; Path=${path}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;

async function ready(req: Request): Promise<Ctx | null> {
  const key = serverKey();
  if (key.length < 32) return null;
  const rp = passkeyRp(req.url, pkEnv());
  if (!rp) return null;
  if (!passkeysOn(await loadSiteContent())) return null;
  return { req, rp, key };
}

const call = <T,>(c: Ctx, fn: string, args: Record<string, unknown>) =>
  rpcServer<T>(fn, forVisitor(c.req, { p_key: c.key, ...args }), 8000);

const refused = (r: Awaited<ReturnType<typeof rpcServer>>, cookies: string[] = []) => {
  const f = pkRefusal(r);
  return no(f.error, f.status, cookies);
};

const sessionOf = (req: Request): Session | null => decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
const challengeOf = (req: Request): string => {
  const v = cookieValue(req.headers.get("cookie"), PK_CHALLENGE_COOKIE) ?? "";
  return PK_CHALLENGE_RE.test(v) ? v : "";
};

/** POST /api/account/passkey/<action>. */
export async function passkeyPost(req: Request, action: string): Promise<Response> {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return no("origin", 403);
  const c = await ready(req);
  if (!c) return no("off", 404);
  switch (action) {
    case "signin-start": return signinStart(c);
    case "signin": return signin(c);
    case "add-start": return addStart(c);
    case "add": return add(c);
    case "list": return list(c);
    case "remove": return remove(c);
    default: return no("off", 404);
  }
}

/* ------------------------------------------------------------------ signing in */

async function signinStart(c: Ctx): Promise<Response> {
  if (!(await withinTries(c.req))) return no("slow", 429);
  const r = await call<unknown>(c, "passkey_begin", { p_purpose: "signin", p_rp_id: c.rp.rpId, p_id: null, p_token: null });
  const b = r.status === 200 ? beginOf(r.data, false) : null;
  if (!b) return refused(r);
  return out({ ok: true, options: requestOptions(b, c.rp) }, 200, [challengeCookie(b.challenge)]);
}

/** passkey_take's answer: the stored passkey to check the signature with. */
export function takenOf(d: unknown, credId: string): StoredPasskey | null {
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  if (o.ok !== true || typeof o.public_key !== "string" || typeof o.user_handle !== "string") return null;
  const pk = canonicalB64url(o.public_key), uh = canonicalB64url(o.user_handle);
  return pk && uh ? { credId, publicKey: pk, userHandle: uh, backupEligible: o.backup_eligible === true } : null;
}

/** passkey_sign_in's answer: the account and its session token. */
export function signedOf(d: unknown): { id: string; token: string; name: string } | null {
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  if (o.ok !== true || typeof o.id !== "string" || typeof o.session_token !== "string") return null;
  const s = decodeSession(encodeSession({ id: o.id, token: o.session_token }));
  return s ? { ...s, name: typeof o.name === "string" ? o.name : "" } : null;
}

async function signin(c: Ctx): Promise<Response> {
  if (!(await withinTries(c.req))) return no("slow", 429);
  const body = await jsonCapped(c.req, MAX_BODY);
  const input = body === TOO_BIG ? null : assertionInput(body);
  const ch = challengeOf(c.req);
  if (!input) return no("invalid", 400, [forget()]);
  // the challenge in the passkey's answer is the one this browser was handed (its cookie), else nothing is asked
  if (!ch || clientChallenge(input.response.clientDataJSON) !== ch) return no("expired", 400, [forget()]);
  const credId = credentialIdOf(input);
  if (!credId) return no("invalid", 400, [forget()]);
  // the challenge is spent here, whatever comes next (passkey_take marks it taken for this passkey)
  const t = await call<unknown>(c, "passkey_take", { p_challenge: ch, p_rp_id: c.rp.rpId, p_cred_id: credId });
  const stored = t.status === 200 ? takenOf(t.data, credId) : null;
  if (!stored) return refused(t, [forget()]);
  const v = await verifyAssertion(input, { challenge: ch, rp: c.rp, stored });
  if (!v.ok) {
    console.warn("passkey sign-in refused:", v.why);
    return no("failed", 401, [forget()]);
  }
  const s = await call<unknown>(c, "passkey_sign_in", {
    p_challenge: ch, p_rp_id: c.rp.rpId, p_cred_id: credId, p_sign_count: v.signCount, p_backed_up: v.backedUp, p_user_verified: v.uv,
  });
  const row = s.status === 200 ? signedOf(s.data) : null;
  if (!row) return refused(s, [forget()]);
  const session = { id: row.id, token: row.token };
  // as the password sign-in: a temporary password staff gave is replaced before the account is used
  const must = mustChange(await rpcServer<boolean>("customer_pwd_state", { p_id: session.id, p_token: session.token }));
  if (must === null) return no("generic", 502, [forget()]);
  if (must) return no("must_change", 409, [forget(), keep(PENDING_COOKIE, encodeSession(session), PENDING_MAX_AGE, PENDING_PATH)]);
  return out({ ok: true, name: row.name }, 200, [forget(), sessionCookie(encodeSession(session)), keep(HANDOFF_COOKIE, "", 0)]);
}

/* ------------------------------------------------------------------ the account's passkeys */

async function signedIn(c: Ctx): Promise<Session | Response> {
  const s = sessionOf(c.req);
  if (!s) return no("signin", 401);
  if (!(await withinLimit(c.req, "account-check", undefined, s.id))) return no("slow", 429);
  return s;
}

async function addStart(c: Ctx): Promise<Response> {
  const s = await signedIn(c);
  if (s instanceof Response) return s;
  const r = await call<unknown>(c, "passkey_begin", { p_purpose: "register", p_rp_id: c.rp.rpId, p_id: s.id, p_token: s.token });
  const b = r.status === 200 ? beginOf(r.data, true) : null;
  if (!b) return refused(r);
  return out({ ok: true, options: creationOptions(b, c.rp) }, 200, [challengeCookie(b.challenge)]);
}

async function add(c: Ctx): Promise<Response> {
  const s = await signedIn(c);
  if (s instanceof Response) return s;
  const body = await jsonCapped(c.req, MAX_BODY);
  const input = body === TOO_BIG ? null : registrationInput(body);
  const ch = challengeOf(c.req);
  if (!input) return no("invalid", 400, [forget()]);
  if (!ch || clientChallenge(input.response.clientDataJSON) !== ch) return no("expired", 400, [forget()]);
  const v = await verifyRegistration(input, { challenge: ch, rp: c.rp });
  if (!v.ok) {
    console.warn("passkey add refused:", v.why);
    return no("failed", 400, [forget()]);
  }
  const r = await call<unknown>(c, "passkey_register", {
    p_id: s.id, p_token: s.token, p_challenge: ch, p_rp_id: c.rp.rpId, p_cred_id: v.credId, p_public_key: v.publicKey, p_alg: v.alg,
    p_sign_count: v.signCount, p_backup_eligible: v.backupEligible, p_backed_up: v.backedUp, p_transports: v.transports,
    p_aaguid: v.aaguid, p_label: passkeyLabel(v.aaguid, c.req.headers.get("user-agent") ?? ""),
  });
  const items = r.status === 200 && (r.data as { ok?: unknown } | null)?.ok === true ? passkeyItems(r.data) : null;
  if (!items) return refused(r, [forget()]);
  return out({ ok: true, items }, 200, [forget()]);
}

async function list(c: Ctx): Promise<Response> {
  const s = await signedIn(c);
  if (s instanceof Response) return s;
  const r = await call<unknown>(c, "passkey_list", { p_id: s.id, p_token: s.token });
  const items = r.status === 200 ? passkeyItems(r.data) : null;
  return items ? out({ ok: true, items }) : refused(r);
}

async function remove(c: Ctx): Promise<Response> {
  const s = await signedIn(c);
  if (s instanceof Response) return s;
  const body = await jsonCapped(c.req, 1000);
  const id = body && typeof body === "object" ? (body as { id?: unknown }).id : null;
  if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return no("invalid", 400);
  const r = await call<unknown>(c, "passkey_remove", { p_id: s.id, p_token: s.token, p_passkey: id.toLowerCase() });
  const items = r.status === 200 ? passkeyItems(r.data) : null;
  return items ? out({ ok: true, items }) : refused(r);
}
