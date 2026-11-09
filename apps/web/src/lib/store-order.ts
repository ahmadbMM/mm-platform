import { deliveryRange } from "./store-delivery";
import type { PaySettings } from "./pay/settings";

// A store order as its page shows it (store_order_get / store_order_track / customer_orders, which answer
// _store_order_json of rentals migration 20261110150000): its state, where it is on the way, how it was
// paid and when it is expected. The customer's own copy: the phone masked, the address only its city and
// district, and only the events staff marked public.

export type OrderStatus = "pending" | "paid" | "preparing" | "ready" | "shipped" | "delivered" | "cancelled" | "refunded";
export type OrderItem = { name: string; variant: string | null; qty: number; unit_price: number; variant_id: string | null; image: string | null; slug: string | null };
export type OrderPayment = { id: string; status: string; method: string | null; brand: string | null; last4: string | null; receipt_no: number | null; expires_at: string; paid_at: string | null; amount: number };
export type Order = {
  id: string; no: number; key: string | null; status: OrderStatus; fulfil: "pickup" | "jeddah" | "ksa"; name: string; phone: string;
  address: { city?: string; district?: string } | null;
  subtotal: number; delivery_fee: number; total: number; wallet_paid: number; vat: number;
  courier: string | null; tracking_no: string | null; expires_at: string | null; paid_at: string | null; created_at: string; cancel_reason: string | null;
  payment_id: string | null; payment: OrderPayment | null; items: OrderItem[];
  events: { at: string; status: string; note: string | null }[];
  refunds: { amount: number; dest: string; status: string; at: string }[];
};

const STATUSES: readonly string[] = ["pending", "paid", "preparing", "ready", "shipped", "delivered", "cancelled", "refunded"];
const n = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : 0) || 0;
const s = (v: unknown) => (typeof v === "string" && v ? v : null);
const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : []);

/** The database's answer as an order, or null for anything else. */
export function orderOf(data: unknown, key: string | null = null): Order | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const no = n(o.no);
  if (!no || !STATUSES.includes(String(o.status)) || !["pickup", "jeddah", "ksa"].includes(String(o.fulfil))) return null;
  const p = o.payment && typeof o.payment === "object" ? (o.payment as Record<string, unknown>) : null;
  const a = o.address && typeof o.address === "object" ? (o.address as Record<string, unknown>) : null;
  return {
    id: String(o.id ?? ""), no, key: s(o.key) ?? key, status: o.status as OrderStatus, fulfil: o.fulfil as Order["fulfil"], name: String(o.name ?? ""), phone: String(o.phone ?? ""),
    address: a ? { city: s(a.city) ?? undefined, district: s(a.district) ?? undefined } : null,
    subtotal: n(o.subtotal), delivery_fee: n(o.delivery_fee), total: n(o.total), wallet_paid: n(o.wallet_paid), vat: n(o.vat),
    courier: s(o.courier), tracking_no: s(o.tracking_no), expires_at: s(o.expires_at), paid_at: s(o.paid_at), created_at: String(o.created_at ?? ""),
    cancel_reason: s(o.cancel_reason), payment_id: s(o.payment_id),
    payment: p ? { id: String(p.id ?? ""), status: String(p.status ?? ""), method: s(p.method), brand: s(p.brand), last4: s(p.last4),
      receipt_no: p.receipt_no == null ? null : n(p.receipt_no), expires_at: String(p.expires_at ?? ""), paid_at: s(p.paid_at), amount: n(p.amount) } : null,
    items: arr(o.items).map((i) => ({ name: String(i.name ?? ""), variant: s(i.variant), qty: n(i.qty), unit_price: n(i.unit_price), variant_id: s(i.variant_id), image: s(i.image), slug: s(i.slug) })),
    events: arr(o.events).map((e) => ({ at: String(e.at ?? ""), status: String(e.status ?? ""), note: s(e.note) })),
    refunds: arr(o.refunds).map((r) => ({ amount: n(r.amount), dest: String(r.dest ?? ""), status: String(r.status ?? ""), at: String(r.at ?? "") })),
  };
}

/** "MM-1001". */
export const orderNo = (no: number) => `MM-${no}`;

/** The steps an order goes through, for its kind: paid, preparing, ready (pickup) or on its way, then
 *  collected or delivered. `at` is the index of the step it has reached, -1 before it is paid; null when it
 *  left the way (cancelled, refunded). */
export function orderSteps(o: Pick<Order, "status" | "fulfil">): { steps: string[]; at: number | null } {
  const pickup = o.fulfil === "pickup";
  const steps = ["paid", "preparing", pickup ? "ready" : "shipped", pickup ? "collected" : "delivered"];
  const at: Record<string, number> = { pending: -1, paid: 0, preparing: 1, ready: 2, shipped: 2, delivered: 3 };
  return { steps, at: o.status in at ? at[o.status] : null };
}

/** Whether "Pay now" still has a payment to go to: unpaid, and its hold not over. */
export const payable = (o: Order, now: number) =>
  o.status === "pending" && !!o.payment && o.payment.status === "initiated" && Date.parse(o.payment.expires_at) > now;

/** "Report a mistake in this order" is offered for a day after it was placed. */
export const reportable = (o: Pick<Order, "created_at" | "status">, now: number) =>
  o.status !== "pending" && now - Date.parse(o.created_at) < 24 * 3600 * 1000;

/** Never paid and cancelled (its hold ran out): its items can go back into the cart. */
export const unpaidCancel = (o: Order) => o.status === "cancelled" && !o.paid_at;

/** The days a delivery is expected, counted from the day it was paid (else placed) in Riyadh; null for a
 *  pickup, an order already delivered or no longer on its way. */
export function orderExpected(o: Order, s: PaySettings): { from: string; to: string } | null {
  if (o.fulfil === "pickup" || !["paid", "preparing", "shipped"].includes(o.status)) return null;
  const from = o.paid_at ?? o.created_at;
  const d = Date.parse(from);
  if (!Number.isFinite(d)) return null;
  const day = new Date(d + 3 * 3600 * 1000).toISOString().slice(0, 10); // Riyadh is UTC+3 all year
  return deliveryRange(s.delivery[o.fulfil].days, day);
}

/** How it was paid, as the receipt says it: "mada •••• 1234", "Apple Pay", or null when not by card. */
export function paidWith(p: OrderPayment | null): string | null {
  if (!p || !["paid", "refunded", "partly_refunded"].includes(p.status)) return null;
  const brands: Record<string, string> = { mada: "mada", visa: "Visa", master: "Mastercard", mastercard: "Mastercard", amex: "American Express" };
  const methods: Record<string, string> = { applepay: "Apple Pay", stcpay: "STC Pay", samsungpay: "Samsung Pay" };
  const brand = p.brand ? brands[p.brand.toLowerCase()] ?? p.brand : null;
  const method = p.method ? methods[p.method.toLowerCase()] ?? null : null;
  const name = [method, brand].filter(Boolean).join(" · ") || null;
  return name ? `${name}${p.last4 ? ` •••• ${p.last4}` : ""}` : p.last4 ? `•••• ${p.last4}` : null;
}
