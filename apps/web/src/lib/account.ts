import { cookies } from "next/headers";
import { ACCOUNT_COOKIE, decodeSession, type BookingRow, type Session } from "./account-core";
import { sessionGender, type GenderViewer } from "./session-gender";

// The signed-in account on the server: the cookie set by /api/account, checked against the
// booking app's own session (customer_profile), and the account's bookings (my_bookings).

export type Account = Session & { name: string; email: string; phone: string;
  /** The rest of customer_profile's row, for Race Ready (lib/ride-record.ts profilePct). */
  profile?: Record<string, unknown> };

/** A database call from the server. A refusal keeps PostgREST's message, its code (PGRST202: no
 *  such function, a migration not applied yet) and its details (BAD_INPUT's em_self ...). */
export async function rpcServer<T>(fn: string, args: Record<string, unknown>, timeoutMs = 4000): Promise<{ status: number; data: T | null; message: string; code?: string; details?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { status: 0, data: null, message: "" };
  try {
    const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
      const b = body as { message?: unknown; code?: unknown; details?: unknown } | null;
      return { status: res.status, data: null, message: String(b?.message ?? ""), code: String(b?.code ?? ""), details: String(b?.details ?? "") };
    }
    return { status: res.status, data: body as T, message: "" };
  } catch {
    return { status: 0, data: null, message: "" };
  }
}

/** The signed-in account, or null: no cookie, a malformed one, or a session the booking app no
 *  longer accepts. Only a request that carries the cookie costs a database call. Alongside it the
 *  account is stamped as seen on the website (customer_seen, booking app 20261011120000: staff's
 *  "last opened" in the account report); the database keeps one stamp every 5 minutes and ignores a
 *  wrong token. The two calls go together, so a page waits only for the slower (4 s at most). */
export async function getAccount(): Promise<Account | null> {
  const s = decodeSession((await cookies()).get(ACCOUNT_COOKIE)?.value);
  if (!s) return null;
  const [r] = await Promise.all([
    rpcServer<({ name?: string; email?: string; phone?: string } & Record<string, unknown>)[]>("customer_profile", { p_id: s.id, p_token: s.token }),
    rpcServer<null>("customer_seen", { p_id: s.id, p_token: s.token, p_via: "web" }),
  ]);
  const p = Array.isArray(r.data) ? r.data[0] : null;
  return p ? { ...s, name: p.name || "", email: p.email || "", phone: p.phone || "", profile: p } : null;
}

export async function accountBookings(a: Session): Promise<BookingRow[]> {
  const r = await rpcServer<BookingRow[]>("my_bookings", { p_id: a.id, p_token: a.token });
  return Array.isArray(r.data) ? r.data : [];
}

/** Who is looking at a men-only or women-only session (lib/session-gender.ts): the signed-in account's gender
 *  (customer_profile, which checks the token; null when none is on file), so a page says "This session is for
 *  women only." to an account of the other gender in place of the button that hands the booking over. Every
 *  visitor sees every such session (the owner, 2026-10-28); this only decides who reads the refusal. Null when
 *  the request carries no account, or one whose profile could not be read (a token the booking app no longer
 *  accepts, a failed call): the button then stays, and the booking app signs the visitor in and judges the
 *  booking. Only a request with the cookie costs a call, and a signed-in visitor's page is never kept at the
 *  edge (lib/page-cache.ts). */
export async function genderViewer(): Promise<GenderViewer> {
  const s = decodeSession((await cookies()).get(ACCOUNT_COOKIE)?.value);
  if (!s) return null;
  const p = await rpcServer<{ gender?: unknown }[]>("customer_profile", { p_id: s.id, p_token: s.token });
  const row = Array.isArray(p.data) ? p.data[0] : null;
  return row ? { gender: sessionGender(row.gender) } : null;
}
