// Referrals on My Account (the booking app's Invite friends card, 2026-11-08, rentals migration 20261108160000): the
// rider's own code and how many friends joined, rode and earned them a free ride (customer_referral), never a friend's
// name. A friend who makes an account with the link and completes a paid ride at the circuit earns the rider a free
// ride; the free rides are redeemed in the booking app, beside its other free ride codes. Since rentals 20261108200000 the
// friend gets their own code too: pct off their own bike on their first ride (welcome), also used in the booking app.
import { BOOKING_URL } from "./links";

/** The friend's own code (customer_referral's welcome, rentals 20261108200000): RW-..., pct off their own bike, until its last day. */
export type ReferralWelcome = { code: string; expiresAt: string; pct: number };
export type Referral = { code: string; joined: number; rode: number; earned: number; open: number; referred: boolean; canEnter: boolean;
  /** the friend's discount in percent (Settings, 50 when the database does not say) */
  pct: number;
  /** how long a free ride lasts, in days (Settings ref_days, 30 when the database does not say) */
  days: number;
  /** the account's own friend's code while it can be used: not used, not past its last day (KSA); else null */
  welcome: ReferralWelcome | null };

/** customer_referral's answer, or null when no card is drawn: a database without it, referrals switched off, no code. */
export function referralOf(data: unknown, today: string): Referral | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  if (d.ok !== true || d.on !== true || typeof d.code !== "string" || !/^[A-Z0-9]{4,12}$/.test(d.code)) return null;
  const n = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));
  // a free ride still to use: not used, and not past its last day (KSA)
  const open = (Array.isArray(d.rewards) ? d.rewards : []).filter((r) => {
    const x = (r ?? {}) as Record<string, unknown>;
    return x.used !== true && typeof x.code === "string" && String(x.expires_at ?? "") >= today;
  }).length;
  const pct = Number(d.pct) >= 5 && Number(d.pct) <= 100 ? Math.round(Number(d.pct)) : 50;
  const days = Number(d.days) >= 7 && Number(d.days) <= 365 ? Math.round(Number(d.days)) : 30;
  const w = d.welcome && typeof d.welcome === "object" && !Array.isArray(d.welcome) ? (d.welcome as Record<string, unknown>) : null;
  const wDay = String(w?.expires_at ?? "").slice(0, 10);
  const welcome = w && typeof w.code === "string" && /^RW-[A-Z0-9-]{4,40}$/.test(w.code) && w.used !== true && /^\d{4}-\d{2}-\d{2}$/.test(wDay) && wDay >= today
    ? { code: w.code, expiresAt: wDay, pct: Number(w.pct) >= 5 && Number(w.pct) <= 100 ? Math.round(Number(w.pct)) : pct } : null;
  return { code: d.code, joined: n(d.joined), rode: n(d.rode), earned: n(d.earned), open, referred: d.referred === true, canEnter: d.can_enter === true, pct, days, welcome };
}

/** The friends who rode with the account's invite, for the Recruiter badge (whether or not referrals are switched on);
 *  null for anything else. */
export function referralRodeOf(data: unknown): number | null {
  const d = data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
  const n = d && d.ok === true ? Number(d.rode) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

/** The link a rider shares: the booking app's Create account page carrying their code, in their language. */
export function referralLink(code: string, locale: string): string {
  return `${BOOKING_URL}signup?ref=${encodeURIComponent(code)}&lang=${encodeURIComponent(locale)}`;
}

/** The body of POST /api/account/referrer: a friend's code as typed (the database reads a pasted link too). */
export function referrerBody(b: unknown): { code: string } | null {
  const c = b && typeof b === "object" ? (b as { code?: unknown }).code : null;
  if (typeof c !== "string") return null;
  const v = c.trim();
  return v && v.length <= 60 ? { code: v } : null;
}

/** customer_set_referrer's refusals, as the card names them; anything else reads as a code not found. */
export const REFERRER_REASONS = ["invalid", "self", "already", "not_new", "off"] as const;
export type ReferrerReason = (typeof REFERRER_REASONS)[number];
export function referrerReason(data: unknown): ReferrerReason | "ok" {
  const d = data && typeof data === "object" ? (data as { ok?: unknown; reason?: unknown }) : null;
  if (d?.ok === true) return "ok";
  return (REFERRER_REASONS as readonly string[]).includes(String(d?.reason)) ? (d!.reason as ReferrerReason) : "invalid";
}
