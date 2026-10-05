// Which days and times a customer can ask the workshop for. Everything starts from the clock in
// Riyadh when the page was made ("YYYY-MM-DDTHH:MM"), passed down from the server, so the server
// and the browser draw the same list and tests can pin the time.

// Made once: every page asks for the clock (the footer's opening hours), and a formatter costs
// several times more to make than to use - CPU the Worker is short of (DEPLOY.md, "Limits").
let riyadh: Intl.DateTimeFormat | null = null;

export function riyadhClock(d: Date): string {
  riyadh ??= new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const p = Object.fromEntries(riyadh.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

const toMin = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));

/** The times still open on a day: every time on a later day; today, only those an hour or more ahead. */
export function timesFor(day: string, now: string, times: string[]): string[] {
  if (day !== now.slice(0, 10)) return times;
  const soonest = toMin(now.slice(11, 16)) + 60;
  return times.filter((t) => toMin(t) >= soonest);
}

/** The next `days` open days as YYYY-MM-DD. Fridays are left out when the shop closes on Friday,
 *  and today only while a time (or, with no times listed, an hour before closing) is still ahead. */
export function dayOptions(now: string, days: number, fridayClosed: boolean, times: string[], closeHour: number): string[] {
  const [y, m, d] = now.slice(0, 10).split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; out.length < days && i < days + 7; i++) {
    const day = new Date(Date.UTC(y, m - 1, d + i));
    if (fridayClosed && day.getUTCDay() === 5) continue;
    const iso = day.toISOString().slice(0, 10);
    if (i === 0 && (times.length ? timesFor(iso, now, times).length === 0 : toMin(now.slice(11, 16)) + 60 > closeHour * 60)) continue;
    out.push(iso);
  }
  return out;
}
