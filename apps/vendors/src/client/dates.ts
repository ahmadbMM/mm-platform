// Date helpers for the portal, all on plain "YYYY-MM-DD" strings (the database's dates are
// Riyadh calendar days, never instants), computed in UTC so no time zone can shift a day.
// Pure: tested in test/dates.test.ts.

import type { Lang } from "./strings";

export type Iso = string;

const pad = (n: number) => String(n).padStart(2, "0");

export function toIso(d: Date): Iso {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function fromIso(s: Iso): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function isIso(s: unknown): s is Iso {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return toIso(fromIso(s)) === s;
}

export function addDays(s: Iso, n: number): Iso {
  const d = fromIso(s);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
}

export function daysBetween(a: Iso, b: Iso): number {
  return Math.round((fromIso(b).getTime() - fromIso(a).getTime()) / 86400000);
}

/** The first day of the month that s falls in, and of the month n months on. */
export function monthStart(s: Iso): Iso {
  return s.slice(0, 8) + "01";
}
export function addMonths(s: Iso, n: number): Iso {
  const d = fromIso(monthStart(s));
  d.setUTCMonth(d.getUTCMonth() + n);
  return toIso(d);
}
export function monthEnd(s: Iso): Iso {
  return addDays(addMonths(s, 1), -1);
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekday(s: Iso): number {
  return fromIso(s).getUTCDay();
}

/**
 * The month as weeks of seven, Sunday first. Days outside the month are null, so a grid can
 * leave those cells empty. Always whole weeks: 4 to 6 rows.
 */
export function monthGrid(anyDayInMonth: Iso): (Iso | null)[][] {
  const first = monthStart(anyDayInMonth);
  const last = monthEnd(anyDayInMonth);
  const weeks: (Iso | null)[][] = [];
  let week: (Iso | null)[] = Array(weekday(first)).fill(null);
  for (let d = first; d <= last; d = addDays(d, 1)) {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length) { while (week.length < 7) week.push(null); weeks.push(week); }
  return weeks;
}

/** The first and last day a month grid shows (for the calendar call). */
export function monthRange(anyDayInMonth: Iso): { from: Iso; to: Iso } {
  return { from: monthStart(anyDayInMonth), to: monthEnd(anyDayInMonth) };
}

const LOCALE: Record<Lang, string> = { en: "en-GB", ar: "ar-SA" };

/** A locale tag with Western digits, in the Gregorian or the Umm al-Qura calendar. */
export function localeTag(lang: Lang, hijri = false): string {
  return `${LOCALE[lang]}-u-${hijri ? "ca-islamic-umalqura-" : "ca-gregory-"}nu-latn`;
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function dtf(tag: string, o: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const k = tag + JSON.stringify(o);
  let f = fmtCache.get(k);
  if (!f) { f = new Intl.DateTimeFormat(tag, { ...o, timeZone: "UTC" }); fmtCache.set(k, f); }
  return f;
}

/** "14 Rabi I" style: the Umm al-Qura day and month of a date, for a cell's secondary line. */
export function hijriLabel(s: Iso, lang: Lang): string {
  return dtf(localeTag(lang, true), { day: "numeric", month: "short" }).format(fromIso(s));
}

/** The Hijri day of the month alone, as a number. */
export function hijriDay(s: Iso): number {
  const parts = dtf(localeTag("en", true), { day: "numeric" }).formatToParts(fromIso(s));
  return Number(parts.find((p) => p.type === "day")?.value || 0);
}

/** "Saturday 10 October 2026" (or the Arabic), Western digits. */
export function longDate(s: Iso, lang: Lang): string {
  return dtf(localeTag(lang), { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(fromIso(s));
}
/** "Sat 10 Oct". */
export function shortDate(s: Iso, lang: Lang): string {
  return dtf(localeTag(lang), { weekday: "short", day: "numeric", month: "short" }).format(fromIso(s));
}
/** "October 2026". */
export function monthTitle(s: Iso, lang: Lang): string {
  return dtf(localeTag(lang), { month: "long", year: "numeric" }).format(fromIso(s));
}
/** Two Hijri months a Gregorian month spans: "Rabi I - Rabi II 1448". */
export function hijriMonthTitle(s: Iso, lang: Lang): string {
  const f = dtf(localeTag(lang, true), { month: "long", year: "numeric" });
  const a = f.format(fromIso(monthStart(s)));
  const b = f.format(fromIso(monthEnd(s)));
  return a === b ? a : `${a} - ${b}`;
}

/** Western digits for any number, in either language. */
export function num(n: number, lang: Lang): string {
  return new Intl.NumberFormat(`${LOCALE[lang]}-u-nu-latn`).format(n);
}

/** Moving the keyboard focus in the grid: arrows by a day or a week, mirrored in Arabic. */
export function arrowStep(key: string, rtl: boolean): number {
  switch (key) {
    case "ArrowLeft": return rtl ? 1 : -1;
    case "ArrowRight": return rtl ? -1 : 1;
    case "ArrowUp": return -7;
    case "ArrowDown": return 7;
    default: return 0;
  }
}

export type Ordinal = 1 | 2 | 3 | 4 | -1;

export type Pattern = { ordinal: Ordinal; interval: 1 | 2 | 3; from: Iso; until: Iso };

/** The arguments vendor_preview / vendor_request take for the sentence "Every [n] Saturday...". */
export function patternArgs(p: Pattern): { p_mode: "recurring"; p_ordinal: number; p_interval: number; p_from: Iso; p_until: Iso } {
  return { p_mode: "recurring", p_ordinal: p.ordinal, p_interval: p.interval, p_from: p.from, p_until: p.until };
}

/** A pattern sentence is complete and sensible: dates real, until not before from. */
export function patternValid(p: Pattern): boolean {
  return [1, 2, 3, 4, -1].includes(p.ordinal) && [1, 2, 3].includes(p.interval) && isIso(p.from) && isIso(p.until) && p.until >= p.from;
}

/** [from, to] cut into consecutive pieces whose two ends are at most `max` days apart (vendor_calendar
 *  answers BAD_RANGE past 400), in order; nothing when to is before from. */
export function spans(from: Iso, to: Iso, max: number): [Iso, Iso][] {
  const out: [Iso, Iso][] = [];
  for (let a = from; a <= to; ) {
    const end = addDays(a, Math.max(0, max));
    const b = end < to ? end : to;
    out.push([a, b]);
    a = addDays(b, 1);
  }
  return out;
}

/** The default "until" of a new pattern: today plus the plan's horizon. */
export function defaultUntil(today: Iso, horizonDays: number): Iso {
  return addDays(today, horizonDays);
}

/** The Saturdays a pattern names (as the database's _vendor_pattern_days), for showing locally. */
export function patternDays(p: Pattern): Iso[] {
  const out: Iso[] = [];
  for (let m = monthStart(p.from), i = 0; m <= p.until && i < 61; m = addMonths(m, p.interval), i++) {
    let d: Iso;
    if (p.ordinal === -1) {
      const end = monthEnd(m);
      d = addDays(end, -((weekday(end) - 6 + 7) % 7));
    } else {
      d = addDays(m, ((6 - weekday(m) + 7) % 7) + (p.ordinal - 1) * 7);
    }
    if (d >= p.from && d <= p.until) out.push(d);
  }
  return out;
}
