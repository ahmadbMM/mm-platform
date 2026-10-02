import { ACCOUNT_COOKIE, decodeSession, sameOrigin, type Session } from "./account-core";
import { cookieValue } from "./live";

// What every My Account write route (app/api/account/*) does first: only this site's own pages may
// call it, and the account is the one in the HttpOnly cookie - never an id or token the browser
// sends. The answers are never cached. Tokens are never logged.

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });

/** The signed-in session for a write, or the answer to give instead (403 another site, 401 no cookie). */
export function writeSession(req: Request): { session: Session } | { refuse: Response } {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return { refuse: json({ ok: false, error: "origin" }, 403) };
  const s = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!s) return { refuse: json({ ok: false, error: "signin" }, 401) };
  return { session: s };
}

/** A JSON body as an object, or {} when there is none (a malformed body is no answer). */
export async function bodyOf(req: Request): Promise<Record<string, unknown>> {
  try { const b = (await req.json()) as unknown; return b && typeof b === "object" && !Array.isArray(b) ? (b as Record<string, unknown>) : {}; }
  catch { return {}; }
}

/** The database could not be reached (no answer, or a server error). */
export const unreachable = (r: { status: number }) => r.status === 0 || r.status >= 500;
