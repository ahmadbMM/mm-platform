// The birthday week (the user, 2026-11-15: "in birthday week of the customer make the screen throw confetti from the
// top to the bottom of the page everytime he opens the website"). Their picks that day: the week is the three days
// before the birthday, the day and the three after (Saudi dates, the birthday in the middle), with a "Happy birthday,
// {name}!" line; the booking app does the same (app.src.html _bdfxOn / _bdfx). api/account/birthday answers with it,
// components/account/BirthdayConfetti.tsx plays it.

/** Days either side of the birthday. */
export const BDFX_SPAN = 3;

/** Today in Riyadh, YYYY-MM-DD (Saudi Arabia keeps UTC+3 all year). */
export const riyadhDay = (now = new Date()): string => new Date(now.getTime() + 3 * 3600e3).toISOString().slice(0, 10);

/** Whether `today` (YYYY-MM-DD, Riyadh) is in the week of a birthday `birth` (YYYY-MM-DD). The birthday of the year
 *  before and after counts too (30 December is in the week of a 2 January birthday); a 29 February birthday is kept on
 *  28 February in a common year, as the booking app's Community > Birthdays keeps it. */
export function inBirthdayWeek(birth: unknown, today: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(birth ?? ""));
  if (!m) return false;
  const bm = +m[2], bd = +m[3], t0 = Date.parse(`${today}T00:00:00Z`);
  if (bm < 1 || bm > 12 || bd < 1 || bd > 31 || Number.isNaN(t0)) return false;
  const ty = +today.slice(0, 4);
  return [ty - 1, ty, ty + 1].some((y) => {
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    return Math.abs(Date.UTC(y, bm - 1, bm === 2 && bd === 29 && !leap ? 28 : bd) - t0) <= BDFX_SPAN * 864e5;
  });
}

/** The first word of an account's name, for the line ("Happy birthday, Rana!"); "" for none. */
export function firstName(name: unknown): string {
  return String(name ?? "").trim().split(/\s+/)[0]?.slice(0, 40) || "";
}
