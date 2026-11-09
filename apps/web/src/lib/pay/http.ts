import { ACCOUNT_COOKIE, decodeSession, sameOrigin, type Session } from "@/lib/account-core";
import { cookieValue } from "@/lib/live";
import { withinLimit } from "@/lib/rate-limit";
import { payReady } from "./config";
import { refusal } from "./server";

// The pay routes' shared answers. Every route that starts a payment is called by this site's own pages
// (same origin), is metered per visitor, and reads the account from its HttpOnly cookie, never the body.

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store, private" } });

export type Guarded = { ok: true; acct: Session | null; body: Record<string, unknown> } | { ok: false; res: Response };

/** Same origin, payments set up here, within the visitor's minute, and the body read. With `signin`,
 *  a signed-in account is required. */
export async function guard(req: Request, opts: { signin: boolean }): Promise<Guarded> {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return { ok: false, res: json({ ok: false, error: "origin" }, 403) };
  if (!payReady()) return { ok: false, res: json({ ok: false, error: "pay_off" }, 503) };
  if (!(await withinLimit(req, "pay"))) return { ok: false, res: json({ ok: false, error: "busy" }, 429) };
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (opts.signin && !acct) return { ok: false, res: json({ ok: false, error: "signin" }, 401) };
  let body: unknown = null;
  try { body = await req.json(); } catch { /* empty body */ }
  return { ok: true, acct, body: body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {} };
}

/** The database's refusal as a short code the pages have words for. */
export function payError(r: { status: number; message: string }): { error: string; status: number } {
  if (r.status === 0 || r.status >= 500) return { error: "generic", status: 502 };
  const code = refusal(r);
  const map: Record<string, string> = {
    NOT_AUTHORIZED: "signin", PAY_OFF: "pay_off", STORE_CLOSED: "pay_off", NOT_FOUND: "not_found",
    PAY_NOT_OPEN: "not_open", PAY_IN_PROGRESS: "in_progress", PAY_NOTHING: "nothing", PAY_TOO_SMALL: "nothing",
    PAY_AMOUNT: "amount", PAY_DEST: "invalid", STORE_STOCK: "stock", STORE_GONE: "gone", STORE_NO_SHIP: "no_ship",
    STORE_CITY: "city", STORE_ADDRESS: "address", STORE_NAME: "name", STORE_PHONE: "phone", STORE_EMAIL: "email",
    STORE_FULFIL: "fulfil", STORE_EMPTY: "empty", STORE_ITEM: "invalid", WALLET_SHORT: "wallet_short",
    WALLET_NOT_OPEN: "not_open", LOCKER_TAKEN: "locker_taken", LOCKERS_FULL: "lockers_full", LOCKER_LIMIT: "locker_limit",
    LOCKER_NOT_OPEN: "not_open", LOCKER_OUT: "locker_taken", LOCKER_PICK: "invalid", LOCKER_PAY: "invalid",
  };
  const error = map[code] ?? "generic";
  return { error, status: error === "signin" ? 401 : error === "generic" ? 502 : 409 };
}

/** The variant a stock refusal names (STORE_STOCK: <uuid>), so the cart can mark that line. */
export const refusedVariant = (msg: string) => /:\s*([0-9a-f-]{36})/.exec(msg ?? "")?.[1] ?? null;

export const LANGS = /^[a-z]{2}$/;
export const langOf = (v: unknown) => (typeof v === "string" && LANGS.test(v) ? v : null);
