import type { BadgeRow } from "./ride-record";

// The Community tab's light read, hub_pulse (rentals migration 20261114000100, 2026-11-13), and what the post-ride
// rating's last screen makes of it (the booking app's _rgFinFor and _rgFinHtml, the Community tab reach build's R5).
// Plain logic with no imports the browser would carry, so it can be tested; app/api/account/rating-fin reads the
// database, components/account/RatingGate.tsx draws the screen.
//
// hub_pulse(p_id, p_token) answers {ok:false, error:'denied'} for a token it refuses, {ok:true, member:false} for an
// account that is not a Community member, and for a member {ok:true, member:true, dot, me, goals, fresh}: me the
// month's own challenge {kind: first | second | back | level, target, n, ends_on}, goals the season challenges running
// [{name, name_ar, target, n, ...}], fresh the Community badges the server gave and the member has not seen yet
// [{slug, at}], oldest first. hub_seen(p_id, p_token, p_slugs) marks badges seen. Nothing in either names another person.

export type HubMe = { kind: string; target: number; n: number; endsOn: string };
export type HubGoal = { name: string; nameAr: string; target: number; n: number };
export type HubPulse = { member: false } | { member: true; me: HubMe | null; goals: HubGoal[]; fresh: string[] };

const S = (v: unknown) => (typeof v === "string" ? v : "");
const N = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const SLUG = /^[a-z0-9_]{1,64}$/;

/** hub_pulse's answer, read; null when it refused the account or answered nothing readable. */
export function readPulse(raw: unknown): HubPulse | null {
  const d = obj(raw);
  if (!d || d.ok !== true) return null;
  if (d.member !== true) return { member: false };
  const m = obj(d.me);
  const me: HubMe | null = m && S(m.kind) ? { kind: S(m.kind), target: N(m.target), n: Math.max(0, N(m.n)), endsOn: S(m.ends_on).slice(0, 10) } : null;
  const goals = (Array.isArray(d.goals) ? d.goals : []).map(obj).filter((g): g is Record<string, unknown> => !!g)
    .map((g) => ({ name: S(g.name), nameAr: S(g.name_ar), target: N(g.target), n: Math.max(0, N(g.n)) }));
  const fresh = (Array.isArray(d.fresh) ? d.fresh : []).map((x) => S(obj(x)?.slug)).filter((s) => SLUG.test(s));
  return { member: true, me, goals, fresh };
}

/** The rating's last screen: a Community badge just earned (its name and how it is drawn), else the month's challenge
 *  the ride moved (its kind, for its name in the page's language), else the season challenge (its name). n is never
 *  above the target. */
export type Fin =
  | { k: "badge"; name: string; icon: string; color: string }
  | { k: "me"; kind: string; n: number; tg: number }
  | { k: "goal"; name: string; n: number; tg: number };

/** What the screen shows besides a badge: the month's challenge, once the member has a session in it and the ride
 *  rated is in its month; else the first season challenge with a session in it; else nothing. */
export function finProgress(p: HubPulse | null, rideDate: string, locale: string): Fin | null {
  if (!p || !p.member) return null;
  const me = p.me, ds = rideDate.slice(0, 7);
  if (me && me.kind && me.target > 0 && me.n > 0 && /^\d{4}-\d{2}$/.test(ds) && ds === me.endsOn.slice(0, 7)) return { k: "me", kind: me.kind, n: Math.min(me.n, me.target), tg: me.target };
  const g = p.goals[0];
  const name = g ? (locale === "ar" && g.nameAr) || g.name : "";
  if (g && g.target > 0 && g.n > 0 && name) return { k: "goal", name, n: Math.min(g.n, g.target), tg: g.target };
  return null;
}

/** A badge as the screen draws it, from the account's own badges and then the catalogue: the app's own badges (`sys`,
 *  lib/ride-record.ts BADGE_SYS) in their own words (`names`, RideRecord.text in the page's language) and drawing, any
 *  other by its name (Arabic on the Arabic page) and its icon and colour, as My Account's badges are. Null when neither
 *  list has it. */
export function finBadge(slug: string, lists: BadgeRow[][], names: Record<string, readonly string[]>, locale: string,
  sysOf: Record<string, readonly [string, string]> = {}): Extract<Fin, { k: "badge" }> | null {
  let row: BadgeRow | null = null;
  for (const l of lists) { row = l.find((b) => b && b.slug === slug) ?? null; if (row) break; }
  if (!row) return null;
  const own = row.system !== false, sys = sysOf[slug], word = names[slug];
  const [icon, color] = sys && own ? sys : [row.icon || "medal", row.color || "green"];
  const name = word && own ? word[0] : String((locale === "ar" && row.name_ar) || row.name || "");
  return name ? { k: "badge", name, icon, color } : null;
}

/** The challenge's name, as the Community tab names it (the booking app's _hpName). */
export function challengeName(kind: string, target: number, w: { first: string; second: string; back: string; level: string }): string {
  return kind === "first" ? w.first : kind === "second" ? w.second : kind === "back" ? w.back : w.level.replace("{0}", String(target));
}

/** Progress as the Community tab draws it (the booking app's _hpBar): a dot a session up to five, a bar above that.
 *  `plus`: a booking not yet ridden, an outlined dot (or a stretch of the bar) after the done ones. */
export type Marks = { dots: Array<"on" | "nx" | ""> } | { bar: { on: number; nx: number } };
export function hubMarks(n: number, tg: number, plus = false): Marks {
  const v = Math.min(Math.max(0, n), tg), x = plus && v < tg ? 1 : 0;
  if (tg <= 5) return { dots: Array.from({ length: tg }, (_, i) => (i < v ? "on" : i < v + x ? "nx" : "")) };
  return { bar: { on: (v / tg) * 100, nx: (x / tg) * 100 } };
}
