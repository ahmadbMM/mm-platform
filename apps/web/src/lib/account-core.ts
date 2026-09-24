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

export type BookingRow = { id?: unknown; session_id?: unknown; session_date?: unknown; status?: unknown; name?: unknown; type_preference?: unknown; size?: unknown };
export type Booking = { sessionId: string; date: string; riders: { name: string; type: string; size: string; status: "booked" | "waitlist" | "riding" }[] };

/** The account's bookings still ahead (today, Riyadh, and later), one entry per session, soonest
 *  first. Cancelled, finished and removed rows are left out; queue numbers are not shown here -
 *  the booking app decides when a ride's queue is public. */
export function upcomingBookings(rows: BookingRow[], today: string): Booking[] {
  const S = (v: unknown) => (typeof v === "string" ? v : "");
  const by = new Map<string, Booking>();
  for (const r of rows) {
    const status = r.status === "waiting" ? "booked" : r.status === "waitlist" ? "waitlist" : r.status === "active" ? "riding" : null;
    const date = S(r.session_date);
    if (!status || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today) continue;
    const sid = S(r.session_id) || date;
    const b = by.get(sid) ?? { sessionId: sid, date, riders: [] };
    b.riders.push({ name: S(r.name), type: S(r.type_preference), size: S(r.size), status });
    by.set(sid, b);
  }
  return [...by.values()].sort((a, b) => a.date.localeCompare(b.date) || a.sessionId.localeCompare(b.sessionId));
}

/** Only this site's own pages may ask to sign in or out (a plain same-origin check). */
export function sameOrigin(origin: string | null, requestUrl: string): boolean {
  try { return !!origin && origin === new URL(requestUrl).origin; } catch { return false; }
}
