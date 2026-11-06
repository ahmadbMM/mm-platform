// The volunteer portal's Worker: the page and its files, plus a small API in front of the database
// that keeps the account's session token on the server side (session.ts). A volunteer is a customer
// account, so sign-in is the booking app's own customer_login, with its own meters and locks.
//
//   POST /api/login       {login, password} -> customer_login; sets the mm_volunteer cookie
//   POST /api/handoff     {code} -> customer_handoff_redeem: My Account's button, and the way back from
//                         the booking app after creating an account or signing in with Google or Apple
//   POST /api/logout      clears the cookie. The token stays: it is the account's, and ending it would
//                         also sign the rider out of the booking app.
//   POST /api/rpc/<name>  one of RPCS below, with p_id / p_token taken from the cookie. Nobody reads the
//                         portal signed out (the owner, 2026-11-05): volunteer_opportunities takes no
//                         arguments, so its session is checked here first
//
// Every POST must come from this origin's own page, as JSON, and small.

import { secure } from "./headers";
import { clearCookie, sessionOf, setCookie } from "./session";

type RateLimit = { limit(o: { key: string }): Promise<{ success: boolean }> };
type AssetFetcher = { fetch(req: Request): Promise<Response> };

export type Env = {
  ASSETS?: AssetFetcher;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  LOGIN_LIMIT?: RateLimit;
};

/** The only database functions the page may call through /api/rpc. */
export const RPCS = new Set([
  "volunteer_opportunities",
  "volunteer_me",
  "volunteer_agree",
  "volunteer_interest",
  "volunteer_enter",
  "volunteer_arrive",
  "volunteer_clock_out",
  "volunteer_find",
  "volunteer_list",
  "volunteer_checkin",
  "volunteer_donated",
  "volunteer_blood_role",
]);

/** Error codes the database raises on purpose, with the status each one is answered with. */
const KNOWN: Record<string, number> = {
  LOCKED: 429,
  VOL_TOKEN: 401,
  VOL_NOT_VOLUNTEER: 403,
  VOL_NOT_ACCEPTED: 403,
  VOL_ACCOUNT: 403,
  VOL_AGREE: 403,
  VOL_CLOSED: 403,
  VOL_CAP: 403,
  VOL_OWN_BOOKING: 403,
  VOL_NOT_YOURS: 403,
  VOL_ASK_DESK: 409,
  VOL_DONATED_FIRST: 409,
  VOL_ALREADY_IN: 409,
  VOL_DECLINED: 409,
  VOL_SIGNUP_CLOSED: 409,
  VOL_AGE: 400,
  VOL_DOB: 400,
  VOL_BAD_SEARCH: 400,
  VOL_SLOW: 429,
  BOOKING_NOT_FOUND: 404,
  BAD_BOOKING_STATE: 409,
  BLOOD_NOT_CHECKED_IN: 409,
  BLOOD_CODE_USED: 409,
  BLOOD_NO_ACCOUNT: 409,
  BLOOD_VISITOR: 409,
  BLOOD_DONATED: 409,
};

/** The status a code the database raises on purpose takes, or null for any other text
 *  (an own key only: a message such as "constructor" must not match the object's prototype). */
export function knownStatus(code: string): number | null {
  return Object.prototype.hasOwnProperty.call(KNOWN, code) ? KNOWN[code] : null;
}

export const LOGIN_BODY_LIMIT = 2 * 1024;
export const RPC_BODY_LIMIT = 4 * 1024;

const json = (data: unknown, status = 200, cookie?: string): Response => {
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  if (cookie) headers.append("Set-Cookie", cookie);
  return new Response(JSON.stringify(data), { status, headers });
};
const fail = (error: string, status: number, cookie?: string, detail?: string) => json(detail ? { error, detail } : { error }, status, cookie);

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
  try { return (await env.LOGIN_LIMIT.limit({ key: `volunteer-sign-in:${ip}` })).success; } catch { return true; }
}

type DbAnswer = { ok: true; data: unknown } | { ok: false; status: number; code: string; detail?: string };

async function callDb(env: Env, req: Request, name: string, args: Record<string, unknown>): Promise<DbAnswer> {
  const headers: Record<string, string> = {
    apikey: env.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  // The visitor's own address, for the database's per-network meter where it is honoured.
  const ip = req.headers.get("cf-connecting-ip");
  if (ip) headers["X-Forwarded-For"] = ip;
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
  const err = (data && typeof data === "object" ? data : {}) as { message?: string; code?: string; details?: string };
  const msg = String(err.message || "");
  const known = knownStatus(msg);
  if (known !== null) return { ok: false, status: known, code: msg, detail: err.details ? String(err.details).slice(0, 40) : undefined };
  const pg = String(err.code || "");
  if (pg.startsWith("22") || pg.startsWith("23") || pg.startsWith("PGRST1") || pg.startsWith("PGRST2")) {
    return { ok: false, status: 400, code: "BAD_INPUT" };
  }
  return { ok: false, status: 502, code: "SERVER" };
}

/** A sign-in name as the database stores it: an email in lower case, or a mobile in its +966 form
 *  (the booking app's _normPhone). A number typed without its country is read as Saudi. */
export function normalizeLogin(raw: string): string {
  const s = raw.trim().replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0));
  if (s.includes("@")) return s.toLowerCase();
  const t = s.replace(/[\s()-]/g, "");
  if (!t) return "";
  if (t[0] === "+") {
    const d = t.slice(1).replace(/\D/g, "");
    return `+${d.startsWith("9660") ? `966${d.slice(4)}` : d}`;
  }
  const n = t.replace(/\D/g, "");
  if (!n) return s.toLowerCase();
  if (n.startsWith("00")) return `+${n.slice(2)}`;
  if (n.startsWith("966") && n.length >= 12) return `+${n}`;
  if (n[0] === "0") return `+966${n.slice(1)}`;
  return `+966${n}`;
}

const validSession = (id: unknown, token: unknown): id is string =>
  typeof id === "string" && typeof token === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id) && /^[A-Za-z0-9_-]{16,200}$/.test(token);

async function login(req: Request, env: Env): Promise<Response> {
  if (!(await withinTries(req, env))) return fail("RATE_LIMIT", 429);
  const read = await readBody(req, LOGIN_BODY_LIMIT);
  if ("error" in read) return read.error;
  const { login: who, password } = read.body;
  if (typeof who !== "string" || typeof password !== "string" || !who.trim() || !password || who.length > 200 || password.length > 200) {
    return fail("BAD_LOGIN", 400);
  }
  const r = await callDb(env, req, "customer_login", { p_identifier: normalizeLogin(who), p_pwd: password });
  if (!r.ok) return fail(r.code, r.status);
  // A wrong password answers no row, so the database keeps its count of failed tries.
  const row = Array.isArray(r.data) ? (r.data[0] as { id?: unknown; session_token?: unknown } | undefined) : undefined;
  if (!row) return fail("BAD_LOGIN", 401);
  if (!validSession(row.id, row.session_token)) return fail("SERVER", 502);
  return json({ ok: true }, 200, setCookie({ id: row.id, token: row.session_token as string }));
}

async function handoff(req: Request, env: Env): Promise<Response> {
  if (!(await withinTries(req, env))) return fail("RATE_LIMIT", 429);
  const read = await readBody(req, LOGIN_BODY_LIMIT);
  if ("error" in read) return read.error;
  const code = read.body.code;
  if (typeof code !== "string" || !/^[0-9a-f]{48}$/.test(code)) return fail("BAD_CODE", 400);
  const r = await callDb(env, req, "customer_handoff_redeem", { p_code: code });
  if (!r.ok) return fail(r.code, r.status);
  const row = Array.isArray(r.data) ? (r.data[0] as { id?: unknown; session_token?: unknown } | undefined) : undefined;
  if (!row || !validSession(row.id, row.session_token)) return fail("BAD_CODE", 400);
  return json({ ok: true }, 200, setCookie({ id: row.id, token: row.session_token as string }));
}

async function rpc(req: Request, env: Env, name: string): Promise<Response> {
  if (!RPCS.has(name)) return fail("NOT_FOUND", 404);
  const s = sessionOf(req);
  // Without a session, "who am I" is answered, not refused: the page asks it on every load.
  if (!s) return name === "volunteer_me" ? json({ signedIn: false }) : fail("VOL_TOKEN", 401, clearCookie());
  if (name === "volunteer_opportunities") {
    // A cookie is not yet a sign-in: the token has to open an account.
    const who = await callDb(env, req, "volunteer_me", { p_id: s.id, p_token: s.token });
    if (!who.ok) return fail(who.code, who.status);
    if (who.data === null || who.data === undefined) return fail("VOL_TOKEN", 401, clearCookie());
    const r = await callDb(env, req, name, {});
    return r.ok ? json(r.data ?? []) : fail(r.code, r.status);
  }
  const read = await readBody(req, RPC_BODY_LIMIT);
  if ("error" in read) return read.error;
  // Who is asking comes from the cookie only, whatever the body says.
  const args: Record<string, unknown> = { ...read.body, p_id: s.id, p_token: s.token };
  const r = await callDb(env, req, name, args);
  if (!r.ok) return fail(r.code, r.status, r.code === "VOL_TOKEN" ? clearCookie() : undefined, r.detail);
  // A token that no longer opens the account answers nothing.
  if (name === "volunteer_me" && (r.data === null || r.data === undefined)) return json({ signedIn: false }, 200, clearCookie());
  return json(r.data ?? null);
}

async function route(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
    if (req.method !== "POST") return fail("METHOD", 405);
    if (!sameOrigin(req)) return fail("ORIGIN", 403);
    if (url.pathname === "/api/login") return login(req, env);
    if (url.pathname === "/api/handoff") return handoff(req, env);
    if (url.pathname === "/api/logout") return json({ ok: true }, 200, clearCookie());
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
