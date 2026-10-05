import { rpcServer } from "./account";
import type { Session } from "./account-core";

// The booking app's hand-back (app/api/account/handoff) and the account page's question when it
// would replace another account (app/[locale]/account/page.tsx). A one-time code is anyone's to pass
// on: opened from a link, it used to sign that browser into the account it was made for, replacing
// the account already signed in there without a word - and whatever was entered next went to
// someone else's account. With another account signed in, the session handed over now waits in a
// cookie of its own until the rider chooses; with none, the rider is signed in as before and the
// account page says as whom.

/** The session a hand-back brought while another account was signed in: kept aside, five minutes,
 *  until the rider says which account this browser keeps. */
export const HANDOFF_COOKIE = "mm_acct_next";
export const HANDOFF_MAX_AGE = 300;

/** A Set-Cookie line, as the account cookie has always been written: the whole site, HttpOnly, Secure, Lax. */
export const cookieLine = (name: string, value: string, maxAge: number) => `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;

export type Profile = { name: string; email: string; phone: string };
const S = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** The account a session signs in as (customer_profile), "none" when the database refuses the
 *  session or has no such account, or null when it did not answer - which never counts as signed
 *  out, so a failed call cannot replace an account unasked. */
export async function sessionProfile(s: Session): Promise<Profile | "none" | null> {
  const r = await rpcServer<Record<string, unknown>[]>("customer_profile", { p_id: s.id, p_token: s.token });
  if (r.status === 0 || r.status >= 500) return null;
  const p = Array.isArray(r.data) ? r.data[0] : null;
  return p ? { name: S(p.name), email: S(p.email), phone: S(p.phone) } : "none";
}

/** How the account page names an account: its name and its email (or mobile), as it has them. */
export const accountLabel = (p: Profile): string => [p.name, p.email || p.phone].filter(Boolean).join(" · ");
