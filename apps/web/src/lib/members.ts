import { siteSchema } from "@/content/pages/site";
import type { ItemField } from "@/content/types";
import { fieldValue, type Locale } from "./content";

// The members' area on /club (components/club/MembersArea.tsx): what member_area hands a signed-in
// community member - membership and since when, credits and tier, rides done and the last five,
// the upcoming members' rides, their own birthday, the announcements. Members never see each
// other here: nothing in the answer names another person. The plain logic, so it can be tested.

export type MemberRide = { date: string; title: string; kind: string | null; rated: boolean };
export type MemberUpcoming = { id: string; date: string; title: string; kind: string | null; time: string | null; booked: boolean };
export type MemberArea =
  | { ok: true; member: false; firstName: string }
  | { ok: true; member: true; firstName: string; since: string | null; credits: number; tier: 0 | 1 | 2; next: number | null; rides: number; groupRides: number; last: MemberRide[]; upcoming: MemberUpcoming[]; birthDate: string | null; announcements: unknown }
  /** signin: the cookie's session is not accepted · unavailable: the database does not have the function yet, or answered nothing usable. */
  | { ok: false; error: "signin" | "unavailable" };

const S = (v: unknown) => (typeof v === "string" ? v : "");
const N = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);
const DATE = /^\d{4}-\d{2}-\d{2}/;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

/** What the function's answer means (lib/account.ts rpcServer's shape). */
export function memberArea(r: { status: number; data: unknown; message: string }): MemberArea {
  if (r.status === 0 || r.status === 404 || r.status >= 500 || /PGRST202/.test(r.message)) return { ok: false, error: "unavailable" };
  const d = r.data && typeof r.data === "object" ? (r.data as Record<string, unknown>) : null;
  if (!d || d.ok !== true) return { ok: false, error: d?.error === "denied" ? "signin" : "unavailable" };
  const firstName = S(d.first_name).trim();
  if (d.member !== true) return { ok: true, member: false, firstName };
  const tier = d.tier === 1 || d.tier === 2 ? d.tier : 0;
  const last: MemberRide[] = (Array.isArray(d.last) ? d.last : [])
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && DATE.test(S(x.date)))
    .map((x) => ({ date: S(x.date).slice(0, 10), title: S(x.title).trim(), kind: S(x.kind) || null, rated: x.rated === true }))
    .slice(0, 5);
  const upcoming: MemberUpcoming[] = (Array.isArray(d.upcoming) ? d.upcoming : [])
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && ID.test(S(x.id)) && DATE.test(S(x.date)))
    .map((x) => ({ id: S(x.id), date: S(x.date).slice(0, 10), title: S(x.title).trim(), kind: S(x.kind) || null, time: S(x.time).trim() || null, booked: x.booked === true }))
    .slice(0, 8);
  return {
    ok: true, member: true, firstName,
    since: S(d.since) || null,
    credits: Math.max(0, Math.round(N(d.credits) ?? 0)),
    tier, next: N(d.next),
    rides: Math.max(0, Math.round(N(d.rides) ?? 0)), groupRides: Math.max(0, Math.round(N(d.group_rides) ?? 0)),
    last, upcoming,
    birthDate: DATE.test(S(d.birth_date)) ? S(d.birth_date).slice(0, 10) : null,
    announcements: d.announcements,
  };
}

/** Whether the birthday falls today (both "YYYY-MM-DD"; today in Riyadh). Someone born on 29
 *  February is greeted on the 28th in a year that has no 29th. */
export function isBirthday(birthDate: string | null, today: string): boolean {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return false;
  const day = birthDate.slice(5, 10), y = Number(today.slice(0, 4));
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return (day === "02-29" && !leap ? "02-28" : day) === today.slice(5, 10);
}

/** The announcements as the announcement bar reads them (site.announce.messages, the raw list
 *  value), in the page's language: text, link text and link. */
export function announcementsOf(raw: unknown, locale: Locale): { text: string; cta: string; href: string }[] {
  const section = siteSchema.sections.find((s) => s.id === "announce");
  const list = section?.fields.find((f) => f.id === "messages");
  if (!list || list.type !== "list" || !Array.isArray(raw)) return [];
  const item = list.item as readonly ItemField[];
  const F = (id: string, row: Record<string, unknown>) => {
    const f = item.find((x) => x.id === id);
    return f ? String(fieldValue(f, row[id], locale)) : "";
  };
  return (raw as unknown[])
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => ({ text: F("text", x), cta: F("cta", x), href: F("href", x) }))
    .filter((a) => a.text.trim())
    .slice(0, list.maxItems);
}
