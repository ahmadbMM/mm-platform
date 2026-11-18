// The date step's calendar, as the booking app's Reserve has it since 2026-11-16 (the user: "add a calendar view in
// reserve section for customers"; app.src.html _rcOn, _rcDay, _rcPlan, _rcLong, _rcMonthHtml, _rcMove, _rcKey): an event's
// dates as a month beside the list. Two days or more among them (counted before the kind switch narrows them) offer a
// List / Calendar switch, the choice kept on the device. The month's days with dates are buttons carrying a mark per
// kind; tapping one shows that day's dates under the month, drawn as the list draws them, and never picks one. The day
// shown is the one tapped, else the picked date's, else the first; the arrows go to the month before or after that has
// dates. Plain logic here, so it can be tested: components/experiences/ExperienceSteps.tsx draws it.
import { intlOf } from "@/i18n/locales";
import type { Held } from "./held";

export type CalView = "list" | "cal";
/** Where the view is kept on the device (the booking app keeps its own as cq_reg_view). */
export const CAL_VIEW_KEY = "mm_xs_view";

/** The view kept on this device: the calendar once chosen, else the list (also when storage cannot be read). */
export function calViewRead(): CalView {
  try {
    return localStorage.getItem(CAL_VIEW_KEY) === "cal" ? "cal" : "list";
  } catch {
    return "list";
  }
}
/** Keeps the view on this device; without storage it lasts this visit. */
export function calViewSave(v: CalView): void {
  try {
    localStorage.setItem(CAL_VIEW_KEY, v);
  } catch { /* kept for this visit only */ }
}

/** Today in Riyadh (UTC+3 all year), YYYY-MM-DD: the day ringed, and the days before it muted. */
export const calToday = (now: number = Date.now()): string => new Date(now + 3 * 3600e3).toISOString().slice(0, 10);

type Dated = { id: string; date?: string };
/** A date's day, YYYY-MM-DD: its own date, else the first ten characters of its id (the booking app's _rcDay). */
export const calDayOf = (s: Dated): string => String(s.date || s.id).slice(0, 10);

/** Whether the calendar is offered: two days or more among the dates. */
export const calOffered = (sessions: readonly Dated[]): boolean => new Set(sessions.map(calDayOf)).size > 1;

/** The calendar's month and the day under it (the booking app's _rcPlan): the dates by day, their days in order, the day
 *  shown (the one tapped while it has dates, else the picked date's day, else the first), the picked date's day ("" when
 *  none of these is picked) and the dates of the day shown, in the order given. Null for no dates. */
export type CalPlan<T> = { by: Map<string, T[]>; days: string[]; day: string; picked: string; list: T[] };
export function calPlan<T extends Dated>(list: readonly T[], tapped: string | null, pickedId: string | null): CalPlan<T> | null {
  if (!list.length) return null;
  const by = new Map<string, T[]>();
  for (const s of list) {
    const d = calDayOf(s);
    by.set(d, [...(by.get(d) ?? []), s]);
  }
  const days = [...by.keys()].sort();
  const p = pickedId == null ? undefined : list.find((x) => x.id === pickedId);
  const picked = p ? calDayOf(p) : "";
  const day = tapped && by.has(tapped) ? tapped : picked || days[0];
  return { by, days, day, picked, list: by.get(day) ?? [] };
}

/** The months that have dates, YYYY-MM, in order. */
export const calMonths = (days: readonly string[]): string[] => [...new Set(days.map((d) => d.slice(0, 7)))];

/** The day an arrow lands on (the booking app's _rcMove): the first day with dates of the month that has dates `f` months
 *  on from `day`'s (-1 the one before), or null at the ends. */
export function calMove(days: readonly string[], day: string, f: number): string | null {
  const ms = calMonths(days), to = ms[ms.indexOf(day.slice(0, 7)) + f];
  return to ? days.find((d) => d.startsWith(to)) ?? null : null;
}

/** A month (YYYY-MM) as its grid: the blanks before its first day, weeks starting on Sunday as in Saudi Arabia, and its
 *  days, YYYY-MM-DD. */
export function calMonth(ym: string): { lead: number; days: string[] } {
  const [y, m] = ym.split("-").map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { lead: new Date(Date.UTC(y, m - 1, 1)).getUTCDay(), days: Array.from({ length: n }, (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`) };
}

const fmt = (locale: string, o: Intl.DateTimeFormatOptions, d: Date): string => {
  try {
    return new Intl.DateTimeFormat(intlOf(locale), { ...o, timeZone: "UTC" }).format(d);
  } catch {
    return "";
  }
};
/** The month's title, "November 2099", in the page's language and the Gregorian calendar. */
export const calTitle = (ym: string, locale: string): string => {
  const [y, m] = ym.split("-").map(Number);
  return fmt(locale, { month: "long", year: "numeric" }, new Date(Date.UTC(y, m - 1, 15, 12))) || ym;
};
/** The week's days by their narrow names, Sunday first. */
export const calWeekdays = (locale: string): string[] => Array.from({ length: 7 }, (_, i) => fmt(locale, { weekday: "narrow" }, new Date(Date.UTC(2024, 0, 7 + i, 12))));
/** A day in full for a screen reader, "Saturday 14 November" (the booking app's _rcLong). */
export const calLong = (iso: string, locale: string): string => fmt(locale, { weekday: "long", day: "numeric", month: "long" }, new Date(`${iso}T12:00:00Z`)) || iso;

/** A day's name for a screen reader: the day, its dates' names, and the visitor's own place there (Booked, On the waitlist,
 *  Reserved) or, when every date of it is closed as fully booked, Fully booked. */
export function calDayLabel(iso: string, locale: string, list: readonly { name: string; held?: Held; fbk?: string }[], w: { held: Record<Held, string>; fbk: string }): string {
  const h = list.map((s) => s.held).find(Boolean);
  const fb = list.length > 0 && list.every((s) => !!s.fbk);
  return [calLong(iso, locale), [...new Set(list.map((s) => s.name))].join(", "), h ? w.held[h] : fb ? w.fbk : ""].filter(Boolean).join(" · ");
}

/** Where a key takes the focus among a month's days with dates, `days` in order (the booking app's _rcKey): the next or
 *  the one before (Right and Left, mirrored right to left), a week on or back (Down and Up: the nearest date that far or
 *  further), the first and the last (Home, End). Null when it stays; undefined for a key it does not take. */
export function calKey(days: readonly string[], from: string, key: string, rtl: boolean): string | null | undefined {
  const i = days.indexOf(from), dn = (d: string) => Number(d.slice(8, 10)), d = dn(from);
  let to: string | undefined;
  if (key === "ArrowRight" || key === "ArrowLeft") to = i < 0 ? undefined : days[i + ((key === "ArrowRight") !== rtl ? 1 : -1)];
  else if (key === "ArrowDown") to = days.find((x) => dn(x) >= d + 7);
  else if (key === "ArrowUp") to = days.filter((x) => dn(x) <= d - 7).pop();
  else if (key === "Home") to = days[0];
  else if (key === "End") to = days[days.length - 1];
  else return undefined;
  return to && to !== from ? to : null;
}
