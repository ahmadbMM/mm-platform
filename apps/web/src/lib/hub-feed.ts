import { intlOf } from "@/i18n/locales";
import { monthName } from "./member-hub";

// The booking app's Community tab read, hub_feed (rentals migrations 20261111100000, 20261114000100, 20261114081900), as
// /club reads it for a signed-in member (app/[locale]/club/page.tsx, lib/member-hub-server.ts readHubFeed) and the cards
// it feeds draw it (components/club/HubCards.tsx, ChallengeCard.tsx, YearCard.tsx): the member's own monthly challenge
// with its level pick, the staff season challenges (the Ramadan challenge and the Eid ride among them), the club's goal
// with the member's own share, the Saturday report (its photo through hub_post_img), the open call for volunteers and,
// in December and January, the year. Plain logic, so it can be tested.
//
// Members see nobody (the owner, 2026-11-04) and customers see no head counts (2026-11-13): hub_feed also sends `numbers`
// (riders and rides last Saturday, this month, since the start), `going` (each session's riders), the report's riders,
// rides, first rides, leads and volunteers, and the year's club total. None of them is read here, so no page can show
// one. `announce` is left too: /club shows the announcements from member_area already; `awarded` and `birthday` likewise
// (a badge given shows on My Account; the birthday greeting is member_area's).

const S = (v: unknown) => (typeof v === "string" ? v : "");
const N = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ymd = (v: unknown) => { const s = S(v).slice(0, 10); return DAY.test(s) ? s : ""; };
const ID = /^[A-Za-z0-9_-]{1,64}$/;

/** The month's own challenge (hub_feed.me): first, second, back, or a level of sessions; `levels` the choices a level
 *  challenge offers until one is `chosen`; n the member's sessions this month; endsOn its last day. */
export type HubMe = { kind: "first" | "second" | "back" | "level"; levels: number[]; target: number; chosen: boolean; n: number; endsOn: string };
/** A staff season challenge running now (hub_feed.goals): its names, target, the member's own count, its last day, and
 *  the badge it gives (drawn as its medal) when it has one. */
export type HubSeasonGoal = { id: string; name: string; nameAr: string; target: number; n: number; endsOn: string; badge: { icon: string; color: string } | null };
/** The club's goal (hub_feed.club): its name (none: the month's own Saturday goal, named by its target), the target, the
 *  club's count, the member's own share, its last day and, once reached early, the next Saturday's own target (R20). */
export type HubClubGoal = { name: string; nameAr: string; target: number; n: number; mine: number; endsOn: string; next: { date: string; target: number } | null };
/** The Saturday report showing now (hub_feed.post): its ride's day, the staff line, whether it has a photo, and the
 *  member's own Saturday rides that month when they rode it (null otherwise). */
export type HubPost = { id: string; date: string; line: string; lineAr: string; img: boolean; mine: number | null };
/** The year (hub_feed.year, December and January only): the member's own counts alone. */
export type HubYear = { year: number; full: boolean; sessions: number; saturdays: number; satsHeld: number; first: string; kinds: string[]; busiest: string; badges: number; clubFirst: string };
export type HubFeed = { today: string; me: HubMe | null; goals: HubSeasonGoal[]; club: HubClubGoal | null; post: HubPost | null; volunteer: string | null; year: HubYear | null };

const KINDS = new Set(["first", "second", "back", "level"]);

/** hub_feed's answer, read (lib/account.ts rpcServer's shape); null for a refusal (not a member, a session it does not
 *  take), a database without it, or no answer: then none of its cards is drawn. */
export function hubFeedOf(r: { status: number; data: unknown }): HubFeed | null {
  const d = r.status === 200 ? obj(r.data) : null;
  if (!d || d.ok !== true) return null;
  const m = obj(d.me);
  const me: HubMe | null = m && KINDS.has(S(m.kind)) ? {
    kind: S(m.kind) as HubMe["kind"],
    levels: (Array.isArray(m.levels) ? m.levels : []).map(N).filter((x) => Number.isInteger(x) && x > 0 && x < 100).slice(0, 6),
    target: Math.max(1, Math.round(N(m.target)) || 1), chosen: m.chosen === true, n: Math.max(0, Math.round(N(m.n))), endsOn: ymd(m.ends_on),
  } : null;
  const goals = (Array.isArray(d.goals) ? d.goals : []).map(obj).filter((g): g is Record<string, unknown> => !!g && !!(S(g.name).trim() || S(g.name_ar).trim()))
    .map((g): HubSeasonGoal => {
      const b = obj(g.badge);
      return {
        id: S(g.id) || String(N(g.id) || ""), name: S(g.name).trim(), nameAr: S(g.name_ar).trim(), target: Math.max(1, Math.round(N(g.target)) || 1),
        n: Math.max(0, Math.round(N(g.n))), endsOn: ymd(g.ends_on), badge: b && S(b.icon) ? { icon: S(b.icon), color: S(b.color) || "green" } : null,
      };
    }).slice(0, 6);
  const c = obj(d.club);
  const nx = c ? obj(c.next) : null;
  const club: HubClubGoal | null = c && N(c.target) > 0 ? {
    name: S(c.name).trim(), nameAr: S(c.name_ar).trim(), target: Math.round(N(c.target)), n: Math.max(0, Math.round(N(c.n))), mine: Math.max(0, Math.round(N(c.mine))),
    endsOn: ymd(c.ends_on), next: nx && ymd(nx.date) && N(nx.target) > 0 ? { date: ymd(nx.date), target: Math.round(N(nx.target)) } : null,
  } : null;
  const p = obj(d.post);
  const pid = p ? S(p.id) || (N(p.id) ? String(N(p.id)) : "") : "";
  const post: HubPost | null = p && ID.test(pid) ? {
    id: pid, date: ymd(p.date), line: S(p.line).trim(), lineAr: S(p.line_ar).trim(), img: p.img === true, mine: p.mine != null && N(p.mine) > 0 ? Math.round(N(p.mine)) : null,
  } : null;
  const vol = S(d.volunteer);
  const y = obj(d.year);
  const year: HubYear | null = y && N(y.year) > 2000 && N(y.sessions) > 0 ? {
    year: Math.round(N(y.year)), full: y.full === true, sessions: Math.round(N(y.sessions)), saturdays: Math.max(0, Math.round(N(y.saturdays))),
    satsHeld: Math.max(0, Math.round(N(y.sats_held))), first: ymd(y.first),
    kinds: [...new Set((Array.isArray(y.kinds) ? y.kinds : []).map(S).filter(Boolean).map((k) => (k === "rental" ? "jcc" : k)))],
    busiest: /^\d{4}-\d{2}$/.test(S(y.busiest).slice(0, 7)) ? S(y.busiest).slice(0, 7) : "", badges: Math.max(0, Math.round(N(y.badges))), clubFirst: ymd(y.club_first),
  } : null;
  return { today: ymd(d.today), me, goals, club, post, volunteer: ID.test(vol) ? vol : null, year };
}

/** A day as the Community tab writes one (the booking app's shortDate: "30 Nov 2026"); "" for none. */
export function hubDay(d: string, locale: string): string {
  if (!DAY.test(d)) return "";
  try { return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : intlOf(locale), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`)); }
  catch { return d; }
}

/** The pick of a level challenge shows until the member picks (the app's _meHtml): a level challenge not chosen, not
 *  done, with its choices. */
export const pickShown = (me: HubMe) => me.kind === "level" && !me.chosen && me.n < me.target && me.levels.length > 0;

/** The club goal's line (the app's _clubHtml): reached; else "so far" while less than two thirds is done, then what is left. */
export function clubLine(g: HubClubGoal): { k: "hit" } | { k: "soFar" | "toGo"; n: number } {
  if (g.n >= g.target) return { k: "hit" };
  return g.n / g.target < 2 / 3 ? { k: "soFar", n: g.n } : { k: "toGo", n: g.target - g.n };
}

/** The tip of the week (the app's _staffHtml): one of twelve, by the week the server's day falls in. */
export const HUB_TIPS = 12;
export function tipOf(today: string): number {
  const t = Date.parse(`${today}T00:00:00Z`);
  return Math.floor((Number.isFinite(t) ? t : Date.now()) / 6048e5) % HUB_TIPS;
}

/** The recap for a ride just finished (the app's _heroHtml `recap`): with nothing booked ahead, the Saturday report of
 *  the member's own last ride leads the page, on its day and the day after (Riyadh). `last`: the day of the member's
 *  latest finished booking, "" for none; `ahead`: a booking still to come or under way. */
export function recapLeads(post: HubPost | null, last: string, ahead: boolean, now: number): boolean {
  if (!post || !post.date || ahead || post.date !== last) return false;
  return post.date >= new Date(now + 108e5 - 864e5).toISOString().slice(0, 10);
}

/** The latest day of the account's finished bookings (my_bookings rows), and whether one is still to come or under way. */
export function lastAndAhead(rows: Record<string, unknown>[], today: string): { last: string; ahead: boolean } {
  let last = "", ahead = false;
  for (const r of rows) {
    const d = ymd(r.session_date) || ymd(r.session_id);
    if (!d) continue;
    if (r.status === "done" && d <= today && d > last) last = d;
    if ((r.status === "waiting" || r.status === "active") && d >= today) ahead = true;
  }
  return { last, ahead };
}

/** "{month} to December" for a first year that began after January (the app's _yrRange): the month the club first rode. */
export function yearFrom(y: HubYear, locale: string): string {
  return /^\d{4}-(0[2-9]|1[0-2])/.test(y.clubFirst) ? monthName(y.clubFirst, locale) : "";
}

/** The volunteer portal opened on that call (the app's VOL_PORTAL + '/#o/' + the session). */
export const VOL_PORTAL = "https://volunteer.micromobility.sa";
export const volunteerHref = (id: string) => `${VOL_PORTAL}/#o/${encodeURIComponent(id)}`;

/** The friend's invitation as the booking app writes it (_invText): the form's address with the member's code and the
 *  page's language, put into the language's invMsg. */
export function inviteText(msg: string, code: string, locale: string): string {
  return msg.replace("{0}", `https://micromobility.sa/community/registration?inv=${encodeURIComponent(code)}&lang=${encodeURIComponent(locale)}`);
}
/** member_invite_code's answer: the member's own code, or null. */
export function inviteCodeOf(r: { status: number; data: unknown }): string | null {
  const d = r.status === 200 ? obj(r.data) : null;
  const c = d && d.ok === true ? S(d.code) : "";
  return /^[A-Za-z0-9_-]{3,40}$/.test(c) ? c : null;
}
