import { intlOf } from "@/i18n/locales";
import type { L } from "@/i18n/tx";
import { fill } from "./fill";
import type { SiteContent } from "./site";
import { fmtClock } from "./tickets";

// The booking window (site_content 'booking.window' = {"days": N, "at": "HH:MM"}, Riyadh time; set
// by admins on the booking app's Sessions): a rider may not book a session more than N days
// ahead, and on the day a session comes within reach it opens at the hour given. The database
// refuses a booking that jumps the window (_booking_window_guard, NOT_OPEN_YET), so the site's
// lists grey such a date out - never hide it - and say when it opens. No window, or a malformed
// one, holds nobody. The arithmetic is exactly the database's:
//   openDay = session_date - days; not open if openDay > today, or openDay == today and now < at.

export type BookingWindow = { days: number; at: string | null };

const HM = /^(\d{1,2}):(\d{2})$/;

/** The window as staff saved it, or null for none (missing, null, malformed). */
export function bookingWindow(v: unknown): BookingWindow | null {
  if (!v || typeof v !== "object") return null;
  const o = v as { days?: unknown; at?: unknown };
  const days = typeof o.days === "number" ? o.days : typeof o.days === "string" && o.days.trim() ? Number(o.days) : NaN;
  if (!Number.isInteger(days) || days < 0 || days > 3650) return null;
  let at: string | null = null;
  if (typeof o.at === "string" && o.at.trim()) {
    const m = HM.exec(o.at.trim());
    if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
    at = `${m[1].padStart(2, "0")}:${m[2]}`;
  }
  return { days, at };
}

/** The site's window, read with the rest of the staff content. */
export const siteBookingWindow = (content: SiteContent | null): BookingWindow | null => bookingWindow(content?.["booking.window"]);

/** The day (YYYY-MM-DD) booking opens for a session, and the hour on that day (null = from midnight). */
export function opensOn(sessionDate: string, w: BookingWindow): { day: string; at: string | null } {
  const [y, m, d] = sessionDate.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d - w.days)).toISOString().slice(0, 10);
  return { day, at: w.at };
}

/** Whether the session cannot be booked yet at `now` (Riyadh, "YYYY-MM-DDTHH:MM"). */
export function notOpenYet(sessionDate: string, w: BookingWindow | null, now: string): boolean {
  if (!w || !/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) return false;
  const { day, at } = opensOn(sessionDate, w);
  const today = now.slice(0, 10), hm = now.slice(11, 16);
  if (day > today) return true;
  return day === today && at !== null && hm < at;
}

/** "Booking opens Sun 5 Oct" / "Booking opens Sun 5 Oct at 9 AM", in the page's language. */
export function opensText(sessionDate: string, w: BookingWindow, locale: string, tx: L): string {
  const o = opensOn(sessionDate, w);
  const date = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : intlOf(locale), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${o.day}T00:00:00Z`));
  return o.at
    ? fill(tx("Booking opens {date} at {time}", "يبدأ الحجز {date} في {time}"), { date, time: fmtClock(o.at, locale) })
    : fill(tx("Booking opens {date}", "يبدأ الحجز {date}"), { date });
}
