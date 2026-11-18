// The Experiences booking steps after a date is chosen, the payment page's booking half and the confirmation (the user,
// 2026-11-18: "do all" of the Store and Experiences mobile report; builder B6). Pure rules, browser-safe (no server
// imports), so the components stay thin and the rules are tested (src/lib/__tests__/sx-b6.test.ts).
import type { Rider } from "./booking";
import { intlOf } from "@/i18n/locales";

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {});
const num = (v: unknown, d: number, lo: number, hi: number) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d;
};
const DAY = 86400000;
const dayMs = (iso: string) => Date.parse(`${String(iso).slice(0, 10)}T00:00:00Z`);

// ── Dates ────────────────────────────────────────────────────────────────────────────────────────
/** Whole days from `today` to `date` (both Riyadh YYYY-MM-DD); null when either cannot be read. */
export function daysUntil(date: string, today: string): number | null {
  const d = dayMs(date), t = dayMs(today);
  return Number.isFinite(d) && Number.isFinite(t) ? Math.round((d - t) / DAY) : null;
}
/** "In 3 days" beside the absolute date (EF34): only from 2 days on (Today and Tomorrow are said already) and up to 60. */
export function soonDays(date: string, today: string): number | null {
  const n = daysUntil(date, today);
  return n != null && n >= 2 && n <= 60 ? n : null;
}
/** The last day a booking paid online can be cancelled for a full refund (pay_booking_cancel: today + refundDays must not
 *  pass the ride's date): the ride's date less refundDays, as YYYY-MM-DD. */
export function refundUntil(date: string, refundDays: number): string | null {
  const d = dayMs(date);
  if (!Number.isFinite(d) || !Number.isFinite(refundDays) || refundDays < 0) return null;
  return new Date(d - Math.floor(refundDays) * DAY).toISOString().slice(0, 10);
}
/** A day as a short fact, "Wed 9 Dec" (en-GB for English: never en-CA's month-first form, the en-CA trap of 2026-10-27). */
export function shortDay(iso: string, locale: string): string {
  const d = dayMs(iso);
  if (!Number.isFinite(d)) return "";
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : intlOf(locale), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(d)).replace(",", "");
}
/** EF14: the refund line beside the price: until a day ("until" + that day), or none left when booked after it. */
export function refundLine(date: string, today: string, refundDays: number): { until: string } | { none: true } | null {
  const u = refundUntil(date, refundDays);
  if (!u) return null;
  return dayMs(today) > dayMs(u) ? { none: true } : { until: u };
}

// ── The party (EF09, EM06-B, EM07-B) ────────────────────────────────────────────────────────────
/** A rider of the party: a child (5 and over, the birth-date rule's floor) rides the Kids bike where the ride offers it. */
export type PartyRider = Rider & { child?: boolean };
export function partyOf(riders: PartyRider[]): { adults: number; kids: number } {
  const kids = riders.filter((r) => r.child).length;
  return { adults: Math.max(1, riders.length - kids), kids };
}
/** The party set from the stepper: adults first (rider 1 is the account holder), then the children, each one kept as it
 *  was answered; never more than `cap` in all and never fewer than one adult. A new child starts on the Kids bike when
 *  `kidsType` says the ride has one. */
export function setParty(riders: PartyRider[], adults: number, kids: number, cap: number, kidsType: string | null): PartyRider[] {
  const a = Math.max(1, Math.min(cap, Math.floor(adults)));
  const k = Math.max(0, Math.min(cap - a, Math.floor(kids)));
  const grown = riders.filter((r) => !r.child), small = riders.filter((r) => r.child);
  const blank = (child: boolean): PartyRider => ({ name: "", height: "", type: child && kidsType ? (kidsType as Rider["type"]) : "", ...(child ? { child: true } : {}) });
  const out: PartyRider[] = [];
  for (let i = 0; i < a; i++) out.push(grown[i] ?? blank(false));
  for (let i = 0; i < k; i++) out.push(small[i] ?? blank(true));
  return out;
}
/** A rider row's summary while folded (EM07-B): which rider, adult or child, the bike picked. */
export function riderDone(r: Rider, needsName: boolean): boolean {
  return !!r.type && (!needsName || !!r.name.trim()) && (r.type === "Own" || /^\d{2,3}$/.test(r.height));
}

// ── The bar (EM04-B) ────────────────────────────────────────────────────────────────────────────
/** Whether the dates step's bar has something to do: a date here that can be chosen (not one that opens later, goes to
 *  another page, or is fully booked). With nothing to choose, Back sits inline and no Continue is drawn (E01, E04). */
export function datesLive(sessions: { opens?: string | null; satLink?: string | null; handoff?: string | null; fbk?: boolean }[]): boolean {
  return sessions.some((s) => !s.opens && !s.satLink && !s.handoff && !s.fbk);
}
/** The phone keyboard is up: the visual viewport is shorter than the layout viewport by more than a toolbar's worth. */
export function keyboardUp(layoutH: number, visualH: number, focusedField: boolean): boolean {
  return focusedField && layoutH > 0 && visualH > 0 && layoutH - visualH > 140;
}

// ── A payment that did not go through (EF13) ───────────────────────────────────────────────────
export type Decline = "funds" | "expired" | "limit" | "secure" | "blocked" | "details" | "bank" | "generic";
/** The cause a card payment failed with, read from the gateway's message (Moyasar's words vary in case and wording). */
export function declineCause(message: string | null | undefined): Decline {
  const m = String(message ?? "").toLowerCase();
  if (!m) return "generic";
  if (/insufficient|not sufficient|no funds|balance/.test(m)) return "funds";
  if (/expired|expiry|expiration/.test(m)) return "expired";
  if (/limit|exceed|frequency/.test(m)) return "limit";
  if (/3-?d|secure|authenticat|otp|enrol/.test(m)) return "secure";
  if (/lost|stolen|block|restrict|pick ?up|fraud|not permitted|not allowed/.test(m)) return "blocked";
  if (/cvv|cvc|invalid card|card number|incorrect|invalid/.test(m)) return "details";
  if (/issuer|bank|unavailable|timed? ?out|timeout|do not honou?r|declined/.test(m)) return "bank";
  return "generic";
}

// ── Kit for the ride (N32) ──────────────────────────────────────────────────────────────────────
/** Which kit a ride's confirmation links: lights and the radar for a ride after dark, the bike computer for the Saturday
 *  ride. `start` is the start time "HH:MM" (24 h, Riyadh); sunset in Jeddah is before 18:45 all year. */
export function kitFor(kind: string, start: string | null | undefined): "night" | "saturday" | null {
  if (kind === "saturday") return "saturday";
  const m = /^(\d{1,2}):(\d{2})/.exec(String(start ?? ""));
  if (!m) return kind === "jcc" ? "night" : null;
  const min = Number(m[1]) * 60 + Number(m[2]);
  return min >= 18 * 60 + 15 || min < 5 * 60 ? (["jcc", "snd96", "event", "petromin"].includes(kind) ? "night" : null) : null;
}
export type KitItem = { slug: string; name: string; photo: string | null };
const HELMET = /helmet|خوذ/i;
/** The store's products a kit names, never a helmet (helmets come free with every ride): by the slugs staff set
 *  (xp.kit), else by name. At most three. */
export function kitPick(products: { slug: string; name: string; photo?: string | null }[], want: string[], byName: RegExp): KitItem[] {
  const ok = products.filter((p) => !HELMET.test(p.name) && !HELMET.test(p.slug));
  const set = want.length ? want.map((s) => ok.find((p) => p.slug === s)).filter((p): p is (typeof ok)[number] => !!p) : ok.filter((p) => byName.test(p.name));
  return set.slice(0, 3).map((p) => ({ slug: p.slug, name: p.name, photo: p.photo ?? null }));
}
export const KIT_NAMES = { night: /\b(light|lights|lamp|varia|radar)\b/i, saturday: /\b(edge|garmin)\b/i };

// ── Settings staff keep (site_content xp.*), all off or empty until set ─────────────────────────
export type EarlyBird = { pct: number; days: number; kinds: string[] };
export type XpSettings = {
  /** EF18: one guardian tick naming each child on the booking (legal check first). */
  guardian: boolean;
  /** EF29: a lower price booked N days or more ahead, only while the discount licence is set too. */
  early: EarlyBird | null;
  /** EF22: rental fees back as wallet credit on a bike bought within N days. */
  bikeCredit: { days: number; max: number } | null;
  /** EF20: gifting a ride (off until staff switch it on, with the purchase terms written: needs payments). */
  gifts: boolean;
  /** N32: the store products each kit links, by slug (empty: by name). */
  kit: { night: string[]; saturday: string[] };
};
const slugs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && /^[a-z0-9-]{1,80}$/.test(x)).slice(0, 3) : []);
export function xpSettings(content: Record<string, unknown> | null | undefined, licence: boolean): XpSettings {
  const c = content ?? {};
  const g = obj(c["xp.guardianTick"]), e = obj(c["xp.earlyBird"]), b = obj(c["xp.bikeCredit"]), gf = obj(c["xp.gifts"]), k = obj(c["xp.kit"]);
  const kinds = Array.isArray(e.kinds) ? e.kinds.filter((x): x is string => typeof x === "string" && /^[a-z0-9]{2,12}$/.test(x)) : [];
  return {
    guardian: g.on === true,
    early: e.on === true && licence && kinds.length ? { pct: num(e.pct, 10, 1, 50), days: num(e.days, 14, 1, 120), kinds } : null,
    bikeCredit: b.on === true ? { days: num(b.days, 30, 1, 365), max: num(b.max, 300, 0, 5000) } : null,
    gifts: gf.on === true,
    kit: { night: slugs(k.night), saturday: slugs(k.saturday) },
  };
}
/** What the Experiences page hands the booking flow (app/[locale]/experiences/page.tsx, lib/sx-b6-server.ts): the
 *  settings, the kit each kind of ride links on its confirmation, and this site's address for links shared out. */
export type SxFlow = { settings: XpSettings; kit: { night: KitItem[]; saturday: KitItem[] }; origin: string; packs: Pack[] };
/** EF29: the early-bird share off a date, or 0: the kind is one staff named and the date is far enough ahead. */
export function earlyPct(e: EarlyBird | null, kind: string, date: string, today: string): number {
  if (!e || !e.kinds.includes(kind)) return 0;
  const n = daysUntil(date, today);
  return n != null && n >= e.days ? e.pct : 0;
}
/** An amount less a share, to the halala, as the database's _xp_early_bird rounds it. */
export const lessPct = (n: number, pct: number) => Math.round(n * (100 - pct)) / 100;

// ── Gifts and packs (EF20, EF21) ───────────────────────────────────────────────────────────────
export const GIFT_CODE = /^GF-[A-Z0-9]{8}$/;
export const PACK_CODE = /^PK-[A-Z0-9]{8}$/;
/** The link a gift travels as: the Experiences page with the code, which fills it in as a code at the review. */
export function giftLink(origin: string, locale: string, code: string): string | null {
  if (!GIFT_CODE.test(code)) return null;
  try {
    const u = new URL(locale === "en" ? "/experiences" : `/${locale}/experiences`, origin);
    u.searchParams.set("gift", code);
    return u.toString();
  } catch { return null; }
}
/** The WhatsApp message a gift is sent with (R5: no email, no text message): words and the link, nothing else. */
export const waLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
/** A first name for the gift (letters and spaces, the names rule), 40 at most. */
export const giftName = (v: string) => v.replace(/[^\p{L}\s]/gu, "").replace(/\s+/g, " ").trim().slice(0, 40);
export type Pack = { id: string; kind: string; title: string; lessons: number; price: number; type: string | null; months: number };
export function packsOf(rows: unknown, locale: string): Pack[] {
  if (!Array.isArray(rows)) return [];
  return rows.map(obj).filter((r) => typeof r.id === "string" && typeof r.kind === "string" && Number(r.lessons) >= 2 && Number(r.price) > 0)
    .map((r) => ({
      id: r.id as string, kind: r.kind as string, title: String((locale === "ar" && r.title_ar) || r.title_en || ""),
      lessons: Number(r.lessons), price: Number(r.price), type: typeof r.bike_type === "string" && r.bike_type ? r.bike_type : null, months: num(r.months, 6, 1, 24),
    })).filter((p) => p.title);
}
