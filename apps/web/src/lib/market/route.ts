import { ACCOUNT_COOKIE, decodeSession, sameOrigin, type Session } from "../account-core";
import { jsonCapped, TOO_BIG } from "../capped-body";
import { cookieValue } from "../live";
import { withinLimit } from "../rate-limit";
import type { MkError } from "./core";
import type { MkResult } from "./server";

// What every Marketplace route (app/api/market/*) does first, and how it answers. Only this site's own pages may ask
// for a change; the account is the one in the HttpOnly cookie, never an id or a token the browser sends; an account
// gets thirty requests a minute (its photos thirty more, counted apart), a connection six hundred; a body is read to a
// byte limit whatever its Content-Length says. Every answer is JSON and is never kept: {ok: true, ...} or
// {ok: false, error, detail?} with the error ids of lib/market/core.ts (MK_ERRORS). Tokens are never logged.

export const mkJson = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store, private" } });
/** {ok: false, error, detail?} with its HTTP status. */
export const mkRefuse = (error: MkError, status: number, detail = ""): Response => mkJson({ ok: false, error, ...(detail ? { detail } : {}) }, status);

/** The account cookie's session in a route's request, or null. */
export const mkSessionOf = (req: Request): Session | null => decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));

export type GuardOptions = {
  /** A read (GET): no Origin is asked for (a browser sends none with its own page's GET) and no body is read. */
  read?: boolean;
  /** false: a visitor without an account may ask too (`session` is then null). */
  signin?: boolean;
  /** The body's limit in bytes (20,000 when left out). */
  max?: number;
  /** The body is not JSON (a photo's upload): it is left unread for the route, which reads it itself to `max`
   *  (lib/capped-body.ts readCapped). */
  raw?: boolean;
  /** Which count the request goes on: "market" (the default) or "market-photo" (the photo uploads). */
  kind?: "market" | "market-photo";
};
type Refused = { ok: false; res: Response };
type Passed<S> = { ok: true; session: S; body: Record<string, unknown> };

/** The guard. `const g = await marketGuard(req); if (!g.ok) return g.res;` then `g.session` (the account) and `g.body`
 *  (the JSON body as an object; {} for a read or a raw body). Refuses with: "origin" 403 (another site's page),
 *  "signin" 401 (no account cookie), "too_big" 413, "busy" 429 (the minute's requests), "invalid" 400 (a body that is
 *  not a JSON object). */
export async function marketGuard(req: Request, o: GuardOptions & { signin: false }): Promise<Passed<Session | null> | Refused>;
export async function marketGuard(req: Request, o?: GuardOptions): Promise<Passed<Session> | Refused>;
export async function marketGuard(req: Request, o: GuardOptions = {}): Promise<Passed<Session | null> | Refused> {
  const max = o.max ?? 20_000;
  if (!o.read && !sameOrigin(req.headers.get("origin"), req.url)) return { ok: false, res: mkRefuse("origin", 403) };
  const session = mkSessionOf(req);
  if (!session && o.signin !== false) return { ok: false, res: mkRefuse("signin", 401) };
  if (!o.read && Number(req.headers.get("content-length") || 0) > max) return { ok: false, res: mkRefuse("too_big", 413) };
  if (!(await withinLimit(req, o.kind ?? "market", undefined, session?.id ?? ""))) return { ok: false, res: mkRefuse("busy", 429) };
  if (o.read || o.raw) return { ok: true, session, body: {} };
  const body = await jsonCapped(req, max);
  if (body === TOO_BIG) return { ok: false, res: mkRefuse("too_big", 413) };
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, res: mkRefuse("invalid", 400) };
  return { ok: true, session, body: body as Record<string, unknown> };
}

/** A database call's result as the route's answer: {ok: true, ...the function's answer} (or what `pick` makes of it),
 *  or its refusal with its status. */
export function mkAnswer<T>(r: MkResult<T>, pick?: (data: T) => Record<string, unknown>): Response {
  if (!r.ok) return mkRefuse(r.error, r.status, r.detail);
  const data = pick ? pick(r.data) : r.data;
  return mkJson({ ok: true, ...(data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : {}) });
}

/* ------------------------------------------------------------------ reading a body's values */

/** A number a body names something by (a listing, a thread): a positive whole number, or null. */
export const bodyId = (v: unknown): number | null => (typeof v === "number" && Number.isSafeInteger(v) && v > 0 ? v : null);
/** A text of `max` characters at most, or null (not a text, or longer). */
export const bodyText = (v: unknown, max: number): string | null => (typeof v === "string" && v.length <= max ? v : null);
/** A whole number inside lo..hi, or null. */
export const bodyInt = (v: unknown, lo: number, hi: number): number | null => (typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : null);
