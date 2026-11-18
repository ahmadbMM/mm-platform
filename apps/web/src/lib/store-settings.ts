import { workingDay } from "./store-delivery";
import type { SiteContent } from "./site";
import { inSeason, ramadanOf } from "./sx-b3-handover";

// The store build's settings (2026-11-15, rentals migration 20261115235500; CONTRACTS.md section 1), read the way the
// database reads them: a key that is missing or malformed reads as its default, which is off. Staff edit them in the
// staff page's Payments > Settings. Nothing here reads anything, so the browser's components can use it too.

export type StoreSwitches = { tabby: boolean; smsa: boolean; addressLookup: boolean };
export type SlotTime = { id: string; from: string; to: string };
/** `season` (N36, store.ramadan): on its days only the windows it names (its ids among `times`) are offered, on the
 *  other days only the rest. */
export type Slots = { on: boolean; ahead: number; lead: number; skip: number[]; times: SlotTime[]; season?: { from: string; to: string; ids: string[] } };
export type District = { en: string; ar: string | null };
export type StoreLegal = { legalName: string; cr: string; ecr: string; vat: string; sbc: string };

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const int = (v: unknown, d: number, lo: number, hi: number) => (typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : d);
const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : "");

/** The features built but kept off until their keys exist (Tabby F29/F84, SMSA labels F108, the national address
 *  lookup F76): on only with an explicit true. Off means the feature is not drawn at all. */
export function storeSwitches(c: SiteContent | null | undefined): StoreSwitches {
  return { tabby: c?.["store.tabby.on"] === true, smsa: c?.["store.smsa.on"] === true, addressLookup: c?.["store.addressLookup.on"] === true };
}

const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
export const DEFAULT_SLOTS: Slots = {
  on: false, ahead: 6, lead: 1, skip: [5],
  times: [{ id: "am", from: "09:00", to: "13:00" }, { id: "pm", from: "16:00", to: "21:00" }],
};

/** Scheduled Jeddah delivery (store.slots, F78), or null while it is off. */
export function deliverySlots(c: SiteContent | null | undefined): Slots | null {
  const o = obj(c?.["store.slots"]);
  if (o.on !== true) return null;
  const times = (Array.isArray(o.times) ? o.times : []).map(obj)
    // a window may run past midnight (21:00-01:00, the Ramadan evenings of N36): its end is then before its start
    .filter((t) => typeof t.id === "string" && /^[a-z0-9]{1,12}$/.test(t.id) && HM.test(String(t.from)) && HM.test(String(t.to)) && String(t.to) !== String(t.from))
    .slice(0, 4).map((t) => ({ id: t.id as string, from: t.from as string, to: t.to as string }));
  const skip = [...new Set((Array.isArray(o.skip) ? o.skip : []).filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))];
  if (!times.length || skip.length >= 7) return null;
  const out: Slots = { on: true, ahead: int(o.ahead, DEFAULT_SLOTS.ahead, 1, 14), lead: int(o.lead, DEFAULT_SLOTS.lead, 0, 7), skip, times };
  // Ramadan's evening windows (store.ramadan, N36), as the database's _store_slots adds them: an id the usual ones use is
  // left out
  const r = ramadanOf(c), extra = (r?.times ?? []).filter((t) => !times.some((x) => x.id === t.id));
  return r && extra.length ? { ...out, times: [...times, ...extra], season: { from: r.from, to: r.to, ids: extra.map((t) => t.id) } } : out;
}

/** The windows a day has, before the clock: Ramadan's on its days, the usual ones on the others. */
export function seasonTimes(s: Slots, day: string): SlotTime[] {
  const z = s.season;
  if (!z) return s.times;
  const on = inSeason(z, day);
  return s.times.filter((t) => z.ids.includes(t.id) === on);
}

const weekday = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();
const nextDay = (iso: string) => new Date(Date.parse(`${iso}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);

/** The windows a day can be booked in: all of them, but on the day of `now` (the Riyadh clock, "YYYY-MM-DDTHH:MM", when
 *  the page knows it) only those not started yet, and none on a day already past. With a lead of 0 days today is
 *  offered, and a window already over could be booked (bug hunt 2026-11-18). */
export function slotTimes(s: Slots, day: string, now?: string | null): SlotTime[] {
  const times = seasonTimes(s, day);
  if (!now || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(now)) return times;
  const nowDay = now.slice(0, 10), hm = now.slice(11, 16);
  return day < nowDay ? [] : day === nowDay ? times.filter((t) => t.from > hm) : times;
}

/** The days a scheduled delivery can be booked for, counted from `today` (YYYY-MM-DD, Riyadh): the first `lead` working
 *  days on (Fridays not counted, as the delivery dates), then `ahead` days that are not among the days staff skip, and
 *  not a day with no window left (slotTimes, with `now`). The database takes the same days (store_checkout,
 *  STORE_SLOT). */
export function slotDays(s: Slots, today: string, now?: string | null): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return [];
  let d = workingDay(today, s.lead);
  const out: string[] = [];
  for (let guard = 0; out.length < s.ahead && guard < 60; guard++, d = nextDay(d)) {
    if (!s.skip.includes(weekday(d)) && slotTimes(s, d, now).length) out.push(d);
  }
  return out;
}

/** Whether a slot the customer picked is one of those offered. */
export const slotOk = (s: Slots, today: string, slot: { day: string; time: string } | null | undefined, now?: string | null): boolean =>
  !!slot && slotDays(s, today, now).includes(slot.day) && slotTimes(s, slot.day, now).some((t) => t.id === slot.time);

/** The Jeddah districts the shop delivers to (store.districts, F79), or null while the check is off. */
export function servedDistricts(c: SiteContent | null | undefined): District[] | null {
  const o = obj(c?.["store.districts"]);
  if (o.on !== true) return null;
  const list = (Array.isArray(o.list) ? o.list : []).map(obj).map((d) => ({ en: str(d.en, 60), ar: str(d.ar, 60) || null })).filter((d) => d.en).slice(0, 150);
  return list.length ? list : null;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
/** Whether a district typed or picked is one the shop serves (its English or Arabic name, as the database compares it). */
export const districtServed = (list: readonly District[], name: string): boolean =>
  !!name.trim() && list.some((d) => norm(d.en) === norm(name) || (!!d.ar && norm(d.ar) === norm(name)));

/** Where staff see the store's stock as low (store.lowStock, F105). */
export const lowStock = (c: SiteContent | null | undefined): number => int(c?.["store.lowStock"], 3, 1, 50);

/** The working days a complaint is answered in (store.complaintsDays, L12), or null when staff set none. */
export function complaintsDays(c: SiteContent | null | undefined): number | null {
  const v = c?.["store.complaintsDays"];
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 30 ? v : null;
}

// The legal identity (L01, L02): the site's own Legal line (content/pages/site.ts, keys site.legal.*), which staff edit
// in Payments > Settings and in the Website editor. The schema's defaults are the company's certificates (a test keeps
// these the same as site.ts's).
export const LEGAL_DEFAULTS = { legalName: { en: "Micromobility Company Ltd.", ar: "شركة التنقل الدقيق المحدودة" }, cr: "1009107240", vat: "312555068900003" };
const biText = (v: unknown, locale: string): string | null => {
  const o = obj(v);
  if (typeof o.en !== "string" || typeof o.ar !== "string") return null;
  const mine = (locale === "ar" ? o.ar : o.en).trim(), other = (locale === "ar" ? o.en : o.ar).trim();
  return (mine || other).slice(0, 160);
};
const monoText = (v: unknown): string | null => {
  const o = obj(v);
  return typeof o.en === "string" && typeof o.ar === "string" ? (o.en.trim() || o.ar.trim()).slice(0, 60) : null;
};

/** The seller as the footer (L01), the invoice (L06) and the SBC badge (L02) name it: "" for a value not set. The VAT
 *  number: a valid 15-digit one staff saved on the Legal line, else Settings > Business's, else the certificate's. */
export function storeLegal(c: SiteContent | null | undefined, locale: string): StoreLegal {
  const g = (k: string) => c?.[`site.legal.${k}`];
  const name = biText(g("legalName"), locale);
  const cr = monoText(g("cr"));
  const vatSaved = monoText(g("vat"));
  const biz = String(obj(c?.["biz.public"]).vat_no ?? "").trim(); // Settings > Business, as lib/biz.ts bizOf reads it
  const vat = vatSaved && /^\d{15}$/.test(vatSaved) ? vatSaved : /^\d{15}$/.test(biz) ? biz : LEGAL_DEFAULTS.vat;
  const sbc = obj(g("sbc")).href;
  return {
    // the name and the VAT number are never empty (the schema's fields are not optional); the CR is ("Empty hides it")
    legalName: name || LEGAL_DEFAULTS.legalName[locale === "ar" ? "ar" : "en"],
    cr: cr ?? LEGAL_DEFAULTS.cr,
    ecr: monoText(g("ecr")) ?? "",
    vat,
    sbc: typeof sbc === "string" && /^https:\/\/[^\s]+$/i.test(sbc.trim()) ? sbc.trim() : "",
  };
}
