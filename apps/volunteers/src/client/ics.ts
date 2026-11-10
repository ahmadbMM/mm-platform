// "Add to calendar": a calendar file made on the phone and handed to it, nothing sent anywhere. Riyadh keeps one
// offset all year (UTC+3), so a session's local times turn into UTC by taking three hours off.

// gathers: the session's times are "gather - start" (i18n gathers()), not "start - end".
export type CalEvent = { id: string; title: string; date: string; time: string | null; starts_at?: string | null; location: string | null; note?: string; gathers?: boolean };

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1");
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
/** "17:00" on a Riyadh date, as a moment. */
const at = (ymd: string, hm: string): Date | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const d = new Date(`${ymd}T${m[1].padStart(2, "0")}:${m[2]}:00+03:00`);
  return Number.isFinite(d.getTime()) ? d : null;
};

/** The file's text. A session with no times is a whole day. */
export function icsText(e: CalEvent, now = new Date()): string {
  const ymd = String(e.date).slice(0, 10);
  const [a, b] = String(e.time ?? "").split(/\s*[-–]\s*/);
  let start = a ? at(ymd, a) : null;
  if (e.starts_at && Number.isFinite(Date.parse(e.starts_at))) start = new Date(e.starts_at);
  let end = start && b ? at(ymd, b) : null;
  // A ride that gathers keeps "gather - start": its second time is when it sets off, and the event ended right there,
  // leaving the volunteer free for the rest of the shift. It ends two hours after it, as the booking app's file does.
  if (end && e.gathers) end = new Date(end.getTime() + 2 * 3600000);
  if (start && end && end <= start) end = new Date(end.getTime() + 86400000); // past midnight
  if (start && !end) end = new Date(start.getTime() + 3 * 3600000);
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MicroMobility//Volunteers//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.id.replace(/[^A-Za-z0-9-]/g, "")}@volunteer.micromobility.sa`,
    `DTSTAMP:${stamp(now)}`,
    ...(start && end
      ? [`DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`]
      : [`DTSTART;VALUE=DATE:${ymd.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${new Date(Date.parse(`${ymd}T12:00:00Z`) + 86400000).toISOString().slice(0, 10).replace(/-/g, "")}`]),
    `SUMMARY:${esc(e.title)}`,
    ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
    `DESCRIPTION:${esc(e.note ? `${e.note}\nhttps://volunteer.micromobility.sa/#me` : "https://volunteer.micromobility.sa/#me")}`,
    "URL:https://volunteer.micromobility.sa/#me",
    "END:VEVENT", "END:VCALENDAR", "",
  ];
  return lines.join("\r\n");
}

/** Hands the file to the phone, which offers to add it to its calendar. */
export function downloadIcs(e: CalEvent): void {
  const url = URL.createObjectURL(new Blob([icsText(e)], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `micromobility-volunteer-${e.id.replace(/[^A-Za-z0-9-]/g, "")}.ics`;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}
