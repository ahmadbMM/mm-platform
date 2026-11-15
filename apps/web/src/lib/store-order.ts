import { deliveryRange } from "./store-delivery";
import type { PaySettings } from "./pay/settings";

// A store order as its page shows it (store_order_get / store_order_track / customer_orders, which answer
// _store_order_json of rentals migration 20261110150000): its state, where it is on the way, how it was
// paid and when it is expected. The customer's own copy: the phone masked, the address only its city and
// district, and only the events staff marked public.

// The store build (2026-11-15, rentals migration 20261115200100; CONTRACTS.md section 3) added: out for delivery (F96), a
// gift card alone ("digital", F57), discounts (bundle F31, code F67), what a gift card paid, the gift note (F58), the
// delivery slot (F78), the day it was delivered, returns asked for (F93), the gift cards it bought, each line's own
// photo and address (X08) and whether it was reviewed (F94), and every refund with where it went (X09).
export type OrderStatus = "pending" | "paid" | "preparing" | "ready" | "shipped" | "out" | "delivered" | "cancelled" | "refunded";
export type OrderFulfil = "pickup" | "jeddah" | "ksa" | "digital";
export type OrderItem = {
  id: number | null; name: string; variant: string | null; qty: number; unit_price: number; product_id: string | null; variant_id: string | null;
  image: string | null; slug: string | null; gift_card: boolean; reviewed: boolean;
};
export type OrderDiscount = { kind: "bundle" | "promo"; ref: string; amount: number };
export const RETURN_REASONS = ["wrong_size", "changed_mind", "damaged", "not_as_described", "other"] as const;
export type ReturnReason = (typeof RETURN_REASONS)[number];
export type OrderReturn = {
  id: string; kind: "return" | "exchange"; status: "open" | "approved" | "refused"; items: { item_id: number; qty: number }[];
  reason: ReturnReason; note: string | null; amount: number | null; created_at: string; decided_at: string | null;
};
/** expires_at: a year after it was issued (the owner, 2026-11-15; CONTRACTS.md Additions by lead 3), null from a database
 *  that does not say yet. */
export type IssuedGiftCard = { code: string; amount: number; balance: number; status: "active" | "void"; expires_at: string | null };
/** dest: "card", "wallet" or "gift" (back onto the gift card that paid). */
export type OrderRefund = { amount: number; dest: string; status: string; at: string };
export type OrderPayment = { id: string; status: string; method: string | null; brand: string | null; last4: string | null; receipt_no: number | null; expires_at: string; paid_at: string | null; amount: number };
export type Order = {
  id: string; no: number; key: string | null; status: OrderStatus; fulfil: OrderFulfil; name: string; phone: string;
  address: { city?: string; district?: string } | null;
  subtotal: number; delivery_fee: number; total: number; wallet_paid: number; vat: number;
  courier: string | null; tracking_no: string | null; expires_at: string | null; paid_at: string | null; created_at: string; cancel_reason: string | null;
  /** The order's receipt number (receipt_numbers 'ord-<no>'), also for an order the wallet paid whole. */
  receipt_no: number | null;
  /** The store invoice's own number, "INV-000001", given when the order is paid (L06; CONTRACTS.md Additions by lead 4
   *  and by db 2: the JSON's `invoice`, or its number `invoice_no`); null before, and from a database that does not give
   *  it yet. */
  invoice_no: string | null;
  payment_id: string | null; payment: OrderPayment | null; items: OrderItem[];
  events: { at: string; status: string; note: string | null }[];
  refunds: OrderRefund[];
  /** subtotal - discount + delivery_fee = total; the card pays total - gift_paid - wallet_paid. */
  discount: number; discounts: OrderDiscount[]; promo_code: string | null; gift_paid: number;
  gift: boolean; gift_note: string | null; slot: { day: string; time: string } | null;
  /** The first "delivered" event: returns are counted from it (F93). */
  delivered_at: string | null;
  returns: OrderReturn[]; gift_cards: IssuedGiftCard[];
};

const STATUSES: readonly string[] = ["pending", "paid", "preparing", "ready", "shipped", "out", "delivered", "cancelled", "refunded"];
const FULFILS: readonly string[] = ["pickup", "jeddah", "ksa", "digital"];
const n = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : 0) || 0;
const s = (v: unknown) => (typeof v === "string" && v ? v : null);
const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : []);

/** The database's answer as an order, or null for anything else. */
export function orderOf(data: unknown, key: string | null = null): Order | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const no = n(o.no);
  if (!no || !STATUSES.includes(String(o.status)) || !FULFILS.includes(String(o.fulfil))) return null;
  const p = o.payment && typeof o.payment === "object" ? (o.payment as Record<string, unknown>) : null;
  const a = o.address && typeof o.address === "object" ? (o.address as Record<string, unknown>) : null;
  return {
    id: String(o.id ?? ""), no, key: s(o.key) ?? key, status: o.status as OrderStatus, fulfil: o.fulfil as Order["fulfil"], name: String(o.name ?? ""), phone: String(o.phone ?? ""),
    address: a ? { city: s(a.city) ?? undefined, district: s(a.district) ?? undefined } : null,
    subtotal: n(o.subtotal), delivery_fee: n(o.delivery_fee), total: n(o.total), wallet_paid: n(o.wallet_paid), vat: n(o.vat),
    courier: s(o.courier), tracking_no: s(o.tracking_no), expires_at: s(o.expires_at), paid_at: s(o.paid_at), created_at: String(o.created_at ?? ""),
    receipt_no: o.receipt_no == null ? (p?.receipt_no == null ? null : n(p.receipt_no)) : n(o.receipt_no),
    invoice_no: invoiceNoOf(o.invoice) ?? invoiceNoOf(o.invoice_no),
    cancel_reason: s(o.cancel_reason), payment_id: s(o.payment_id),
    payment: p ? { id: String(p.id ?? ""), status: String(p.status ?? ""), method: s(p.method), brand: s(p.brand), last4: s(p.last4),
      receipt_no: p.receipt_no == null ? null : n(p.receipt_no), expires_at: String(p.expires_at ?? ""), paid_at: s(p.paid_at), amount: n(p.amount) } : null,
    items: arr(o.items).map((i) => ({
      id: i.id == null || !Number.isFinite(Number(i.id)) ? null : Number(i.id), name: String(i.name ?? ""), variant: s(i.variant), qty: n(i.qty),
      unit_price: n(i.unit_price), product_id: s(i.product_id), variant_id: s(i.variant_id), image: s(i.image), slug: s(i.slug),
      gift_card: i.gift_card === true, reviewed: i.reviewed === true,
    })),
    events: arr(o.events).map((e) => ({ at: String(e.at ?? ""), status: String(e.status ?? ""), note: s(e.note) })),
    refunds: arr(o.refunds).map((r) => ({ amount: n(r.amount), dest: String(r.dest ?? ""), status: String(r.status ?? ""), at: String(r.at ?? "") })),
    discount: n(o.discount),
    discounts: arr(o.discounts).filter((d) => d.kind === "bundle" || d.kind === "promo").map((d) => ({ kind: d.kind as OrderDiscount["kind"], ref: String(d.ref ?? ""), amount: n(d.amount) })),
    promo_code: s(o.promo_code), gift_paid: n(o.gift_paid), gift: o.gift === true, gift_note: s(o.gift_note),
    slot: slotOf(o.slot), delivered_at: s(o.delivered_at),
    returns: arr(o.returns).map(returnOf).filter((r): r is OrderReturn => !!r),
    gift_cards: arr(o.gift_cards).filter((g) => typeof g.code === "string" && g.code).map((g) => ({
      code: String(g.code), amount: n(g.amount), balance: n(g.balance), status: g.status === "void" ? "void" : "active", expires_at: s(g.expires_at) })),
  };
}

/** The invoice number as the database writes it ("INV-000042", its `invoice`), or its number (`invoice_no`) written that way. */
function invoiceNoOf(v: unknown): string | null {
  if (typeof v === "number" && Number.isInteger(v) && v > 0) return `INV-${String(v).padStart(6, "0")}`;
  return typeof v === "string" && /^INV-\d{6,}$/.test(v.trim()) ? v.trim() : null;
}

function slotOf(v: unknown): { day: string; time: string } | null {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  return o && typeof o.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.day) && typeof o.time === "string" && o.time ? { day: o.day, time: o.time } : null;
}

function returnOf(r: Record<string, unknown>): OrderReturn | null {
  const status = r.status === "approved" || r.status === "refused" ? r.status : r.status === "open" ? "open" : null;
  if (!s(r.id) || !status) return null;
  const reason = (RETURN_REASONS as readonly string[]).includes(String(r.reason)) ? (r.reason as ReturnReason) : "other";
  return {
    id: String(r.id), kind: r.kind === "exchange" ? "exchange" : "return", status,
    items: arr(r.items).map((x) => ({ item_id: n(x.item_id), qty: n(x.qty) })).filter((x) => x.item_id > 0 && x.qty > 0),
    reason, note: s(r.note), amount: r.amount == null ? null : n(r.amount), created_at: String(r.created_at ?? ""), decided_at: s(r.decided_at),
  };
}

/** "MM-1001". */
export const orderNo = (no: number) => `MM-${no}`;

/** The steps an order goes through, for its kind: paid, preparing, ready (pickup) or on its way, then
 *  collected or delivered. `at` is the index of the step it has reached, -1 before it is paid; null when it
 *  left the way (cancelled, refunded). */
export function orderSteps(o: Pick<Order, "status" | "fulfil">): { steps: string[]; at: number | null } {
  if (o.fulfil === "digital") {
    // a gift card alone: paid, then delivered at once (its code is on the order's page)
    const at: Record<string, number> = { pending: -1, paid: 0, preparing: 0, delivered: 1 };
    return { steps: ["paid", "delivered"], at: o.status in at ? at[o.status] : null };
  }
  const pickup = o.fulfil === "pickup";
  // out for delivery (F96) takes the place of "shipped" on the third step
  const steps = ["paid", "preparing", pickup ? "ready" : o.status === "out" ? "out" : "shipped", pickup ? "collected" : "delivered"];
  const at: Record<string, number> = { pending: -1, paid: 0, preparing: 1, ready: 2, shipped: 2, out: 2, delivered: 3 };
  return { steps, at: o.status in at ? at[o.status] : null };
}

/** When the order went out for delivery, if it is out now (F96): the "out" event's time, for "Out for delivery today". */
export const outAt = (o: Pick<Order, "status" | "events">): string | null =>
  o.status === "out" ? [...o.events].reverse().find((e) => e.status === "out")?.at ?? null : null;

/** The products of this order a review can still be left for (F94): delivered, not a gift card, not yet reviewed; one
 *  id per product. */
export function reviewable(o: Pick<Order, "status" | "items">): string[] {
  if (o.status !== "delivered") return [];
  return [...new Set(o.items.filter((i) => i.product_id && !i.gift_card && !i.reviewed).map((i) => i.product_id as string))];
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
  if (o.fulfil === "pickup" || o.fulfil === "digital" || !["paid", "preparing", "shipped", "out"].includes(o.status)) return null;
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
