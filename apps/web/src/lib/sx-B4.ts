import type { SiteContent } from "./site";
import type { Order, OrderItem } from "./store-order";

// After the sale, on an order's page (the user, 2026-11-18: "do all"; builder B4 of the store and Experiences build,
// report items N01-N05, N08, N12, N14, N18, N29-N31, N37). The rules here are pure and browser-safe, so the page, its
// components and the tests read the same ones: what the database's store_after_read answers (the build photos and
// check sheet, the "I'm here" arrival, warranty claims, the push opt-in, how often the slot was changed), the settings
// staff keep, which of the order's lines are bikes, when each button shows, the calendar file, and the Hijri date
// beside a Gregorian one on Arabic pages. Everything the database does not answer yet reads as "not there": the
// features hide, the page never breaks.

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const int = (v: unknown, d: number, lo: number, hi: number) => (typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : d);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Riyadh keeps UTC+3 all year. */
const RIYADH = 3 * 3600 * 1000;

// ── What the database answers (store_after_read) ──────────────────────────────────────────────────

/** The check sheet staff tick when a bike is built (N29), in the order the page lists them. */
export const CHECK_KEYS = ["brakes", "gears", "torque", "tyres"] as const;
export type CheckKey = (typeof CHECK_KEYS)[number];
export type AfterBuild = { at: string; photos: string[]; checks: Record<CheckKey, boolean>; note: string | null };
export type AfterArrival = { at: string; car: string | null; seen: boolean };
export const CLAIM_STATES = ["open", "in_progress", "resolved", "refused"] as const;
export type ClaimState = (typeof CLAIM_STATES)[number];
export type AfterClaim = { id: string; item_id: number; state: ClaimState; created_at: string; photos: number; reply: string | null };
export type After = { build: AfterBuild | null; arrival: AfterArrival | null; claims: AfterClaim[]; push: boolean; changes: number };

/** A photo the page may draw: the site's own /media/ address (the staff's catalogue upload) or an https one. */
const photoOk = (v: unknown): v is string => typeof v === "string" && v.length <= 400 && (/^\/media\/[A-Za-z0-9/_.-]+$/.test(v) || /^https:\/\/[^\s"'<>]+$/.test(v));

/** store_after_read's answer, or null for anything else (a database without the function answers 404: no extras). */
export function afterOf(data: unknown): After | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const o = data as Record<string, unknown>;
  const b = o.build && typeof o.build === "object" ? obj(o.build) : null;
  const c = obj(b?.checks);
  const build: AfterBuild | null = b && str(b.at)
    ? { at: String(b.at), photos: (Array.isArray(b.photos) ? b.photos : []).filter(photoOk).slice(0, 3),
        checks: Object.fromEntries(CHECK_KEYS.map((k) => [k, c[k] === true])) as Record<CheckKey, boolean>, note: str(b.note) }
    : null;
  const a = o.arrival && typeof o.arrival === "object" ? obj(o.arrival) : null;
  const arrival: AfterArrival | null = a && str(a.at) ? { at: String(a.at), car: str(a.car), seen: a.seen === true } : null;
  const claims = (Array.isArray(o.claims) ? o.claims : []).map(obj).filter((x) => str(x.id) && (CLAIM_STATES as readonly string[]).includes(String(x.state)))
    .map((x) => ({
      id: String(x.id), item_id: Number(x.item_id) || 0, state: x.state as ClaimState, created_at: String(x.created_at ?? ""),
      photos: int(x.photos, 0, 0, 3), reply: str(x.reply),
    }));
  return { build, arrival, claims, push: o.push === true, changes: int(o.changes, 0, 0, 99) };
}

// ── Settings staff keep (site_content) ────────────────────────────────────────────────────────────

export type AfterSettings = {
  /** The free first check-up (N12, shared with the product page's key-fact row): on, and within how many weeks. */
  checkup: { on: boolean; weeks: number };
  /** Change time (N30): how many hours before the slot starts it can still be changed, and how many times; null = off. */
  change: { hours: number; max: number } | null;
  /** Web push for an order's status (N04): off until staff turn it on. */
  push: boolean;
};

/** store.checkup {on, weeks} (default on, 12 weeks), store.slotChange {on, hours, max} (default on, 24 hours, twice),
 *  store.push.on (default off). A malformed value reads as its default. */
export function afterSettings(c: SiteContent | null | undefined): AfterSettings {
  const k = obj(c?.["store.checkup"]);
  const s = obj(c?.["store.slotChange"]);
  return {
    checkup: { on: k.on !== false, weeks: int(k.weeks, 12, 1, 52) },
    change: s.on === false ? null : { hours: int(s.hours, 24, 1, 168), max: int(s.max, 2, 1, 5) },
    push: c?.["store.push.on"] === true,
  };
}

// ── Which lines are bikes ─────────────────────────────────────────────────────────────────────────

/** The order's lines that are bikes (their product is in the bikes category of the store as it is now). */
export function bikeLines(o: Pick<Order, "items">, bikes: ReadonlySet<string>): OrderItem[] {
  return o.items.filter((i) => !i.gift_card && !!i.product_id && bikes.has(i.product_id));
}

/** An order of goods that reached its customer: delivered, or collected at the showroom. */
export const handedOver = (o: Pick<Order, "status" | "fulfil">) => o.status === "delivered" && o.fulfil !== "digital";

// ── Days ──────────────────────────────────────────────────────────────────────────────────────────

/** The Riyadh day of a moment ("2026-11-21"), or null. A plain day is itself. */
export function riyadhDay(v: string | null | undefined): string | null {
  if (!v) return null;
  if (DAY.test(v)) return v;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t + RIYADH).toISOString().slice(0, 10) : null;
}
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
/** A moment's Riyadh clock time, "10:42" (the same on the server and in any browser). */
export const riyadhHm = (iso: string): string => { const t = Date.parse(iso); return Number.isFinite(t) ? new Date(t + RIYADH).toISOString().slice(11, 16) : ""; };
/** The moment a Riyadh day and time begins, in ms. */
export const riyadhAt = (day: string, hm: string) => Date.parse(`${day}T${hm}:00Z`) - RIYADH;

/** The free check-up of a delivered bike (N03, N12): the day to be reminded (about half the window: six weeks of
 *  twelve) and the last day it is free; null for an order not handed over, or with no bike. */
export function checkupDays(o: Pick<Order, "status" | "fulfil" | "delivered_at">, weeks: number, hasBike: boolean): { remind: string; by: string } | null {
  if (!hasBike || !handedOver(o)) return null;
  const from = riyadhDay(o.delivered_at);
  if (!from) return null;
  return { remind: addDays(from, Math.max(1, Math.round(weeks / 2)) * 7), by: addDays(from, weeks * 7) };
}

/** The slot an order is booked for, with its hours: a Jeddah delivery window (F78) or a pickup handover (N13, B3), as
 *  the order kept it ({day, time, from, to}); null without one, or without its hours. */
export function bookedSlot(o: Pick<Order, "slot" | "fulfil">): { day: string; time: string; from: string; to: string } | null {
  const s = o.slot;
  if (!s || (o.fulfil !== "jeddah" && o.fulfil !== "pickup")) return null;
  if (!DAY.test(s.day) || !s.from || !s.to || !HM.test(s.from) || !HM.test(s.to)) return null;
  return { day: s.day, time: s.time, from: s.from, to: s.to };
}

/** Change time (N30): an order still to come with a booked slot, more than `hours` before it starts, changed fewer than
 *  `max` times. */
export function slotChangeOpen(o: Pick<Order, "slot" | "fulfil" | "status">, now: number, set: AfterSettings["change"], changes: number): boolean {
  const s = bookedSlot(o);
  if (!s || !set || changes >= set.max) return false;
  if (!["paid", "preparing", "ready"].includes(o.status)) return false;
  return riyadhAt(s.day, s.from) - now > set.hours * 3600 * 1000;
}

/** "I'm here" (N14): a pickup order that is ready, on the day it is booked for (any day once ready, without a slot). */
export function arriveOpen(o: Pick<Order, "slot" | "fulfil" | "status">, today: string): boolean {
  if (o.fulfil !== "pickup" || o.status !== "ready") return false;
  const s = bookedSlot(o);
  return !s || s.day === today;
}

/** The Wallet pickup pass (N02): a pickup order paid and not yet collected. */
export const passOpen = (o: Pick<Order, "fulfil" | "status">) => o.fulfil === "pickup" && ["paid", "preparing", "ready"].includes(o.status);

/** The calendar entry for the booked slot (N03): while the order is still to come. */
export const slotCalendarOpen = (o: Pick<Order, "slot" | "fulfil" | "status">) => !!bookedSlot(o) && ["paid", "preparing", "ready", "shipped", "out"].includes(o.status);

// ── Warranty claims (N31) ─────────────────────────────────────────────────────────────────────────

export type ClaimLine = { id: number; name: string; variant: string | null; image: string | null; until: string };
/** The lines a warranty claim can be started from: a handed-over order's goods (not gift cards), within their warranty
 *  (months counted from the day it was handed over: the product's own term, else the law's two years), with no claim
 *  still open on that line. */
export function claimLines(o: Pick<Order, "status" | "fulfil" | "delivered_at" | "items">, claims: readonly AfterClaim[], now: number,
  monthsOf: (productId: string | null) => number): ClaimLine[] {
  if (!handedOver(o)) return [];
  const from = riyadhDay(o.delivered_at);
  if (!from) return [];
  const today = riyadhDay(new Date(now).toISOString()) as string;
  return o.items.filter((i) => i.id != null && !i.gift_card).flatMap((i) => {
    if (claims.some((c) => c.item_id === i.id && (c.state === "open" || c.state === "in_progress"))) return [];
    const until = addMonths(from, monthsOf(i.product_id));
    return today <= until ? [{ id: i.id as number, name: i.name, variant: i.variant, image: i.image, until }] : [];
  });
}
export function addMonths(day: string, m: number): string {
  const [y, mo, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, mo - 1 + m, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), Math.min(d, last))).toISOString().slice(0, 10);
}

export const CLAIM_MIN = 10, CLAIM_MAX = 600, PHOTO_MAX = 3;
/** A claim's words as the database takes them: trimmed, 10-600 characters. */
export const claimText = (s: string): string | null => { const x = s.trim().replace(/\s+\n/g, "\n"); return x.length >= CLAIM_MIN && x.length <= CLAIM_MAX ? x : null; };
/** A photo the claim or return names: the path this site's upload answered, inside the order's own folder. */
export const photoPathOk = (no: number, p: unknown): p is string => typeof p === "string" && new RegExp(`^o${no}/[0-9a-f]{32}\\.jpg$`).test(p);

// ── "I'm here" ────────────────────────────────────────────────────────────────────────────────────

/** The car's colour or make the customer gives (optional): letters in any script, digits, spaces and dashes, 30 at most;
 *  "" for none, null for one the database would refuse. */
export function carOf(s: unknown): string | null {
  if (typeof s !== "string") return "";
  const x = s.trim().replace(/\s+/g, " ");
  if (!x) return "";
  return x.length <= 30 && /^[\p{L}\p{M}\p{N} -]+$/u.test(x) ? x : null;
}

// ── Photos shrunk in the browser (N08, N29, N31) ──────────────────────────────────────────────────

/** The size a photo is drawn at before upload: its long side `max` at most, never enlarged. */
export function shrinkSize(w: number, h: number, max = 1600): { w: number; h: number } {
  if (!(w > 0 && h > 0)) return { w: 0, h: 0 };
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}
/** The largest upload the photo route takes (a 1600 px JPEG at 0.8 is well under it). */
export const UPLOAD_MAX = 700 * 1024;

// ── Hijri dates beside Gregorian ones on Arabic pages (N37) ───────────────────────────────────────

/** Umm al-Qura, Arabic month names, Western digits as the rest of the page. */
export const HIJRI_LOCALE = "ar-SA-u-ca-islamic-umalqura-nu-latn";
type Make = (locale: string, o: Intl.DateTimeFormatOptions) => Intl.DateTimeFormat;
const makeFmt: Make = (l, o) => new Intl.DateTimeFormat(l, o);

/** A Riyadh day's Hijri day, month name and year, read part by part from the engine and checked: the calendar it really
 *  used must be Umm al-Qura, the day 1-30, the month a name (not a number) and the year 14xx-15xx. Anything else (an
 *  engine without the calendar, one that writes the date in another order or in numbers: an iPhone once wrote en-CA dates
 *  as 10/27/2026) answers null and nothing is shown. */
export function hijriParts(day: string, make: Make = makeFmt): { d: number; m: string; y: number } | null {
  const v = riyadhDay(day);
  if (!v) return null;
  try {
    const f = make(HIJRI_LOCALE, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
    if (f.resolvedOptions().calendar !== "islamic-umalqura") return null;
    const p = f.formatToParts(new Date(`${v}T12:00:00Z`));
    const get = (k: string) => p.find((x) => x.type === k)?.value?.trim() ?? "";
    const d = get("day"), m = get("month"), y = get("year");
    if (!/^\d{1,2}$/.test(d) || !/^\d{4}$/.test(y) || !m || /[\d٠-٩]/.test(m)) return null;
    const dn = Number(d), yn = Number(y);
    return dn >= 1 && dn <= 30 && yn >= 1400 && yn < 1600 ? { d: dn, m, y: yn } : null;
  } catch {
    return null;
  }
}

/** "11 جمادى الآخرة 1448 هـ" beside a Gregorian date on an Arabic page; null on any other page or when unsure. */
export function hijriDay(day: string | null | undefined, locale: string, make: Make = makeFmt): string | null {
  if (locale !== "ar" || !day) return null;
  const h = hijriParts(day, make);
  return h ? `${h.d} ${h.m} ${h.y} هـ` : null;
}

/** A range of days in Hijri: "11–13 جمادى الآخرة 1448 هـ", or each end whole across months. */
export function hijriRange(from: string, to: string, locale: string, make: Make = makeFmt): string | null {
  if (locale !== "ar") return null;
  if (from === to) return hijriDay(from, locale, make);
  const a = hijriParts(from, make), b = hijriParts(to, make);
  if (!a || !b) return null;
  return a.m === b.m && a.y === b.y ? `${a.d}–${b.d} ${a.m} ${a.y} هـ` : `${a.d} ${a.m}${a.y === b.y ? "" : ` ${a.y}`} – ${b.d} ${b.m} ${b.y} هـ`;
}

// ── The calendar file (N03) ───────────────────────────────────────────────────────────────────────

export type IcsEvent = {
  uid: string; title: string; text?: string; location?: string; url?: string;
  /** A Riyadh day, with Riyadh times for a timed event; without them it fills the day. */
  day: string; from?: string; to?: string;
  /** VALARM triggers, before the start ("-PT1H") or, on a whole-day event, from its midnight ("PT9H" = 09:00). */
  alarms: string[];
};

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const utc = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const compact = (day: string) => day.replace(/-/g, "");
const enc = new TextEncoder();

/** A content line folded at 75 octets (RFC 5545 3.1), never inside a character: Arabic letters are two octets each. */
export function fold(line: string): string {
  const out: string[] = [];
  let cur = "", n = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (n + b > (out.length ? 74 : 75)) { out.push(cur); cur = ""; n = 0; }
    cur += ch; n += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

/** An .ics file with these events and their alarms (CRLF lines, folded, escaped), stamped `now`. */
export function icsText(events: readonly IcsEvent[], now: number): string {
  const L: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MicroMobility//Store//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const e of events) {
    if (!DAY.test(e.day)) continue;
    const timed = !!(e.from && e.to && HM.test(e.from) && HM.test(e.to));
    L.push("BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${utc(now)}`);
    if (timed) L.push(`DTSTART:${utc(riyadhAt(e.day, e.from as string))}`, `DTEND:${utc(riyadhAt(e.day, e.to as string))}`);
    else L.push(`DTSTART;VALUE=DATE:${compact(e.day)}`, `DTEND;VALUE=DATE:${compact(addDays(e.day, 1))}`);
    L.push(`SUMMARY:${esc(e.title)}`);
    if (e.location) L.push(`LOCATION:${esc(e.location)}`);
    if (e.text) L.push(`DESCRIPTION:${esc(e.text)}`);
    if (e.url) L.push(`URL:${e.url}`);
    for (const a of e.alarms) {
      if (!/^-?P(T\d+[HM]|\d+D(T\d+H)?)$/.test(a)) continue;
      L.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.title)}`, `TRIGGER:${a}`, "END:VALARM");
    }
    L.push("END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return L.map(fold).join("\r\n") + "\r\n";
}

// ── Add to Home Screen (N05) ───────────────────────────────────────────────────────────────────────

/** The site's web app manifest (public/app.webmanifest), named only by the pages that offer Add to Home Screen (an
 *  order's page, My Account): no start_url, so the page added is the page that opens (the order with its key, or the
 *  account), and no other page is installable, so no browser puts its own install banner on them (R2). */
export const APP_META = {
  manifest: "/app.webmanifest",
  appleWebApp: { capable: true, title: "MicroMobility", statusBarStyle: "default" as const },
};

// ── Links ─────────────────────────────────────────────────────────────────────────────────────────

/** The order's own link (its number and key), as the payment page and Track order give it. */
export const orderPath = (no: number, key: string) => `/store/order/${no}?k=${key}`;

/** The official Wallet badges (Apple's "Add to Apple Wallet", Google's "Add to Google Wallet"), as files the owner drops
 *  into public/site/wallet/ from Apple's and Google's brand pages: never redrawn. While a file is not there (null), the
 *  button is the site's own words beside a drawn wallet, as the booking app's is. */
export const WALLET_ART: Record<"apple" | "google", Record<"en" | "ar", string | null>> = {
  apple: { en: null, ar: null },
  google: { en: null, ar: null },
};
