// The vendor portal's Worker: the page and its files, plus a small API in front of the
// database that keeps each venue's session token on the server side (session.ts).
//
//   POST /api/login       {login, password} -> vendor_login; sets the mm_vendor cookie
//   POST /api/logout      ends the session in the database (vendor_logout), then clears the cookie
//   POST /api/rpc/<name>  one of RPCS below, with p_uid / p_token taken from the cookie
//                         (vendor_me without a session answers {signedIn: false}, not a 401)
//
// Every POST must come from this origin's own page, as JSON, and small. Sign-in tries are metered
// per connection by Cloudflare's rate limiter (LOGIN_LIMIT, wrangler.jsonc) on top of the
// database's own lock on a login after repeated failures. When the secret VENDOR_GATE_SECRET is set
// (wrangler secret put), the sign-in call carries it as the x-vendor-gate header: once the owner
// stores its hash in the database (vendor_gate, rentals migration 20261004130000), sign-in works only
// through this Worker. The browser's User-Agent goes along, so the venue's device list can name it.

import { secure } from "./headers";
import { clearCookie, sessionOf, setCookie } from "./session";

type RateLimit = { limit(o: { key: string }): Promise<{ success: boolean }> };
type AssetFetcher = { fetch(req: Request): Promise<Response> };

export type Env = {
  ASSETS?: AssetFetcher;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  LOGIN_LIMIT?: RateLimit;
  /** A Worker secret (never in wrangler.jsonc): sent with vendor_login only, as x-vendor-gate. */
  VENDOR_GATE_SECRET?: string;
};

/** The only database functions the page may call through /api/rpc. */
export const RPCS = new Set([
  "vendor_set_password",
  "vendor_me",
  "vendor_calendar",
  "vendor_preview",
  "vendor_request",
  "vendor_cancel",
  "vendor_profile_save",
  "vendor_feedback_save",
  "vendor_shared_ratings_mine",
  "vendor_logout_others",
  "vendor_team",
]);

/** Error codes the database raises on purpose, with the status each one is answered with. */
const KNOWN: Record<string, number> = {
  BAD_LOGIN: 401,
  BAD_TOKEN: 401,
  LOCKED: 429,
  BAD_PASSWORD: 400,
  WEAK_PASSWORD: 400,
  SAME_PASSWORD: 400,
  BAD_RANGE: 400,
  BAD_MODE: 400,
  BAD_PATTERN: 400,
  ONE_DATE: 400,
  TOO_MANY: 400,
  NOT_CONFIRMED: 400,
  TOO_EARLY: 400,
  TOO_LATE: 400,
  BAD_RATING: 400,
  NOT_FOUND: 404,
  // 20261004130000: the temporary password first, roles, the 48-hour reason, the password policy,
  // the contact's checks, the gate.
  MUST_CHANGE: 403,
  TEMP_EXPIRED: 401,
  FORBIDDEN: 403,
  LATE_REASON: 400,
  COMMON_PASSWORD: 400,
  PERSONAL_PASSWORD: 400,
  BAD_PHONE: 400,
  BAD_EMAIL: 400,
  TOO_LONG: 400,
};

export const LOGIN_BODY_LIMIT = 2 * 1024;
export const RPC_BODY_LIMIT = 16 * 1024;

const json = (data: unknown, status = 200, cookie?: string): Response => {
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  if (cookie) headers.append("Set-Cookie", cookie);
  return new Response(JSON.stringify(data), { status, headers });
};
const fail = (error: string, status: number, cookie?: string) => json({ error }, status, cookie);

/** Only this origin's own page may post (a plain same-origin check on the Origin header). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  try { return !!origin && origin === new URL(req.url).origin; } catch { return false; }
}

/** The request's JSON object body, or the error to answer with. */
async function readBody(req: Request, limit: number): Promise<{ body: Record<string, unknown> } | { error: Response }> {
  const type = (req.headers.get("content-type") || "").toLowerCase();
  if (!type.startsWith("application/json")) return { error: fail("JSON_ONLY", 415) };
  const declared = Number(req.headers.get("content-length") || "0");
  if (declared > limit) return { error: fail("TOO_LARGE", 413) };
  const buf = await req.arrayBuffer();
  if (buf.byteLength > limit) return { error: fail("TOO_LARGE", 413) };
  if (buf.byteLength === 0) return { body: {} };
  try {
    const v = JSON.parse(new TextDecoder().decode(buf)) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return { error: fail("BAD_INPUT", 400) };
    return { body: v as Record<string, unknown> };
  } catch {
    return { error: fail("BAD_INPUT", 400) };
  }
}

/** False once this connection has used its sign-in tries; true when there is no limiter (local). */
export async function withinTries(req: Request, env: Env): Promise<boolean> {
  const ip = req.headers.get("cf-connecting-ip") || "";
  if (!env.LOGIN_LIMIT || !ip) return true;
  try { return (await env.LOGIN_LIMIT.limit({ key: `vendor-sign-in:${ip}` })).success; } catch { return true; }
}

type DbAnswer = { ok: true; data: unknown } | { ok: false; status: number; code: string };

async function callDb(env: Env, req: Request, name: string, args: Record<string, unknown>): Promise<DbAnswer> {
  const headers: Record<string, string> = {
    apikey: env.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  // The venue's own address, for the database's per-network meter where it is honoured.
  const ip = req.headers.get("cf-connecting-ip");
  if (ip) headers["X-Forwarded-For"] = ip;
  // The device's own description, for the venue's list of signed-in devices.
  const ua = req.headers.get("user-agent");
  if (ua) headers["User-Agent"] = ua.slice(0, 300);
  // The gate secret goes with sign-in only (the one function that checks it).
  if (name === "vendor_login" && env.VENDOR_GATE_SECRET) headers["x-vendor-gate"] = env.VENDOR_GATE_SECRET;
  let res: Response;
  try {
    res = await fetch(`${env.SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers,
      body: JSON.stringify(args),
    });
  } catch {
    return { ok: false, status: 502, code: "UNREACHABLE" };
  }
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = null; }
  }
  if (res.ok) return { ok: true, data };
  const err = (data && typeof data === "object" ? data : {}) as { message?: string; code?: string };
  const msg = String(err.message || "");
  if (msg in KNOWN) return { ok: false, status: KNOWN[msg], code: msg };
  const pg = String(err.code || "");
  // Bad values (a malformed date, a check the venue's input failed, wrong arguments).
  if (pg.startsWith("22") || pg.startsWith("23") || pg.startsWith("PGRST1") || pg.startsWith("PGRST2")) {
    return { ok: false, status: 400, code: "BAD_INPUT" };
  }
  return { ok: false, status: 502, code: "SERVER" };
}

async function login(req: Request, env: Env): Promise<Response> {
  if (!(await withinTries(req, env))) return fail("RATE_LIMIT", 429);
  const read = await readBody(req, LOGIN_BODY_LIMIT);
  if ("error" in read) return read.error;
  const { login: who, password } = read.body;
  if (typeof who !== "string" || typeof password !== "string" || !who.trim() || !password || who.length > 200 || password.length > 200) {
    return fail("BAD_LOGIN", 400);
  }
  const r = await callDb(env, req, "vendor_login", { p_login: who.trim(), p_pwd: password });
  if (!r.ok) return fail(r.code, r.status);
  const d = (r.data || {}) as { error?: string; id?: number; token?: string; must_change?: boolean };
  if (d.error) return fail(d.error in KNOWN ? d.error : "BAD_LOGIN", 401);
  if (typeof d.id !== "number" || typeof d.token !== "string") return fail("SERVER", 502);
  return json({ must_change: d.must_change === true }, 200, setCookie({ id: d.id, token: d.token }));
}

/** Ends this device's session in the database (best effort: the cookie is cleared either way). */
async function logout(req: Request, env: Env): Promise<Response> {
  const s = sessionOf(req);
  if (s) await callDb(env, req, "vendor_logout", { p_uid: String(s.id), p_token: s.token });
  return json({ ok: true }, 200, clearCookie());
}

async function rpc(req: Request, env: Env, name: string): Promise<Response> {
  if (!RPCS.has(name)) return fail("NOT_FOUND", 404);
  const s = sessionOf(req);
  // Without a session, "who am I" is answered, not refused: the page asks it on every load, and the
  // 401 was an error in the browser's console for everyone signed out. Any other call is refused.
  if (!s) return name === "vendor_me" ? json({ signedIn: false }, 200, clearCookie()) : fail("BAD_TOKEN", 401, clearCookie());
  const read = await readBody(req, RPC_BODY_LIMIT);
  if ("error" in read) return read.error;
  // Who is asking comes from the cookie only, whatever the body says.
  const args: Record<string, unknown> = { ...read.body, p_uid: s.id, p_token: s.token };
  const r = await callDb(env, req, name, args);
  if (!r.ok) return fail(r.code, r.status, r.code === "BAD_TOKEN" ? clearCookie() : undefined);
  if (name === "vendor_set_password") {
    // A new password signs every other device out and hands this one a new token: {token} (or, from a
    // database before 20261004130000, the token itself). A wrong current password is ANSWERED as
    // {error: "BAD_PASSWORD"}, so the database keeps its count of failed tries.
    const d = r.data as { token?: unknown; error?: unknown } | string | null;
    if (d && typeof d === "object" && typeof d.error === "string") return fail(d.error in KNOWN ? d.error : "BAD_PASSWORD", 400);
    const token = typeof d === "string" ? d : d && typeof d === "object" && typeof d.token === "string" ? d.token : "";
    if (!token) return fail("SERVER", 502);
    return json({ ok: true }, 200, setCookie({ id: s.id, token }));
  }
  return json(r.data ?? null);
}

async function route(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
    if (req.method !== "POST") return fail("METHOD", 405);
    if (!sameOrigin(req)) return fail("ORIGIN", 403);
    if (url.pathname === "/api/login") return login(req, env);
    if (url.pathname === "/api/logout") return logout(req, env);
    const m = /^\/api\/rpc\/([a-z_]{1,40})$/.exec(url.pathname);
    if (m) return rpc(req, env, m[1]);
    return fail("NOT_FOUND", 404);
  }
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
  if (!env.ASSETS) return new Response("Not found", { status: 404 });
  return env.ASSETS.fetch(req);
}

/** Every answer, with the security headers. */
export async function handle(req: Request, env: Env): Promise<Response> {
  return secure(await route(req, env));
}
