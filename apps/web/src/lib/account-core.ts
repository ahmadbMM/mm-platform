// Signing in on micromobility.sa with a Micromobility (booking app) account - the parts that are
// plain logic, kept apart from the cookie and network code so they can be tested.
//
// The session is the account's own booking-app session: customer_login hands back the account's
// live token (it reuses it, so signing in here signs nobody out elsewhere), and the site keeps
// it in an HttpOnly cookie that page scripts cannot read. Signing out here only forgets the
// cookie - clearing the token would sign the rider out of the booking app on every device.

export const ACCOUNT_COOKIE = "mm_acct";
export const ACCOUNT_MAX_AGE = 30 * 24 * 3600;
/** A sign-in with a password staff issued (a temporary one: must_change_pwd) is not a session yet:
 *  it is held in this cookie - HttpOnly too, sent to the account routes only, for ten minutes -
 *  while the rider chooses their own password (api/account/password), as the booking app asks
 *  before anything else (_pwdMustCheck). */
export const PENDING_COOKIE = "mm_pwd";
export const PENDING_MAX_AGE = 600;
export const PENDING_PATH = "/api/account";

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

type Answer = { status: number; data: unknown; message: string };

/** customer_pwd_state's answer (lib/account.ts rpcServer's shape): true when the account's
 *  password is a temporary one to replace; false when it is not, or when the database has no such
 *  function (a sign-in is never held by a function that is not there, as in the booking app);
 *  null when it could not be asked. */
export function mustChange(r: Pick<Answer, "status" | "data">): boolean | null {
  if (r.status === 0 || r.status >= 500) return null;
  return r.status < 300 && r.data === true;
}

/** customer_set_own_password's answer: the session token it hands back (the old one stops
 *  working), or why not - the same password as the temporary one, one the password rule refuses,
 *  a held sign-in whose session ended (sign in again), nothing to change any more (staff cleared
 *  the mark meanwhile: the held session stands), or no answer. */
export type PwdAnswer = { token: string } | { error: "same" | "weak" | "expired" | "done" | "generic" };
export function pwdAnswer(r: Answer): PwdAnswer {
  if (/SAME_PASSWORD/.test(r.message)) return { error: "same" };
  if (/WEAK_PASSWORD/.test(r.message)) return { error: "weak" };
  if (/BAD_TOKEN/.test(r.message)) return { error: "expired" };
  if (/NO_CHANGE_DUE/.test(r.message)) return { error: "done" };
  if (r.status >= 200 && r.status < 300 && typeof r.data === "string" && /^[A-Za-z0-9_-]{16,200}$/.test(r.data)) return { token: r.data };
  return { error: "generic" };
}
