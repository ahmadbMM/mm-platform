import type { SiteContent } from "@/lib/site";

// The payment and store settings staff control (site_content pay.* and store.*, rentals migration
// 20261110150000), read the way the database reads them (_pay_int / _pay_on): out of range or missing reads
// as the default. The database decides with its own copy; the pages only use these to say the same thing.

export type Delivery = { on: boolean; fee: number; days: string | null };
export type PaySettings = {
  enabled: boolean;
  /** Paid rides on the website: paid now (the place held meanwhile), the rider's choice, or at the desk only. */
  bookings: "required" | "optional" | "off";
  holdMinutes: number;
  refundDays: number;
  topup: boolean;
  topupMin: number;
  topupMax: number;
  storeOpen: boolean;
  orderMinutes: number;
  delivery: { pickup: Delivery; jeddah: Delivery; ksa: Delivery; freeOver: number | null };
};

const int = (v: unknown, d: number, lo: number, hi: number) => (typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : d);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const deliv = (v: unknown, fee: number): Delivery => {
  const o = obj(v);
  const f = typeof o.fee === "number" && o.fee >= 0 && o.fee <= 1000 ? o.fee : fee;
  return { on: o.on === true, fee: f, days: typeof o.days === "string" && o.days.trim() ? o.days.trim().slice(0, 20) : null };
};

export function paySettings(c: SiteContent | null | undefined): PaySettings {
  const g = (k: string) => c?.[k];
  const b = g("pay.bookings");
  const d = obj(g("store.delivery"));
  const free = typeof d.freeOver === "number" && d.freeOver > 0 ? d.freeOver : null;
  return {
    enabled: g("pay.enabled") === true,
    bookings: b === "optional" || b === "off" ? b : "required",
    holdMinutes: int(g("pay.holdMinutes"), 15, 5, 60),
    refundDays: int(g("pay.refundDays"), 1, 0, 30),
    topup: g("pay.topup") === true,
    topupMin: int(g("pay.topupMin"), 20, 1, 5000),
    topupMax: int(g("pay.topupMax"), 1000, 1, 10000),
    storeOpen: g("store.open") === true,
    orderMinutes: int(g("store.orderMinutes"), 30, 10, 120),
    delivery: { pickup: { on: true, fee: 0, days: null }, jeddah: deliv(d.jeddah, 30), ksa: deliv(d.ksa, 45), freeOver: free },
  };
}

/** The delivery fee the database will charge (_store_delivery_fee): null when that way is off. */
export function deliveryFee(s: PaySettings, fulfil: "pickup" | "jeddah" | "ksa", subtotal: number): number | null {
  if (fulfil === "pickup") return 0;
  const d = s.delivery[fulfil];
  if (!d.on) return null;
  if (s.delivery.freeOver != null && subtotal >= s.delivery.freeOver) return 0;
  return d.fee;
}

/** Whether a booking on this ride is cancelled in time for a refund (pay_booking_cancel): at least
 *  refundDays before the ride day, by the date in Riyadh. */
export function refundable(rideDate: string, todayRiyadh: string, refundDays: number): boolean {
  const d = Date.parse(`${rideDate}T00:00:00Z`), t = Date.parse(`${todayRiyadh}T00:00:00Z`);
  if (!Number.isFinite(d) || !Number.isFinite(t)) return false;
  return t + refundDays * 86400000 <= d;
}
