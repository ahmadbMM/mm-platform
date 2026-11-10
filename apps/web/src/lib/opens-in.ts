// How long until a session opens to book, said as a countdown once the opening is within a day (the
// research's row 3, 2026-11-10: "Booking opens in 2 h 10 min"; further away the date and time stay).
// It counts down to the real booking window (lib/booking-window.ts opensOn, the database's own rule),
// never a timer of its own. No imports, so a page's browser code can use it without the ticket helpers.

/** Riyadh's offset from UTC (no daylight saving). */
const RIYADH_MS = 3 * 3600e3;

/** The moment a day (YYYY-MM-DD) and time (HH:MM, or null for midnight) in Riyadh happens, as epoch ms. */
export function riyadhMs(day: string, at: string | null): number {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = (at ?? "00:00").split(":").map(Number);
  return Date.UTC(y, m - 1, d, hh, mm) - RIYADH_MS;
}

/** What is left until `openMs` at `nowMs` in whole minutes, rounded up (never "0 min"), as hours and minutes;
 *  null once it is open or while it is more than a day away. */
export function opensIn(openMs: number, nowMs: number): { h: number; m: number } | null {
  const left = openMs - nowMs;
  if (!(left > 0) || left > 24 * 3600e3) return null;
  const mins = Math.ceil(left / 60000);
  return { h: Math.floor(mins / 60), m: mins % 60 };
}

/** "2 h 10 min", "2 h", "45 min" in the page's words ({h} and {m} filled with Latin digits). */
export function durText(d: { h: number; m: number }, w: { hm: string; h: string; m: string }): string {
  const put = (s: string) => s.replace("{h}", String(d.h)).replace("{m}", String(d.m));
  return put(d.h === 0 ? w.m : d.m === 0 ? w.h : w.hm);
}
