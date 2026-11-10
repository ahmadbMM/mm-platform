// "Add to calendar": the Worker serves the file (GET /cal/<session>.ics, src/worker/app.ts, from volunteer_me) as
// text/calendar, which an iPhone opens straight into its calendar; the page offers it beside a Google Calendar link built
// from the same times. Plain functions, no page: the Worker and the page share them. Riyadh keeps one offset all year
// (UTC+3), so a session's local times turn into UTC by taking three hours off.
//
// The volunteer's own reminders ride in the file (the owner's decision 4, 2026-11-11): a day before and two hours before,
// as the reminders in Updates are.

// gathers: the session's times are "gather - start" (i18n gathers()), not "start - end".
// ends_at: when the session ends, where the database knows it (volunteer_me, 20261111140000); it wins over the typed times.
export type CalEvent = { id: string; title: string; date: string; time: string | null; starts_at?: string | null; ends_at?: string | null;
  location: string | null; note?: string; gathers?: boolean };

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1");
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
/** "17:00" on a Riyadh date, as a moment. */
const at = (ymd: string, hm: string): Date | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const d = new Date(`${ymd}T${m[1].padStart(2, "0")}:${m[2]}:00+03:00`);
  return Number.isFinite(d.getTime()) ? d : null;
};
const moment = (v: string | null | undefined): Date | null => {
  const ms = v ? Date.parse(String(v).replace(/(\.\d{3})\d+/, "$1")) : NaN;
  return Number.isFinite(ms) ? new Date(ms) : null;
};

/** When the shift starts and ends, or null for a session with no time at all (a whole day). The end, in order: the end
 *  the database gives; the second typed time ("17:00 - 23:00"); for a ride that gathers, two hours after it sets off
 *  (its second time is the start of the ride, not the end of the shift); else three hours after the start. A session
 *  whose start the database knows is never turned into a whole day. */
export function shiftTimes(e: Pick<CalEvent, "date" | "time" | "starts_at" | "ends_at" | "gathers">): { start: Date; end: Date } | null {
  const ymd = String(e.date).slice(0, 10);
  const [a, b] = String(e.time ?? "").split(/\s*[-–]\s*/);
  const start = moment(e.starts_at) ?? (a ? at(ymd, a) : null);
  if (!start) return null;
  let end = moment(e.ends_at);
  if (end && end <= start) end = null;
  if (!end && b) {
    end = at(ymd, b);
    if (end && e.gathers) end = new Date(end.getTime() + 2 * 3600000);
    if (end && end <= start) end = new Date(end.getTime() + 86400000); // past midnight
  }
  if (!end) end = new Date(start.getTime() + 3 * 3600000);
  return { start, end };
}

/** A shift's start as a moment: its time, else the start of its day in Riyadh. */
export function startOf(e: Pick<CalEvent, "date" | "time" | "starts_at">): number {
  const tm = shiftTimes({ ...e, gathers: false });
  if (tm) return tm.start.getTime();
  return Date.parse(`${String(e.date).slice(0, 10)}T00:00:00+03:00`);
}

// RFC 5545: no line longer than 75 octets; a longer one goes on with a space at the start of the next.
const enc = new TextEncoder();
function fold(line: string): string {
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "", size = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (size + n > 75) { out.push(cur); cur = " "; size = 1; }
    cur += ch; size += n;
  }
  out.push(cur);
  return out.join("\r\n");
}

const allDay = (ymd: string) => [ymd.replace(/-/g, ""), new Date(Date.parse(`${ymd}T12:00:00Z`) + 86400000).toISOString().slice(0, 10).replace(/-/g, "")];
const pageOf = (id: string) => `https://volunteer.micromobility.sa/#o/${encodeURIComponent(id)}`;

/** The file's text: the shift, where to be, and the volunteer's two reminders. */
export function icsText(e: CalEvent, now = new Date()): string {
  const ymd = String(e.date).slice(0, 10);
  const tm = shiftTimes(e);
  const page = pageOf(e.id);
  const [d0, d1] = allDay(ymd);
  const alarm = (trigger: string) => ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.title)}`, `TRIGGER:${trigger}`, "END:VALARM"];
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MicroMobility//Volunteers//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.id.replace(/[^A-Za-z0-9-]/g, "")}@volunteer.micromobility.sa`,
    `DTSTAMP:${stamp(now)}`,
    ...(tm ? [`DTSTART:${stamp(tm.start)}`, `DTEND:${stamp(tm.end)}`] : [`DTSTART;VALUE=DATE:${d0}`, `DTEND;VALUE=DATE:${d1}`]),
    `SUMMARY:${esc(e.title)}`,
    ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
    `DESCRIPTION:${esc(e.note ? `${e.note}\n${page}` : page)}`,
    `URL:${page}`,
    ...alarm("-P1D"), ...alarm("-PT2H"),
    "END:VEVENT", "END:VCALENDAR", "",
  ];
  return lines.map(fold).join("\r\n");
}

/** A shift as volunteer_me sends it, as the calendar has it: where to meet, else the place; the role, the place when the
 *  meeting point is its own, and the staff contact in the notes. The Worker's file and the page's Google link both use it. */
export type ShiftLike = { id: string; date: string; time: string | null; starts_at?: string | null; ends_at?: string | null; location?: string | null;
  meet_point?: string | null; role?: string | null; contact_name?: string | null; contact_phone?: string | null };
export function calEventOf(x: ShiftLike, title: string, gathers: boolean): CalEvent {
  const contact = [x.contact_name, x.contact_phone].filter(Boolean).join(" ");
  const note = [x.role, x.meet_point && x.location ? x.location : null, contact || null].filter(Boolean).join("\n");
  return { id: x.id, title, date: x.date, time: x.time, starts_at: x.starts_at, ends_at: x.ends_at, location: x.meet_point || x.location || null,
    note: note || undefined, gathers };
}

/** The same shift as a Google Calendar link, for a phone whose calendar is Google's. */
export function googleCalUrl(e: CalEvent): string {
  const tm = shiftTimes(e);
  const dates = tm ? `${stamp(tm.start)}/${stamp(tm.end)}` : allDay(String(e.date).slice(0, 10)).join("/");
  const page = pageOf(e.id);
  const q = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates, details: e.note ? `${e.note}\n${page}` : page, ctz: "Asia/Riyadh" });
  if (e.location) q.set("location", e.location);
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
