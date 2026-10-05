import { intlOf } from "@/i18n/locales";

// Dates a component writes in the visitor's browser (a ride's day, "member since", a ledger line)
// in the page's language. A browser cannot always do that itself: Chromium carries no Nepali at all
// (it writes "Mon, Oct 5"), and browsers word some languages differently from the server ("अक्टू॰" /
// "अक्तू॰"), which also breaks a page drawn on the server when the browser draws it again. So the
// server, which has every language, describes how the page's language writes a date with the given
// options - its parts in order, the words between them, the month and weekday names, AM and PM -
// and the browser only puts the numbers in: datePattern() on the server, passed to the component,
// fmtPattern() in the browser. The time zones are UTC (a day written YYYY-MM-DD) and Riyadh's,
// which keeps UTC+3 all year.

type Part = "year" | "month" | "day" | "weekday" | "hour" | "minute" | "dayPeriod";
export type DatePart = { t: "lit"; v: string } | { t: Part; pad?: true };
export type DatePattern = {
  parts: DatePart[];
  months: string[];
  weekdays: string[];
  /** AM / PM as written at each hour of the day, 0 to 23. */
  periods: string[];
  hc: "h11" | "h12" | "h23" | "h24";
  /** Minutes ahead of UTC. */
  offset: number;
};

/** The ways the site's browser-side components write a date; their pages make the pattern. */
export const DATE_STYLES = {
  /** A ride's day on the Club page: "Saturday 10 October". */
  rideDay: { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" },
  /** A day the Workshop form offers: "Sat 10 Oct". */
  workshopDay: { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" },
  /** A Club member's "member since": "October 2026". */
  memberSince: { month: "long", year: "numeric", timeZone: "Asia/Riyadh" },
  /** A line of an ambassador's points: "5 Oct 2026". */
  ledgerDay: { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Riyadh" },
  /** When a workshop job is booked for: "Mon 5 Oct, 17:00". */
  booked: { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Riyadh" },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

const OFFSET: Record<string, number> = { UTC: 0, "Asia/Riyadh": 180 };
const PARTS: readonly string[] = ["year", "month", "day", "weekday", "hour", "minute", "dayPeriod"];

/** How the page's language writes a date with these options (weekday, day, month, year, hour,
 *  minute; timeZone UTC or Asia/Riyadh). Made on the server. */
export function datePattern(locale: string, o: Intl.DateTimeFormatOptions): DatePattern {
  const f = new Intl.DateTimeFormat(intlOf(locale), { ...o, timeZone: "UTC" });
  // The narrow no-break space newer ICU puts before "г." or "PM" is a plain space in what format()
  // writes (V8 changes it back for older pages' sake), so the pattern writes it the same way.
  const sp = (s: string) => s.replace(/ /g, " ");
  // 3 February 2001, 04:05: single digits show whether the language pads a number ("05" or "5").
  const at = (month: number, day: number, hour = 4) => new Date(Date.UTC(2001, month, day, hour, 5));
  const parts: DatePart[] = f.formatToParts(at(1, 3)).map((p) => (PARTS.includes(p.type)
    ? { t: p.type as Part, ...(/^0\d/.test(p.value) ? { pad: true as const } : {}) }
    : { t: "lit", v: sp(p.value) }));
  const word = (d: Date, type: Part) => sp(f.formatToParts(d).find((p) => p.type === type)?.value ?? "");
  const has = (type: Part) => parts.some((p) => p.t === type);
  return {
    parts,
    months: has("month") ? Array.from({ length: 12 }, (_, i) => word(at(i, 3), "month")) : [],
    // 7 January 2001 was a Sunday, so the names come in getUTCDay() order.
    weekdays: has("weekday") ? Array.from({ length: 7 }, (_, i) => word(at(0, 7 + i), "weekday")) : [],
    periods: has("dayPeriod") ? Array.from({ length: 24 }, (_, h) => word(at(1, 3, h), "dayPeriod")) : [],
    hc: f.resolvedOptions().hourCycle ?? "h23",
    offset: OFFSET[o.timeZone ?? "UTC"] ?? 0,
  };
}

/** A day ("2026-10-05", read as that day), a moment (an ISO timestamp, a Date or milliseconds)
 *  written the way the pattern says; "" for something that is not a date. */
export function fmtPattern(p: DatePattern, when: string | number | Date): string {
  const ms = when instanceof Date ? when.getTime() : typeof when === "number" ? when
    : Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(when) ? `${when}T00:00:00Z` : when);
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms + p.offset * 60000);
  const h = d.getUTCHours();
  const num = (n: number, pad?: true) => (pad ? String(n).padStart(2, "0") : String(n));
  return p.parts.map((x) => {
    switch (x.t) {
      case "lit": return x.v;
      case "year": return String(d.getUTCFullYear());
      case "month": return p.months[d.getUTCMonth()] ?? "";
      case "day": return num(d.getUTCDate(), x.pad);
      case "weekday": return p.weekdays[d.getUTCDay()] ?? "";
      case "hour": return num(p.hc === "h12" ? h % 12 || 12 : p.hc === "h11" ? h % 12 : p.hc === "h24" ? h || 24 : h, x.pad);
      case "minute": return num(d.getUTCMinutes(), x.pad);
      case "dayPeriod": return p.periods[h] ?? "";
    }
  }).join("");
}
