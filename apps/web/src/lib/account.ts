import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies } from "next/headers";
import { ACCOUNT_COOKIE, decodeSession, type BookingRow, type Session } from "./account-core";
import { sessionGender, type GenderViewer } from "./session-gender";
import { clientIp } from "./sign-in-guard";

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
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json", ...visitorHeaders(VISITORS.get(args)) },
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

const VISITORS = new WeakMap<object, Request>();

/** rpcServer's arguments for a function the database meters per address (_ip_gate: customer_set_referrer ...), sent on
 *  behalf of the visitor whose request this is: `rpcServer(fn, forVisitor(req, { ... }))`. The database counts the
 *  address Cloudflare saw, and for a call from this Worker that is Cloudflare's own, so every rider of the site shared
 *  one meter: 30 friend's codes in 10 minutes, from a busy hour or one account trying codes, and every rider's code read
 *  "not found". With the site's key (the Worker secret MM_SITE_KEY) the call names the visitor's address
 *  (x-mm-visitor-ip, as Cloudflare saw it), which the database counts in place of its own once it holds the same key; it
 *  ignores the address without it. No key, or no address (a local run): nothing is added, as before. */
export function forVisitor(req: Request, args: Record<string, unknown>): Record<string, unknown> {
  VISITORS.set(args, req);
  return args;
}

function visitorHeaders(from?: Request): Record<string, string> {
  const ip = from ? clientIp(from).trim().slice(0, 60) : "";
  if (!ip) return {};
  let site = "";
  try { const v = (getCloudflareContext().env as { MM_SITE_KEY?: unknown }).MM_SITE_KEY; if (typeof v === "string") site = v; } catch { /* not on the Worker */ }
  site = site || process.env.MM_SITE_KEY || "";
  return site ? { "x-mm-visitor-ip": ip, "x-mm-site-key": site } : {};
}

/** The signed-in account, or null: no cookie, a malformed one, or a session the booking app no
 *  longer accepts. Only a request that carries the cookie costs a database call. Alongside it the
 *  account is stamped as seen on the website (customer_seen, booking app 20261011120000: staff's
 *  "last opened" in the account report); the database keeps one stamp every 5 minutes and ignores a
 *  wrong token. The two calls go together, so a page waits only for the slower (4 s at most). */
export async function getAccount(): Promise<Account | null> {
  const a = await readAccount();
  return a === "unread" ? null : a;
}

/** getAccount for the account page, which tells the two nulls apart: a session the booking app refused (null: an
 *  answer with no row) is signed in again, while one that could not be checked just now ("unread": a timeout, a
 *  network error, the database answering an error) is said so - the sign-in form told a rider who is signed in that
 *  they were not. */
export async function readAccount(): Promise<Account | null | "unread"> {
  const s = decodeSession((await cookies()).get(ACCOUNT_COOKIE)?.value);
  if (!s) return null;
  const [r] = await Promise.all([
    rpcServer<({ name?: string; email?: string; phone?: string } & Record<string, unknown>)[]>("customer_profile", { p_id: s.id, p_token: s.token }),
    rpcServer<null>("customer_seen", { p_id: s.id, p_token: s.token, p_via: "web" }),
  ]);
  if (r.status !== 200) return "unread";
  const p = Array.isArray(r.data) ? r.data[0] : null;
  return p ? { ...s, name: p.name || "", email: p.email || "", phone: p.phone || "", profile: p } : null;
}

/** The account's bookings, or null when they could not be read (a timeout, a network error, the database answering an
 *  error): never taken for an account with none, which the account page would say it is. */
export async function readBookings(a: Session): Promise<BookingRow[] | null> {
  const r = await rpcServer<BookingRow[]>("my_bookings", { p_id: a.id, p_token: a.token });
  return r.status === 200 && Array.isArray(r.data) ? r.data : null;
}

/** The account's bookings; none when they could not be read (the pop-ups' checks then ask nothing). */
export async function accountBookings(a: Session): Promise<BookingRow[]> {
  return (await readBookings(a)) ?? [];
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

/** Is the visitor a signed-in community member? The booking app's own members' gate (community_member, which checks the
 *  token), asked only when the request carries the account's cookie; any failure reads as no. Experiences shows the
 *  members-only cards' and dates' links by it (the owner, 2026-10-05), and Experiences and Events a Farm House Night
 *  (lib/farm.ts farmForMembers, 2026-11-13). A signed-in visitor's page is never kept at the edge (lib/page-cache.ts). */
export async function communityMember(): Promise<boolean> {
  const s = decodeSession((await cookies()).get(ACCOUNT_COOKIE)?.value);
  if (!s) return false;
  const r = await rpcServer<boolean>("community_member", { p_id: s.id, p_token: s.token });
  return r.data === true;
}
