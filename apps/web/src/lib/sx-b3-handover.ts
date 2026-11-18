import type { SiteContent } from "./site";
import type { SlotTime } from "./store-settings";

// Handover slots for "Collect fully built" (N13, 2026-11-18) and the Ramadan evening hours (N36). A bike collected at
// the showroom can be booked into a 20-minute handover (a mechanic sets the saddle, fits the pedals, shows the gears and
// the tyre pressure), on the days it can be collected, in hours staff set (store.handover); during Ramadan the hours
// and the Jeddah delivery windows are the evening ones staff set (store.ramadan), for example 21:00-01:00. The database
// says which slots are free (store_handover_slots, rentals; SX/results/B3.md has the contract the buy box shares) and
// checks the one picked again when the order is placed. Nothing here reads anything: the buy box and checkout use it.

export const HANDOVER_KEY = "mm-handover";
export type HandoverSlot = { at: string; to: string; open: boolean };
export type HandoverDay = { day: string; slots: HandoverSlot[] };
export type Handover = { on: boolean; minutes: number; days: HandoverDay[] };
export type HandoverPick = { day: string; at: string };
export const HANDOVER_OFF: Handover = { on: false, minutes: 20, days: [] };

const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** store_handover_slots' answer (or the route's, which passes it on): anything malformed reads as off. */
export function handoverOf(raw: unknown): Handover {
  const o = obj(raw);
  if (o.on !== true || !Array.isArray(o.days)) return HANDOVER_OFF;
  const minutes = typeof o.minutes === "number" && Number.isInteger(o.minutes) && o.minutes >= 10 && o.minutes <= 60 ? o.minutes : 20;
  const days: HandoverDay[] = [];
  for (const d of o.days.slice(0, 14).map(obj)) {
    if (typeof d.day !== "string" || !DAY.test(d.day) || !Array.isArray(d.slots)) continue;
    const slots = d.slots.slice(0, 96).map(obj)
      .filter((s) => typeof s.at === "string" && HM.test(s.at) && typeof s.to === "string" && HM.test(s.to))
      .map((s) => ({ at: s.at as string, to: s.to as string, open: s.open === true }));
    if (slots.length) days.push({ day: d.day, slots });
  }
  return days.length ? { on: true, minutes, days } : HANDOVER_OFF;
}

/** A slot picked (the buy box's sessionStorage, the checkout's draft, a quote), or null. */
export function handoverPickOf(raw: unknown): HandoverPick | null {
  const o = obj(raw);
  return typeof o.day === "string" && DAY.test(o.day) && typeof o.at === "string" && HM.test(o.at) ? { day: o.day, at: o.at } : null;
}

/** The slot a pick names while it is still offered and free, else null. */
export function pickOpen(h: Handover, p: HandoverPick | null): HandoverSlot | null {
  if (!p || !h.on) return null;
  const s = h.days.find((d) => d.day === p.day)?.slots.find((x) => x.at === p.at);
  return s && s.open ? s : null;
}

/** The days that still have a free slot. */
export const openDays = (h: Handover): HandoverDay[] => h.days.filter((d) => d.slots.some((s) => s.open));

/** "16:00" in the page's language ("4:00 م"). */
export function clock(hm: string, intl: string): string {
  const [h, m] = hm.split(":").map(Number);
  return new Intl.DateTimeFormat(intl, { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(Date.UTC(2000, 0, 1, h, m));
}

// ── Ramadan's evening hours (N36) ───────────────────────────────────────────────────────────────────

/** A window of hours; a `to` at or before `from` runs past midnight (21:00-01:00). */
export type Hours = { from: string; to: string };
export type Season = { from: string; to: string; times: SlotTime[]; hours: Hours[] };

const hoursOk = (h: Record<string, unknown>) => typeof h.from === "string" && HM.test(h.from) && typeof h.to === "string" && HM.test(h.to) && h.from !== h.to;

/** store.ramadan, or null while it is off or malformed: on, a first and last day (45 days at most) and at least one
 *  delivery window (`times`, ids like the usual ones) or handover hours (`hours`). */
export function ramadanOf(c: SiteContent | null | undefined): Season | null {
  const o = obj(c?.["store.ramadan"]);
  if (o.on !== true || typeof o.from !== "string" || typeof o.to !== "string" || !DAY.test(o.from) || !DAY.test(o.to) || o.to < o.from) return null;
  const span = (Date.parse(`${o.to}T12:00:00Z`) - Date.parse(`${o.from}T12:00:00Z`)) / 86400000;
  if (!(span >= 0 && span <= 45)) return null;
  const times = (Array.isArray(o.times) ? o.times : []).map(obj)
    .filter((t) => typeof t.id === "string" && /^[a-z0-9]{1,12}$/.test(t.id) && hoursOk(t))
    .slice(0, 4).map((t) => ({ id: t.id as string, from: t.from as string, to: t.to as string }));
  const hours = (Array.isArray(o.hours) ? o.hours : []).map(obj).filter(hoursOk).slice(0, 4).map((t) => ({ from: t.from as string, to: t.to as string }));
  return times.length || hours.length ? { from: o.from, to: o.to, times, hours } : null;
}

/** Whether a day (YYYY-MM-DD) is one of the season's. */
export const inSeason = (s: { from: string; to: string } | null | undefined, day: string): boolean => !!s && day >= s.from && day <= s.to;
