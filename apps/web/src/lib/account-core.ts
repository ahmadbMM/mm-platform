// Signing in on micromobility.sa with a Micromobility (booking app) account - the parts that are
// plain logic, kept apart from the cookie and network code so they can be tested.
//
// The session is the account's own booking-app session: customer_login hands back the account's
// live token (it reuses it, so signing in here signs nobody out elsewhere), and the site keeps
// it in an HttpOnly cookie that page scripts cannot read. Signing out here only forgets the
// cookie - clearing the token would sign the rider out of the booking app on every device.

export const ACCOUNT_COOKIE = "mm_acct";
export const ACCOUNT_MAX_AGE = 30 * 24 * 3600;

export type Session = { id: string; token: string };

export function encodeSession(s: Session): string {
  return `${encodeURIComponent(s.id)}~${s.token}`;
}

export function decodeSession(v: string | undefined | null): Session | null {
  if (!v) return null;
  const i = v.lastIndexOf("~");
  if (i <= 0) return null;
  let id = "";
  try { id = decodeURIComponent(v.slice(0, i)); } catch { return null; }
  const token = v.slice(i + 1);
  return id.length <= 100 && /^[A-Za-z0-9_-]{16,200}$/.test(token) ? { id, token } : null;
}

/** A queue_entries row as the account's own my_bookings returns it (the whole row). My Account
 *  reads it as the booking app's ticket (lib/tickets.ts). */
export type BookingRow = Record<string, unknown>;

/** Only this site's own pages may ask to sign in or out (a plain same-origin check). */
export function sameOrigin(origin: string | null, requestUrl: string): boolean {
  try { return !!origin && origin === new URL(requestUrl).origin; } catch { return false; }
}

/** The Set-Cookie value that keeps a session (or, with "" and 0, forgets it). */
export const sessionCookie = (value: string, maxAge: number = ACCOUNT_MAX_AGE) =>
  `${ACCOUNT_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
