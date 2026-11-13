import { intlOf } from "@/i18n/locales";
import type { RideKind } from "./rides";

// Two pieces of the booking app's Community tab in a member's area on /club (components/club/MembersArea.tsx), from the
// app's new features build (member-hub.js, 2026-11-13):
// - Plan my Saturdays (F10, _plan*): the current month's Saturdays as ticks. A tick books nothing and holds no place: it
//   tells the database the member plans to come (hub_plan / hub_plan_set, rentals 20261114081000, read and written only
//   by the member's own token), and the database sends one "booking is open" message when that Saturday's ride opens. A
//   Saturday already gone shows, locked. Ticks go through /api/account/plan (components/club/PlanSaturdays.tsx).
// - My month (F13, _mon*): from the 26th to the month's end, a member with two or more finished sessions that month sees
//   their own month: the Saturdays they rode, their sessions by kind, the badges they earned, and one comparison with
//   their own month before (hub_month, rentals 20261114081300). Every number is the member's own. The database decides
//   whether it shows (show false before site_content hub.month.from, before the 26th and under two sessions); the page
//   checks the same on what came back, as the app's _monOk does.
// A database without either function, a refusal or no answer: that piece is not drawn. The reads themselves are in
// lib/member-hub-server.ts: this module is the plain logic, which the browser's PlanSaturdays uses too.

const S = (v: unknown) => (typeof v === "string" ? v : "");
const DAY = /^\d{4}-\d\d-\d\d$/;
const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : null);
const count = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));
type Rpc = { status: number; data: unknown };

export type PlanDay = { date: string; on: boolean; past: boolean };
export type HubPlan = { month: string; days: PlanDay[] };

/** hub_plan's answer: the month ("YYYY-MM", "" when it did not say) and its Saturdays, a day before `today` (Riyadh)
 *  locked as gone whatever the answer said. null: no card. */
export function hubPlanOf(r: Rpc, today: string): HubPlan | null {
  const d = r.status === 200 ? obj(r.data) : null;
  if (!d || d.ok !== true || !Array.isArray(d.days)) return null;
  const days = d.days
    .map(obj)
    .filter((x): x is Record<string, unknown> => !!x && DAY.test(S(x.date)))
    .map((x) => ({ date: S(x.date), on: x.on === true, past: x.past === true || S(x.date) < today }));
  if (!days.length) return null;
  const month = (S(d.month) || days[0].date).slice(0, 7);
  return { month: /^\d{4}-\d\d$/.test(month) ? month : "", days };
}

/** Whether My month may show today (Riyadh's "YYYY-MM-DD"): the 26th to the month's end. hub_month is asked only then. */
export const monthDue = (today: string) => DAY.test(today) && Number(today.slice(8, 10)) >= 26;

// The kinds the site has a name and a mark for; a kind it does not know is left out of the list (the total still counts it).
const KNOWN: Record<RideKind, true> = {
  jcc: true, saturday: true, swim: true, workshop: true, petromin: true, snd96: true, event: true, runher: true, vlap: true,
  defe5k: true, arena: true, blood: true, yoga: true, farm: true,
};
const known = (k: string): k is RideKind => Object.prototype.hasOwnProperty.call(KNOWN, k);

export type HubMonth = {
  /** "YYYY-MM" */
  month: string;
  sessions: number; saturdays: number; badges: number;
  /** Sessions by kind, most first ('rental', the circuit, as jcc). */
  kinds: { k: RideKind; n: number }[];
  /** This month's sessions against the member's own month before ("YYYY-MM"); null when there is none of theirs. */
  prev: { month: string; x: number } | null;
};

/** hub_month's answer for `today` (Riyadh), when the card shows; else null. */
export function hubMonthOf(r: Rpc, today: string): HubMonth | null {
  const m = r.status === 200 ? obj(r.data) : null;
  if (!m || m.ok !== true || m.show !== true || !monthDue(today)) return null;
  const month = S(m.month).slice(0, 7), from = S(m.from);
  if (month !== today.slice(0, 7) || !DAY.test(from) || from > today || !(Number(m.sessions) >= 2)) return null;
  const sessions = count(m.sessions);
  const by = new Map<RideKind, number>();
  for (const x of Array.isArray(m.kinds) ? m.kinds.map(obj) : []) {
    const raw = x ? S(x.k) : "", k = raw === "rental" ? "jcc" : raw, n = x ? Math.floor(Number(x.n)) : 0;
    if (known(k) && n > 0) by.set(k, (by.get(k) ?? 0) + n);
  }
  const kinds = [...by].map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n || a.k.localeCompare(b.k));
  const p = obj(m.prev), ym = p ? S(p.month) : "";
  const prev = p && p.sessions != null && /^\d{4}-\d\d/.test(ym) && Number.isFinite(Number(p.sessions))
    ? { month: ym.slice(0, 7), x: sessions - count(p.sessions) } : null;
  return { month, sessions, saturdays: count(m.saturdays), badges: count(m.badges), kinds, prev };
}

/** A month's name in the page's language ("November", or "November 2026" with its year). */
export function monthName(ym: string, locale: string, withYear = false): string {
  try {
    return new Intl.DateTimeFormat(intlOf(locale), { month: "long", year: withYear ? "numeric" : undefined, timeZone: "UTC" }).format(new Date(`${ym.slice(0, 7)}-15T00:00:00Z`));
  } catch { return ym.slice(0, 7); }
}

/** What /api/account/plan answered a tap (null: no answer). */
export type PlanAnswer = { ok?: boolean; on?: boolean; error?: string } | null;
/** A tap's outcome (the app's _planTick): the database's answer stays; anything else turns the box back, said as
 *  failed, and a Saturday the database says is gone is locked too. */
export function planAfter<T extends PlanDay>(x: T, want: boolean, b: PlanAnswer): { day: T; failed: boolean } {
  if (b?.ok === true) return { day: { ...x, on: b.on === true }, failed: false };
  return { day: { ...x, on: !want, past: x.past || b?.error === "past" }, failed: true };
}

/** A Saturday as the page shows it: its day's number, and its whole date for a screen reader ("Saturday 7 November"). */
export type PlanBox = PlanDay & { n: string; label: string };
export function planBoxes(plan: HubPlan, locale: string): PlanBox[] {
  let fmt: Intl.DateTimeFormat | null = null;
  try { fmt = new Intl.DateTimeFormat(intlOf(locale), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }); } catch { /* the date as it is */ }
  return plan.days.map((x) => {
    let label = x.date;
    try { if (fmt) label = fmt.format(new Date(`${x.date}T12:00:00Z`)); } catch { /* the date as it is */ }
    return { ...x, n: String(Number(x.date.slice(8, 10))), label };
  });
}
