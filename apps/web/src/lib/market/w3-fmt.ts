// How the inbox and a thread write an hour and a day (W3), described on the server and handed to the browser's
// components: the server has every one of the site's languages, a browser does not, and a page drawn on the server must
// read the same when the browser draws it again (lib/date-pattern.ts). Riyadh's time, as every time on the site.
import { datePattern, type DatePattern } from "../date-pattern";

/** A message's hour ("17:05") and a day ("20 Nov") in the page's language. */
export const inboxFmt = (locale: string): { time: DatePattern; day: DatePattern } => ({
  time: datePattern(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Riyadh" }),
  day: datePattern(locale, { day: "numeric", month: "short", timeZone: "Asia/Riyadh" }),
});
