import { outAt, reviewable, type IssuedGiftCard, type Order, type OrderItem, type OrderReturn, type ReturnReason, RETURN_REASONS } from "./store-order";
import { DEFAULT_SLOTS, type Slots } from "./store-settings";
import { zatcaQr } from "./zatca";

// After the order (the store build, 2026-11-15, chain w5): the rules an order's page draws by, kept here so the page and
// its tests agree. Out for delivery today (F96), the simplified tax invoice and its ZATCA QR (L06), what each way of
// paying paid, every refund and where it went (X09), the gift cards the order bought (F57), what can still be returned
// (F93) and reviewed (F94), the workshop's link (F51) and each line's own photo and address (X08). Nothing here reads
// anything, so the browser's components can use it too.

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** The Riyadh day (YYYY-MM-DD) of a moment; Riyadh is UTC+3 all year. */
export function riyadhDayOf(iso: string | null | undefined): string | null {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? new Date(t + 3 * 3600 * 1000).toISOString().slice(0, 10) : null;
}

/** Out for delivery, and it went out today in Riyadh (F96: "Out for delivery today"). */
export const outToday = (o: Pick<Order, "status" | "events">, today: string): boolean => {
  const at = outAt(o);
  return !!at && riyadhDayOf(at) === today;
};

/** The key of the words for a status of this order: a pickup delivered is collected, a gift card alone delivered is ready
 *  to use, out for delivery says "today" on the day it went out (the order's own state only, never a past event). */
export function statusKey(o: Pick<Order, "status" | "fulfil" | "events">, st: string, today: string | null = null): string {
  if (st === "delivered") return o.fulfil === "pickup" ? "collected" : o.fulfil === "digital" ? "giftReady" : "delivered";
  if (st === "out") return today && o.status === "out" && outToday(o, today) ? "outToday" : "out";
  return st;
}

// ── The simplified tax invoice (L06) ──────────────────────────────────────────────────────────────

/** Whether the order's invoice has been issued: it was paid (an order never paid has none, and no invoice number). */
export const invoiceIssued = (o: Pick<Order, "paid_at" | "status">): boolean => !!o.paid_at && o.status !== "pending";

/** The invoice's number: the store's own series ("INV-000001"), else, from a database that does not give one yet, the
 *  receipt number it carried until now. */
export const invoiceNumber = (o: Pick<Order, "invoice_no" | "receipt_no">): string | null =>
  o.invoice_no ?? (o.receipt_no != null ? String(o.receipt_no) : null);

/** The invoice's ZATCA phase 1 QR text (seller, VAT number, the time it was paid, the total with VAT, the VAT), once it
 *  is issued and the VAT number is a real one (15 digits); null otherwise. */
export function invoiceQr(o: Pick<Order, "paid_at" | "status" | "total" | "vat">, seller: { name: string; vat: string }): string | null {
  if (!invoiceIssued(o) || !o.paid_at || !seller.name.trim() || !/^\d{15}$/.test(seller.vat)) return null;
  return zatcaQr({ seller: seller.name.trim(), vat: seller.vat, at: o.paid_at, total: o.total, vatAmount: o.vat });
}

/** What each way of paying paid: a gift card first, then the wallet, the card the rest (CONTRACTS.md section 3.1). */
export function paidParts(o: Pick<Order, "total" | "gift_paid" | "wallet_paid">): { gift: number; wallet: number; card: number } {
  const gift = Math.max(0, r2(o.gift_paid)), wallet = Math.max(0, r2(o.wallet_paid));
  return { gift, wallet, card: Math.max(0, r2(o.total - gift - wallet)) };
}

/** The invoice's discount rows: each bundle price and code the order had, or one row when the database names none. */
export function discountRows(o: Pick<Order, "discount" | "discounts">): { kind: "bundle" | "promo" | "other"; ref: string; amount: number }[] {
  const rows = o.discounts.filter((d) => d.amount > 0).map((d) => ({ kind: d.kind, ref: d.ref, amount: r2(d.amount) }));
  if (rows.length) return rows;
  return o.discount > 0 ? [{ kind: "other", ref: "", amount: r2(o.discount) }] : [];
}

// ── Refunds (X09) ────────────────────────────────────────────────────────────────────────────────

export type RefundDest = "card" | "wallet" | "gift" | "other";
export type RefundRow = { amount: number; dest: RefundDest; state: "pending" | "done"; at: string };
const dest = (d: string): RefundDest => (d === "card" || d === "wallet" || d === "gift" ? d : "other");

/** The refunds the customer is shown, oldest first: sent (on its way) or done, each with where it went. One staff still
 *  owe, or that failed, is staff's to finish and not shown. */
export function refundRows(o: Pick<Order, "refunds">): RefundRow[] {
  return o.refunds
    .filter((r) => r.amount > 0 && (r.status === "pending" || r.status === "done"))
    .map((r) => ({ amount: r2(r.amount), dest: dest(r.dest), state: r.status as "pending" | "done", at: r.at }))
    .sort((a, b) => (Date.parse(a.at) || 0) - (Date.parse(b.at) || 0));
}

// ── The order's history ──────────────────────────────────────────────────────────────────────────

/** The words of a history event: a return's or an exchange's own (the database notes which), else its status's. */
export function eventKey(o: Pick<Order, "fulfil" | "status" | "events">, e: { status: string; note: string | null }): string {
  const m = /^return_(requested|approved|refused)$/.exec(e.status);
  if (m) return `${e.note === "exchange" ? "exchange" : "return"}_${m[1]}`;
  return statusKey(o, e.status);
}

export type EventNote = { kind: "text"; text: string } | { kind: "wallet" } | { kind: "refund"; amount: number; dest: RefundDest } | null;
/** What a history event's note says, in the page's words: the database's own marks (paid from the wallet, a gift card,
 *  not paid in time, a return's kind) are said by the event itself, a refund's "120 SAR · wallet" is an amount and where
 *  it went; anything else staff wrote is shown as written. */
export function eventNote(e: { status: string; note: string | null }): EventNote {
  const n = (e.note ?? "").trim();
  if (!n) return null;
  if (n === "wallet") return { kind: "wallet" };
  if (["gift_card", "unpaid", "return", "exchange"].includes(n)) return null;
  const m = /^(\d+(?:\.\d+)?) SAR(?: · (wallet|gift card))?$/.exec(n);
  if (m) return { kind: "refund", amount: r2(Number(m[1])), dest: m[2] === "wallet" ? "wallet" : m[2] === "gift card" ? "gift" : "card" };
  return { kind: "text", text: n };
}

// ── Lines, gift cards, the delivery day ─────────────────────────────────────────────────────────

/** A line's own address (X08: the slug kept when it was sold, so a product renamed or deleted later keeps it); a gift
 *  card's is the gift card page. */
export const lineHref = (i: Pick<OrderItem, "slug" | "gift_card">): string | null =>
  i.gift_card ? "/store/gift-card" : i.slug ? `/store/${i.slug}` : null;

export type GiftState = "active" | "void" | "expired" | "spent";
/** Where a gift card the order bought stands: cancelled by staff, past its expiry (a year after it was issued), used up,
 *  or still to spend. */
export function giftState(g: { status: string; balance: number; expires_at: string | null }, now: number): GiftState {
  if (g.status === "void") return "void";
  const exp = g.expires_at ? Date.parse(g.expires_at) : NaN;
  if (Number.isFinite(exp) && exp <= now) return "expired";
  return g.balance <= 0 ? "spent" : "active";
}

/** Each gift card's whole code to show, copy and print, in the order the page lists them: its own when the page has it
 *  whole, else the one the buyer's gift key read (store_order_get, the same order of cards) when that is whole and ends as
 *  the masked one does, else null (the page shows the masked code, and nothing to copy or print). */
export function wholeCodes(shown: readonly Pick<IssuedGiftCard, "code" | "masked" | "amount">[], got: readonly Pick<IssuedGiftCard, "code" | "masked" | "amount">[] | null): (string | null)[] {
  return shown.map((g, i) => {
    if (!g.masked) return g.code;
    const w = got?.[i];
    return w && !w.masked && w.amount === g.amount && w.code.slice(-4) === g.code.slice(-4) ? w.code : null;
  });
}

/** The delivery day and hours a scheduled Jeddah order was booked for (F78), with the hours of the slot staff offer (or
 *  the default ones); null when it has none. */
export function slotWhen(o: Pick<Order, "slot" | "fulfil">, slots: Slots | null): { day: string; from: string | null; to: string | null } | null {
  if (!o.slot || o.fulfil !== "jeddah") return null;
  const t = (slots?.times ?? []).find((x) => x.id === o.slot!.time) ?? DEFAULT_SLOTS.times.find((x) => x.id === o.slot!.time);
  return { day: o.slot.day, from: t?.from ?? null, to: t?.to ?? null };
}

/** The workshop's "Book a Service" (F51): on an order of goods once it is paid, while the workshop page is switched on. */
export const serviceShown = (o: Pick<Order, "fulfil" | "status">, hidden: readonly string[]): boolean =>
  !hidden.includes("workshop") && o.fulfil !== "digital" && ["paid", "preparing", "ready", "shipped", "out", "delivered"].includes(o.status);

// ── Returns (F93) ────────────────────────────────────────────────────────────────────────────────

export type ReturnLine = { id: number; name: string; variant: string | null; image: string | null; max: number };
/** The lines a return or an exchange can name: not gift cards, each up to what was bought less what a return staff
 *  approved already took back. */
export function returnableLines(o: Pick<Order, "items" | "returns">): ReturnLine[] {
  const back = new Map<number, number>();
  for (const r of o.returns) if (r.status === "approved" && r.kind === "return") for (const x of r.items) back.set(x.item_id, (back.get(x.item_id) ?? 0) + x.qty);
  return o.items
    .filter((i): i is OrderItem & { id: number } => i.id !== null && !i.gift_card)
    .map((i) => ({ id: i.id, name: i.name, variant: i.variant, image: i.image, max: Math.max(0, i.qty - (back.get(i.id) ?? 0)) }))
    .filter((l) => l.max > 0);
}

export type ReturnPick = { kind: "return" | "exchange" | null; items: Record<number, number>; reason: ReturnReason | null; note: string };
export type ReturnBody = { no: number; key: string; kind: "return" | "exchange"; items: { item: number; qty: number }[]; reason: ReturnReason; note: string };
/** The request the pop-up sends (POST /api/store/return) for the order's returnable lines, or null until a kind, at least
 *  one line and a reason are picked. A quantity is kept within what the line can still take. */
export function returnBody(a: { no: number; key: string | null; lines: readonly ReturnLine[] }, p: ReturnPick): ReturnBody | null {
  if (!a.key || !p.kind || !p.reason || !(RETURN_REASONS as readonly string[]).includes(p.reason)) return null;
  const items = a.lines.filter((l) => (p.items[l.id] ?? 0) > 0).map((l) => ({ item: l.id, qty: Math.min(l.max, Math.max(1, Math.floor(p.items[l.id]))) }));
  if (!items.length) return null;
  return { no: a.no, key: a.key, kind: p.kind, items, reason: p.reason, note: p.note.trim().slice(0, 300) };
}

/** A request's lines in words: "DA54 · M · Black × 1". */
export function returnLines(o: Pick<Order, "items">, r: Pick<OrderReturn, "items">): string[] {
  return r.items.map((x) => {
    const i = o.items.find((l) => l.id === x.item_id);
    return i ? `${[i.name, i.variant].filter(Boolean).join(" · ")} × ${x.qty}` : "";
  }).filter(Boolean);
}

// ── Reviews (F94) ────────────────────────────────────────────────────────────────────────────────

/** The products a review is asked for (delivered, not gift cards, not reviewed yet), each with its line's name and photo. */
export function reviewItems(o: Pick<Order, "status" | "items">): { product: string; name: string; image: string | null }[] {
  return reviewable(o).map((pid) => {
    const i = o.items.find((l) => l.product_id === pid)!;
    return { product: pid, name: i.name, image: i.image };
  });
}
