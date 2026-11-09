import { deliveryFee, type PaySettings } from "./pay/settings";

// How an order reaches the customer (store.delivery, read by lib/pay/settings.ts): collected free at the
// showroom, delivered in Jeddah, or sent anywhere in Saudi Arabia by courier. A bike never goes by courier
// (store_products.ship_ksa false). Each way's fee is the one the database will charge (_store_delivery_fee),
// and its "days" ("1-2", "4-7") become the dates the order is expected on, counted in Riyadh from today
// without Fridays, when nothing is delivered.

export type Fulfil = "pickup" | "jeddah" | "ksa";
export const FULFILS: readonly Fulfil[] = ["pickup", "jeddah", "ksa"];

export type DeliveryOption = { id: Fulfil; fee: number; days: string | null };

/** The ways this cart can be had, with their fee at this subtotal: the ones staff have switched on, and
 *  the courier only when every product in the cart may be shipped. */
export function deliveryOptions(s: PaySettings, cart: { subtotal: number; shipKsa: boolean }): DeliveryOption[] {
  return FULFILS.flatMap((id) => {
    if (id === "ksa" && !cart.shipKsa) return [];
    const fee = deliveryFee(s, id, cart.subtotal);
    return fee === null ? [] : [{ id, fee, days: id === "pickup" ? null : s.delivery[id].days }];
  });
}

/** "1-2" -> [1, 2], "3" -> [3, 3]; null for anything else. */
export function daysOf(days: string | null | undefined): [number, number] | null {
  const m = /^\s*(\d{1,2})\s*(?:[-–—]\s*(\d{1,2}))?\s*$/.exec(days ?? "");
  if (!m) return null;
  const a = Number(m[1]), b = m[2] ? Number(m[2]) : a;
  return a >= 0 && b >= a && b <= 60 ? [a, b] : null;
}

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const isFriday = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay() === 5;

/** The day `n` working days after `from` (a YYYY-MM-DD in Riyadh): Fridays are not counted, and day 0 is
 *  `from` itself, moved on to Saturday when it is a Friday. */
export function workingDay(from: string, n: number): string {
  let d = from;
  while (isFriday(d)) d = addDays(d, 1);
  for (let i = 0; i < n; ) {
    d = addDays(d, 1);
    if (!isFriday(d)) i++;
  }
  return d;
}

/** The first and last day an order placed on `today` is expected on, for a way with these days; null when
 *  it names none (pickup) or they cannot be read. */
export function deliveryRange(days: string | null | undefined, today: string): { from: string; to: string } | null {
  const d = daysOf(days);
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return null;
  return { from: workingDay(today, d[0]), to: workingDay(today, d[1]) };
}

/** The two days written for the page's language: "Mon 17 – Thu 20 Nov" (the month once when both are in it),
 *  or one day when they are the same. */
export function fmtRange(r: { from: string; to: string }, intl: string): string {
  const full = new Intl.DateTimeFormat(intl, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const a = new Date(`${r.from}T12:00:00Z`), b = new Date(`${r.to}T12:00:00Z`);
  if (r.from === r.to) return full.format(a);
  const first = r.from.slice(0, 7) === r.to.slice(0, 7) ? new Intl.DateTimeFormat(intl, { weekday: "short", day: "numeric", timeZone: "UTC" }) : full;
  return `${first.format(a)} – ${full.format(b)}`;
}

/** How far the cart is from free delivery: null when there is no threshold; left 0 once it is reached. */
export function freeProgress(s: PaySettings, subtotal: number): { left: number; pct: number; over: number } | null {
  const over = s.delivery.freeOver;
  if (over === null || over <= 0) return null;
  const left = Math.max(0, Math.round((over - subtotal) * 100) / 100);
  return { left, pct: Math.min(100, Math.max(0, Math.round((subtotal / over) * 100))), over };
}

/** Today in Riyadh, YYYY-MM-DD, from the date's parts (an en-CA format() is not YYYY-MM-DD on every browser). */
export function riyadhToday(d: Date = new Date()): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
