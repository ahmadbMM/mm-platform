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
  const code = r.status === 0 ? "" : refusal(r);
  const map: Record<string, string> = {
    NOT_AUTHORIZED: "signin", PAY_OFF: "pay_off", STORE_CLOSED: "pay_off", NOT_FOUND: "not_found",
    PAY_NOT_OPEN: "not_open", PAY_HOLD_MAX: "hold_max", PAY_IN_PROGRESS: "in_progress", PAY_NOTHING: "nothing", PAY_TOO_SMALL: "nothing",
    PAY_AMOUNT: "amount", PAY_DEST: "invalid", STORE_STOCK: "stock", STORE_GONE: "gone", STORE_NO_SHIP: "no_ship",
    STORE_CITY: "city", STORE_ADDRESS: "address", STORE_NAME: "name", STORE_PHONE: "phone", STORE_EMAIL: "email",
    STORE_FULFIL: "fulfil", STORE_EMPTY: "empty", STORE_ITEM: "invalid", WALLET_SHORT: "wallet_short",
    WALLET_NOT_OPEN: "not_open", LOCKER_TAKEN: "locker_taken", LOCKERS_FULL: "lockers_full", LOCKER_LIMIT: "locker_limit",
    LOCKER_NOT_OPEN: "not_open", LOCKER_OUT: "locker_taken", LOCKER_PICK: "invalid", LOCKER_PAY: "invalid",
    // the store build (2026-11-15, CONTRACTS.md section 6)
    STORE_LICENCE: "licence", STORE_PROMO: "promo", STORE_PROMO_MIN: "promo_min", STORE_PROMO_USED: "promo_used",
    STORE_GIFT: "gift", STORE_GIFT_ON_GIFT: "gift_on_gift", STORE_GIFT_EXPIRED: "gift_expired", STORE_DISTRICT: "district", STORE_SLOT: "slot", STORE_DIGITAL: "digital",
    STORE_BUSY: "busy", STORE_RETURN_WINDOW: "return_window", STORE_RETURN_OPEN: "return_open", STORE_RETURN_ITEMS: "return_items",
    STORE_REVIEW_STATE: "review_state", STORE_REVIEW_DONE: "review_done", STORE_REVIEW_ITEM: "review_item", STORE_REVIEW_RATING: "invalid",
    STORE_KIND: "invalid", STORE_BUNDLE: "invalid",
    // the product-management build (2026-11-19, CONTRACT.md section 5): over a product's limit per order, under the
    // store's smallest order
    STORE_MAX_QTY: "max_qty", STORE_MIN_ORDER: "min_order",
  };
  // A refusal the database named is read whatever the status: NOT_FOUND is raised with errcode P0002, which PostgREST
  // answers 500 (bug hunt 2026-11-11). Only a 5xx that names none is the way failing.
  if (r.status === 0 || (r.status >= 500 && !map[code])) return { error: "generic", status: 502 };
  const error = map[code] ?? "generic";
  return { error, status: error === "signin" ? 401 : error === "generic" ? 502 : error === "busy" ? 429 : 409 };
}

/** The variant a stock refusal names (STORE_STOCK: <uuid>), so the cart can mark that line. */
export const refusedVariant = (msg: string) => /:\s*([0-9a-f-]{36})/.exec(msg ?? "")?.[1] ?? null;

export const LANGS = /^[a-z]{2}$/;
export const langOf = (v: unknown) => (typeof v === "string" && LANGS.test(v) ? v : null);
