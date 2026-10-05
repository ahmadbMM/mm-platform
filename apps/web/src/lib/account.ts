import { cookies } from "next/headers";
import { ACCOUNT_COOKIE, decodeSession, type BookingRow, type Session } from "./account-core";

// The signed-in account on the server: the cookie set by /api/account, checked against the
// booking app's own session (customer_profile), and the account's bookings (my_bookings).

export type Account = Session & { name: string; email: string; phone: string;
  /** The rest of customer_profile's row, for Race Ready (lib/ride-record.ts profilePct). */
  profile?: Record<string, unknown> };

/** A database call from the server with the public key. A refusal keeps its message (the
 *  exception's name: phone_taken, RATE_LIMITED...), PostgREST's code (PGRST202: no such function, a
 *  migration not applied yet) and, in `details`, its detail and hint (which field a BAD_INPUT is about). */
export async function rpcServer<T>(fn: string, args: Record<string, unknown>): Promise<{ status: number; data: T | null; message: string; code?: string; details?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { status: 0, data: null, message: "" };
  try {
    const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    const body = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
      const b = (body ?? {}) as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
      return { status: res.status, data: null, message: String(b.message ?? ""), code: String(b.code ?? ""), details: [b.details, b.hint].filter((x) => typeof x === "string" && x).join(" ") };
    }
    return { status: res.status, data: body as T, message: "" };
  } catch {
    return { status: 0, data: null, message: "" };
  }
}

/** The signed-in account, or null: no cookie, a malformed one, or a session the booking app no
 *  longer accepts. Only a request that carries the cookie costs a database call. */
export async function getAccount(): Promise<Account | null> {
  const s = decodeSession((await cookies()).get(ACCOUNT_COOKIE)?.value);
  if (!s) return null;
  const r = await rpcServer<({ name?: string; email?: string; phone?: string } & Record<string, unknown>)[]>("customer_profile", { p_id: s.id, p_token: s.token });
  const p = Array.isArray(r.data) ? r.data[0] : null;
  return p ? { ...s, name: p.name || "", email: p.email || "", phone: p.phone || "", profile: p } : null;
}

export async function accountBookings(a: Session): Promise<BookingRow[]> {
  const r = await rpcServer<BookingRow[]>("my_bookings", { p_id: a.id, p_token: a.token });
  return Array.isArray(r.data) ? r.data : [];
}
