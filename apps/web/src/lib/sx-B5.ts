// micromobility.sa/experiences as one list of every session and a page for each (the Experiences build of 2026-11-18, the
// user: "do all" of the store and Experiences research; its EM01-B, EM02-B, EM03-B, EM05-B, EM10-B and EF items). Plain
// logic, browser-safe, so it can be tested: what a row and a session's page say (lib/sx-B5-server.ts builds them on the
// server), how the list is narrowed (EF26), grouped by day (EF07) and folded into series (EF27), the map and Directions
// (EF01), the private-group WhatsApp request (EF31), a kind's calendar feed (EF16), the weather at the start (EF24) and
// a kind's average rating (EF35).
import type { RouteWords } from "@/components/experiences/KindArt";

/** A kind's event card on staging's booking (app/[locale]/experiences/page.tsx EVENT_OF): where a date is booked. */
export const XP_EVENT_OF: Record<string, string> = {
  jcc: "jcc", saturday: "community", swim: "community", petromin: "petromin", workshop: "workshop", snd96: "snd96", event: "event",
  runher: "runher", vlap: "vlap", defe5k: "community", arena: "arena", blood: "blood", yoga: "community", farm: "community", testride: "testride",
};
/** The kinds this site books itself (page.tsx HERE); every other kind is booked in the booking app on its card and date. */
export const XP_HERE: ReadonlySet<string> = new Set(["jcc", "saturday", "swim", "workshop", "snd96", "event"]);

/** Where a date stands, said at the end of its row and on its booking card (the words are the page's, Booking.text.ts):
 *  Full, no waitlist; full with its waitlist open; places left (3 or fewer, counted); Few spots left (staff's switch);
 *  not open yet (the words for when it opens); members book first (held from a visitor who is not a member, or a
 *  member's mark). Only what the database or staff said: nothing invented (R7). */
export type XpStatus =
  | { k: "fbk" } | { k: "wl" } | { k: "left"; n: number } | { k: "few" }
  | { k: "opens"; text: string } | { k: "mf"; held: boolean; label: string; when: string };
/** What it costs: Free, the cheapest bike, or an event's seat; null when nothing is said (a race paid to its organiser,
 *  the blood donation). Free rides show no price and no pay controls (the owner's rule). */
export type XpPrice = { k: "free" } | { k: "from"; n: number } | { k: "seat"; n: number } | null;
/** What its button does: books it here (the booking steps, opened on it), hands over (the booking app, or the Saturday
 *  ride's code page), or nothing (fully booked, not open yet, held for members). */
export type XpAct = { k: "book"; href: string } | { k: "out"; href: string } | { k: "none" };
/** Where it is: the place's name, Directions (a map link), the map in the page (a Google Maps embed, which needs no
 *  key and the site's security policy already allows: frame-src https://www.google.com), or the words for when the
 *  Saturday ride's meeting point is told (then no link and no map). */
export type XpPlace = { name: string; dir: string | null; map: string | null; held: string | null };
/** A fact row of a session's page: what, in lines. */
export type XpFactKey = "who" | "needs" | "bring" | "included" | "lang" | "terms" | "collect" | "breakfast" | "route";
export type XpFact = { k: XpFactKey; v: string[] };

/** One session as its row and its page show it, every word the server writes already in the page's language. */
export type XpItem = {
  id: string; date: string; kind: string;
  /** Its event card on the booking (XP_EVENT_OF). */
  ev: string;
  name: string;
  /** "Today" / "Tomorrow", beside the absolute date only; null further out. */
  near: string | null;
  /** "Saturday · 21 Nov" (the year only when not this year). */
  day: string;
  /** The date tile: "Sat", "21", "Nov". */
  tile: { wd: string; dn: string; mo: string };
  /** Clocks in the page's language: the start, the gathering before it (EF32), the end (EF04); "HH:MM" of the start. */
  start: string | null; gather: string | null; end: string | null; hm: string | null;
  /** How long it lasts in minutes, when known (EF04). */
  len: number | null;
  place: XpPlace | null;
  price: XpPrice;
  status: XpStatus | null;
  act: XpAct;
  featured: boolean;
  gender: "male" | "female" | null;
  /** A child can come: a ride whose bikes include the Kids bike (EF26's Kids). */
  kids: boolean;
  members: boolean;
  /** "Sunrise 6:38 AM" on the Saturday ride (EF25), ready to show; the temperature at the start, °C (EF24). */
  sunrise: string | null; temp: number | null;
  /** Pace and level chips (EF03) and the session's language (EF30), as staff wrote them. */
  pace: string[]; lang: string | null;
  facts: XpFact[];
  /** The Saturday ride's two routes, for the drawn line (EF02). */
  route: RouteWords | null;
  /** What staff wrote about it (an event's description). */
  desc: string | null;
};

// ── Days ────────────────────────────────────────────────────────────────────────────────────

const DAY_MS = 864e5;
const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
/** The day `n` days after `iso` (YYYY-MM-DD). */
export const addDays = (iso: string, n: number): string => new Date(utc(iso) + n * DAY_MS).toISOString().slice(0, 10);
/** 0 Sunday ... 6 Saturday. */
export const weekday = (iso: string): number => new Date(utc(iso)).getUTCDay();

/** This week as Saudi calendars count it: from today to Saturday (the week starts on Sunday; ICU's ar-SA and en-SA). */
export function thisWeek(today: string): [string, string] {
  return [today, addDays(today, 6 - weekday(today))];
}
/** This weekend: Friday and Saturday (the weekend since 2013); today through Saturday when it is the weekend already. */
export function thisWeekend(today: string): [string, string] {
  const d = weekday(today);
  if (d === 5 || d === 6) return [today, addDays(today, 6 - d)];
  const fri = addDays(today, 5 - d);
  return [fri, addDays(fri, 1)];
}

// ── The filters (EF26) ──────────────────────────────────────────────────────────────────────

export type XpWhen = "today" | "week" | "weekend";
/** The chips that narrow the list: one kind (or every kind), one stretch of days, women only, kids. */
export type XpFilter = { kind: string | null; when: XpWhen | null; women: boolean; kids: boolean };
export const NO_FILTER: XpFilter = { kind: null, when: null, women: false, kids: false };
export const filterOn = (f: XpFilter): boolean => !!(f.kind || f.when || f.women || f.kids);

/** The sessions the chips leave, in the order given. */
export function xpFilter<T extends Pick<XpItem, "date" | "kind" | "gender" | "kids">>(items: readonly T[], f: XpFilter, today: string): T[] {
  const span = f.when === "today" ? [today, today] : f.when === "week" ? thisWeek(today) : f.when === "weekend" ? thisWeekend(today) : null;
  return items.filter((s) => (!f.kind || s.kind === f.kind)
    && (!span || (s.date >= span[0] && s.date <= span[1]))
    && (!f.women || s.gender === "female")
    && (!f.kids || s.kids));
}

/** Whether a chip would leave anything (a chip that leaves nothing is not offered). */
export const chipHas = <T extends Pick<XpItem, "date" | "kind" | "gender" | "kids">>(items: readonly T[], f: XpFilter, today: string): boolean => xpFilter(items, f, today).length > 0;

/** The kinds among the sessions, each once, in the order given (the page passes them in its kind order). */
export function kindsOf(items: readonly { kind: string }[], order: readonly string[]): string[] {
  const on = new Set(items.map((s) => s.kind));
  const known = order.filter((k) => on.has(k));
  return [...known, ...[...on].filter((k) => !known.includes(k))];
}

/** Read and write the filters to the address (?k=saturday&w=week&women=1&kids=1), so a filtered list can be shared. */
export function filterFromQuery(q: URLSearchParams | Record<string, string | string[] | undefined>): XpFilter {
  const get = (k: string) => {
    const v = q instanceof URLSearchParams ? q.get(k) : q[k];
    return typeof v === "string" ? v : null;
  };
  const kind = get("k"), when = get("w");
  return {
    kind: kind && /^[a-z0-9]{2,20}$/.test(kind) ? kind : null,
    when: when === "today" || when === "week" || when === "weekend" ? when : null,
    women: get("women") === "1", kids: get("kids") === "1",
  };
}
export function filterQuery(f: XpFilter): string {
  const p = new URLSearchParams();
  if (f.kind) p.set("k", f.kind);
  if (f.when) p.set("w", f.when);
  if (f.women) p.set("women", "1");
  if (f.kids) p.set("kids", "1");
  const s = p.toString();
  return s ? `?${s}` : "";
}

// ── Days and series (EF07, EF27) ────────────────────────────────────────────────────────────

/** The sessions under absolute day headings, the days in order and each day's sessions by start. */
export function dayGroups<T extends Pick<XpItem, "date" | "hm">>(items: readonly T[]): { date: string; items: T[] }[] {
  const by = new Map<string, T[]>();
  for (const s of [...items].sort((a, b) => a.date.localeCompare(b.date) || (a.hm ?? "").localeCompare(b.hm ?? ""))) {
    const l = by.get(s.date);
    if (l) l.push(s); else by.set(s.date, [s]);
  }
  return [...by].map(([date, l]) => ({ date, items: l }));
}

/** A kind with this many dates ahead or more is a series (Rapha's series headings): one block with its next two dates. */
export const SERIES_MIN = 3;
export type XpSeries<T> = { kind: string; items: T[]; next: T[]; weekday: number | null };
/** The list with the recurring kinds folded into series blocks: each block stands at its first date's day, with the next
 *  two dates; its other dates leave the day list (the kind's chip lists them all). A featured date is never folded: it
 *  keeps its own row and ribbon (EF28). Folded only while no chip narrows the list. */
export function seriesPlan<T extends Pick<XpItem, "kind" | "date" | "featured" | "hm">>(items: readonly T[], min = SERIES_MIN): { series: XpSeries<T>[]; rest: T[] } {
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date) || (a.hm ?? "").localeCompare(b.hm ?? ""));
  const byKind = new Map<string, T[]>();
  for (const s of sorted) if (!s.featured) byKind.set(s.kind, [...(byKind.get(s.kind) ?? []), s]);
  const series: XpSeries<T>[] = [];
  for (const [kind, l] of byKind) {
    if (l.length < min) continue;
    const days = new Set(l.map((s) => weekday(s.date)));
    series.push({ kind, items: l, next: l.slice(0, 2), weekday: days.size === 1 ? weekday(l[0].date) : null });
  }
  const folded = new Set(series.flatMap((x) => x.items));
  return { series, rest: sorted.filter((s) => !folded.has(s)) };
}

// ── Times (EF04, EF32) ──────────────────────────────────────────────────────────────────────

const HM = /^(\d{1,2}):(\d{2})$/;
export const hmMin = (hm: string): number | null => {
  const m = HM.exec(hm.trim());
  return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null;
};
export const minHm = (m: number): string => {
  const v = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
};
/** Minutes from a to b, past midnight when b is earlier (a night that ends after 00:00). */
export const minutesBetween = (a: string, b: string): number | null => {
  const x = hmMin(a), y = hmMin(b);
  if (x == null || y == null) return null;
  return y > x ? y - x : y < x ? y + 1440 - x : null;
};

/** A session's times from what staff stored (lib/rides.ts times: start-end, or gather-start when it gathers) and the
 *  kind's facts (gather: minutes before the start; minutes: how long it lasts): its gathering, start and end as
 *  "HH:MM", and its length in minutes. A fact staff did not give (0) is not said. */
export function timesOf(times: readonly [string, string] | null, gathers: boolean, facts: { gather: number; minutes: number }):
  { gather: string | null; start: string | null; end: string | null; len: number | null } {
  if (!times) return { gather: null, start: null, end: null, len: null };
  const [a, b] = times;
  if (a === b) {
    // one time alone (the DEFE 5KM Run): its start, and its length when staff gave it
    const len = facts.minutes > 0 ? facts.minutes : null;
    return { gather: null, start: a, end: len ? minHm((hmMin(a) ?? 0) + len) : null, len };
  }
  if (gathers) {
    const len = facts.minutes > 0 ? facts.minutes : null;
    return { gather: a, start: b, end: len ? minHm((hmMin(b) ?? 0) + len) : null, len };
  }
  const len = minutesBetween(a, b);
  const g = facts.gather > 0 && hmMin(a) != null ? minHm((hmMin(a) ?? 0) - facts.gather) : null;
  return { gather: g, start: a, end: b, len };
}

/** A length as hours and minutes ("2 h", "90 min" under two hours when not whole, "1 h 30 min"). */
export function lenParts(min: number): { h: number; m: number } {
  const v = Math.max(0, Math.round(min));
  return { h: Math.floor(v / 60), m: v % 60 };
}

/** "2 h", "90 min" (under two hours when not whole), "1 h 30 min" past that, in the page's words. */
export function lenText(min: number, t: { h: string; min: string; hmin: string }): string {
  const { h, m } = lenParts(min);
  // the number and its unit never part at a line's end
  return (!h || (h < 2 && m) ? fillIn(t.min, h * 60 + m) : m ? fillIn(t.hmin, h, m) : fillIn(t.h, h)).replace(/ /g, "\u00a0");
}
const fillIn = (s: string, ...a: (string | number)[]) => a.reduce<string>((o, v, i) => o.replace(`{${i}}`, String(v)), s);

/** The date's times on one line: "Gathering 6 AM · Start 6:30 AM – 8:30 AM · 2 h" or "9 PM – 11 PM · 2 h" (EF04, EF32). */
export function whenText(s: Pick<XpItem, "gather" | "start" | "end" | "len">, x: { gatherWord: string; startWord: string }, t: { h: string; min: string; hmin: string }): string {
  if (!s.start) return "";
  const range = s.end ? `${s.start} – ${s.end}` : s.start;
  const main = s.gather ? `${x.gatherWord} ${s.gather} · ${x.startWord} ${range}` : range;
  return s.len ? `${main} · ${lenText(s.len, t)}` : main;
}

// ── Facts staff write (content/pages/xp.ts) ─────────────────────────────────────────────────

/** A text of one fact per line: the lines, trimmed, at most eight. */
export const factLines = (v: unknown): string[] =>
  typeof v === "string" ? v.split(/\r?\n/).map((l) => l.replace(/^[-•·*]\s*/, "").trim()).filter(Boolean).slice(0, 8) : [];
/** Pace and level as chips: the parts split by "·", "|" or a new line, at most four. */
export const paceChips = (v: unknown): string[] =>
  typeof v === "string" ? v.split(/\s*[·|\n]\s*/).map((l) => l.trim()).filter(Boolean).slice(0, 4) : [];

/** A map pin "lat,lon" staff wrote, read only when it is a real place. */
export function pinOf(v: unknown): [number, number] | null {
  if (typeof v !== "string") return null;
  const m = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(v);
  if (!m) return null;
  const lat = +m[1], lon = +m[2];
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? [lat, lon] : null;
}
/** The pin a Google Maps link carries (?q=, ?query=, ?destination=, ?ll=, /@lat,lon), else null (a short link does not). */
export function pinFromUrl(url: string | null | undefined): [number, number] | null {
  if (!url) return null;
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  for (const k of ["q", "query", "destination", "ll", "daddr"]) {
    const p = pinOf(u.searchParams.get(k) ?? "");
    if (p) return p;
  }
  const at = /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/.exec(u.pathname);
  return at ? pinOf(`${at[1]},${at[2]}`) : null;
}
export const pinText = (p: [number, number]): string => `${p[0]},${p[1]}`;

/** The map in the page: Google Maps' embed of a pin or a place's name, in the page's language (no key; frame-src
 *  https://www.google.com is already allowed, as the home page's and About's maps use it). */
export const mapEmbed = (q: string, lang: string): string => `https://www.google.com/maps?q=${encodeURIComponent(q)}&z=16&hl=${encodeURIComponent(lang)}&output=embed`;
/** Directions to a pin or a place, which a phone hands to its Maps app. */
export const dirLink = (q: string): string => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;

// ── A private group (EF31) ──────────────────────────────────────────────────────────────────

/** The WhatsApp number in the site's WhatsApp link (wa.me/966..., api.whatsapp.com/send?phone=...), else null. */
export function waNumber(link: string | null | undefined): string | null {
  if (!link) return null;
  let u: URL;
  try { u = new URL(link); } catch { return null; }
  const host = u.hostname.replace(/^www\./, "");
  const raw = host === "wa.me" ? u.pathname.slice(1) : /(^|\.)whatsapp\.com$/.test(host) ? u.searchParams.get("phone") ?? "" : "";
  const d = raw.replace(/\D/g, "");
  return d.length >= 9 && d.length <= 15 ? d : null;
}
/** A WhatsApp message to the business with the session filled in (no email, no SMS: the owner's rule). */
export const waLink = (number: string, text: string): string => `https://wa.me/${number}?text=${encodeURIComponent(text)}`;

// ── The weather at the start (EF24) ─────────────────────────────────────────────────────────

/** The moment a Riyadh day and clock stand for (UTC+3, no daylight saving). */
export const ksaMs = (date: string, hm: string): number => {
  const m = hmMin(hm);
  return m == null ? NaN : utc(date) + (m - 180) * 60e3;
};
/** The air temperature MET Norway's forecast (locationforecast 2.0 compact) gives nearest a moment, within three hours,
 *  rounded; null when the forecast does not reach it. */
export function tempAt(forecast: unknown, at: number): number | null {
  const ts = (forecast as { properties?: { timeseries?: unknown } } | null)?.properties?.timeseries;
  if (!Array.isArray(ts) || !Number.isFinite(at)) return null;
  let best: { d: number; t: number } | null = null;
  for (const e of ts) {
    const time = Date.parse(String((e as { time?: unknown })?.time ?? ""));
    const t = (e as { data?: { instant?: { details?: { air_temperature?: unknown } } } })?.data?.instant?.details?.air_temperature;
    if (!Number.isFinite(time) || typeof t !== "number" || !Number.isFinite(t)) continue;
    const d = Math.abs(time - at);
    if (d <= 3 * 3600e3 && (!best || d < best.d)) best = { d, t };
  }
  return best ? Math.round(best.t) : null;
}

// ── A kind's average rating (EF35) ──────────────────────────────────────────────────────────

/** xp_kind_ratings' answer (SX/sql/B5.sql): per kind, the average out of 5 and how many ratings make it. A kind with
 *  fewer than `min` is left out, as is anything that does not read; nothing is shown for a database without it. */
export function ratingsOf(data: unknown, min: number): Map<string, { avg: number; n: number }> {
  const out = new Map<string, { avg: number; n: number }>();
  if (!Array.isArray(data)) return out;
  for (const r of data) {
    const kind = (r as { kind?: unknown })?.kind, avg = Number((r as { avg?: unknown })?.avg), n = Number((r as { n?: unknown })?.n);
    if (typeof kind === "string" && /^[a-z0-9]{2,20}$/.test(kind) && Number.isFinite(avg) && avg >= 1 && avg <= 5 && Number.isInteger(n) && n >= Math.max(5, min)) {
      out.set(kind, { avg: Math.round(avg * 10) / 10, n });
    }
  }
  return out;
}

// ── A kind's calendar (EF16) ────────────────────────────────────────────────────────────────

const icsEsc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
/** A line folded at 75 octets, as RFC 5545 asks. */
function fold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = ""; }
    cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}
const icsStamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** A kind's dates as a calendar to subscribe to (webcal): each date's name, start and end (its gathering when it has one,
 *  else its start; two hours when its end is not known), place and page. Public: no booking, no rider, nothing personal. */
export function icsFeed(o: { name: string; host: string; items: { id: string; date: string; name: string; gather: string | null; start: string | null; end: string | null; place: string | null; url: string }[]; now?: number }): string {
  const now = o.now ?? Date.now();
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MicroMobility//Experiences//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEsc(o.name)}`, "X-WR-TIMEZONE:Asia/Riyadh", "REFRESH-INTERVAL;VALUE=DURATION:PT6H", "X-PUBLISHED-TTL:PT6H"];
  for (const s of o.items) {
    const from = s.gather ?? s.start;
    if (!from) continue;
    const a = ksaMs(s.date, from);
    if (!Number.isFinite(a)) continue;
    let b = s.end ? ksaMs(s.date, s.end) : a + 2 * 3600e3;
    if (!(b > a)) b += DAY_MS;
    lines.push("BEGIN:VEVENT", `UID:${s.id}@${o.host}`, `DTSTAMP:${icsStamp(now)}`, `DTSTART:${icsStamp(a)}`, `DTEND:${icsStamp(b)}`,
      `SUMMARY:${icsEsc(s.name)}`, ...(s.place ? [`LOCATION:${icsEsc(s.place)}`] : []), `URL:${s.url}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
