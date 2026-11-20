// My Account > Notifications and its Updates page, as the booking app has them (its Account > Notifications, 2026-11-13,
// new features build F3; rider-updates.js). Kept apart from the pages so it can be tested:
//   - Ride news, the rider's own yes or no to WhatsApp ride news (customer_consents' ride_news, the app's toggleRideNews);
//   - Updates: every message the app addressed to this rider, newest first, kept 90 days (customer_updates, rentals
//     20261114080300), each with where a tap leads. Reading the list marks every row read, so the count of unread ones
//     (customer_updates_unread) is what the menu's rows say, and the page shows a dot on the rows that were unread.
// The push switches stay out: the app hides them until a VAPID key is set, and push is dormant.
import { ACC_PAGES } from "./account-menu";

export type UpdKind = "reminder" | "change" | "waitlist" | "challenge" | "recap" | "note" | "info";
const KINDS: readonly UpdKind[] = ["reminder", "change", "waitlist", "challenge", "recap", "note", "info"];
export type UpdRow = { id: number; kind: UpdKind; title: string; body: string; at: string; url: string; unread: boolean };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const S = (v: unknown) => (typeof v === "string" ? v : "");

/** customer_updates' answer ({ok: true, rows}) as the page lists it; null for anything else (a refusal, no answer). */
export function updatesOf(raw: unknown): UpdRow[] | null {
  if (!isObj(raw) || raw.ok !== true || !Array.isArray(raw.rows)) return null;
  return raw.rows.filter(isObj).map((r, i) => ({
    id: Number.isFinite(Number(r.id)) ? Number(r.id) : -(i + 1),
    kind: (KINDS as readonly string[]).includes(S(r.kind)) ? (r.kind as UpdKind) : "info",
    title: S(r.title).trim(), body: S(r.body).trim(), at: S(r.at), url: S(r.url).trim(), unread: r.unread === true,
  }));
}

/** customer_updates_unread's count ({ok: true, n}); null when it did not answer (no row then, as the app hides it). */
export function unreadOf(raw: unknown): number | null {
  if (!isObj(raw) || raw.ok !== true) return null;
  const n = Number(raw.n);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** customer_consents' ride-news answer: true or false, or null when it is not one (the switch is then not shown: a
 *  switch never shows a state that is not stored, the app's rule). */
export function rideNewsOf(raw: unknown): boolean | null {
  return isObj(raw) && typeof raw.ride_news === "boolean" ? raw.ride_news : null;
}

/** The booking app's volunteer portal: a row that leads there opens it in a new tab (the app's VOL_PORTAL). */
export const VOL_PORTAL = "https://volunteer.micromobility.sa";
const CLAIM = /^[0-9a-f]{32}$/;

/** Where a row leads on this site (the app's _inbWhere, its own pages turned into the website's): a freed waitlist place
 *  (/?claim=, the site's own claim card), Bookings (/my-bookings), the account (/account and its pages), the Community
 *  (/members; the club page, unless staff hid it), Reserve (the app's first page: Experiences), the volunteer portal (a
 *  new tab), or nowhere. Addresses of the app's own sites (any micromobility.sa) or relative ones only. */
export type UpdWhere = { to: "claim" | "bookings" | "account" | "community" | "reserve" | "vol"; href: string } | null;
export function updateWhere(url: string, o: { club: boolean }): UpdWhere {
  const s = String(url || "").trim();
  if (!s) return null;
  if (s === VOL_PORTAL || s.startsWith(`${VOL_PORTAL}/`)) return { to: "vol", href: s };
  let u: URL;
  try { u = new URL(s, "https://experiences.micromobility.sa"); } catch { return null; }
  if (u.protocol !== "https:" || !/(^|\.)micromobility\.sa$/.test(u.hostname) || u.hostname.startsWith("volunteer.")) return null;
  const claim = (u.searchParams.get("claim") || "").toLowerCase();
  if (CLAIM.test(claim)) return { to: "claim", href: `/?claim=${claim}` };
  const seg = u.pathname.toLowerCase().split("/").filter(Boolean);
  if (!seg.length || (seg[0] === "reserve" && seg.length === 1)) return { to: "reserve", href: "/experiences" };
  if (seg[0] === "my-bookings" && seg.length === 1) return { to: "bookings", href: "/bookings" };
  if (seg[0] === "account" && seg.length <= 2) {
    const sub = seg[1];
    const known = !!sub && (sub === "stats" || sub === "badges" || (ACC_PAGES as readonly string[]).includes(sub));
    return { to: "account", href: known ? `/account/${sub}` : "/account" };
  }
  if (seg[0] === "members" && seg.length === 1) return o.club ? { to: "community", href: "/club" } : null;
  return null;
}

/** The app's language for a list said in the page's language: the eleven it speaks, else English (as _updates_text). */
export const updLang = (locale: string): string => (["en", "ar", "fr", "es", "pt", "ur", "hi", "tl", "ne", "bn", "ms"].includes(locale) ? locale : "en");
