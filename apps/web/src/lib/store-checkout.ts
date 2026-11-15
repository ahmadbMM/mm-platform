import { bundleDiscount, MAX_QTY, subtotalOf, type CartItem, type CartLine } from "./cart";
import { deliveryFee, type PaySettings } from "./pay/settings";
import { optionsOf, productStock, relatedOf, type StoreProduct, type StoreVariant } from "./store-core";
import { fmtRange, type Fulfil } from "./store-delivery";
import { formProblems, latinDigits, storePhone, type Address, type Contact } from "./store-form";
import { districtServed, slotOk, type District, type Slots, type SlotTime } from "./store-settings";

// The cart and checkout's rules (store build 2026-11-15, chain w4; CONTRACTS.md sections 5.1 and 7): checkout in steps
// that close into a summary (O12-C), the checks a field gets as it is left (F77), what the order costs once a starter
// set, a code, a gift card and the wallet have taken their part (F31, F67, F57, F72), scheduled delivery (F78), the
// district check (F79), what goes with a bike in the cart (F66), and the buy-now address with its extras (F35). The
// database prices and checks everything again (store_checkout); these keep the pages saying what it will say. Nothing
// here reads anything, so the browser's components can use it.

/** How an order is had: one of the delivery ways, or "digital" for gift cards alone (nothing is delivered). */
export type Way = Fulfil | "digital";
export type StepId = "contact" | "delivery" | "address" | "review";

export const isGiftCard = (p: Pick<StoreProduct, "kind"> | null | undefined) => p?.kind === "gift_card";
/** Only gift cards: the order goes "digital" (no delivery, no address; the database requires it then). */
export const digitalOnly = (lines: readonly CartLine[]) => lines.length > 0 && lines.every((l) => isGiftCard(l.product));
/** A gift card in the order: it cannot be paid with a gift card (STORE_GIFT_ON_GIFT). */
export const hasGiftCard = (lines: readonly CartLine[]) => lines.some((l) => isGiftCard(l.product));
/** A bike in the order: its ways take a bike's names (F27, "Collect fully built"). */
export const hasBike = (lines: readonly CartLine[]) => lines.some((l) => l.product?.category === "bikes");

/** The steps checkout goes through for this way: no delivery step for gift cards alone, no address for pickup. */
export function stepsFor(way: Way): StepId[] {
  if (way === "digital") return ["contact", "review"];
  if (way === "pickup") return ["contact", "delivery", "review"];
  return ["contact", "delivery", "address", "review"];
}

const FIELD_STEP: Record<string, StepId> = {
  name: "contact", phone: "contact", email: "contact",
  fulfil: "delivery", slot: "delivery",
  city: "address", district: "address", district_unserved: "address", street: "address", building: "address", postal: "address", extra: "address", short: "address", address: "address",
};
/** The step a field (or a refusal placed on it) belongs to; anything else is the review's. */
export const stepOfField = (field: string): StepId => FIELD_STEP[field] ?? "review";

export type CheckoutState = {
  way: Way; contact: Contact; address: Address;
  slot: { day: string; time: string } | null; slots: Slots | null; today: string;
  districts: readonly District[] | null;
};

/** Every field the customer must fix before the order can be sent, in the page's order: the form's own rules
 *  (formProblems), then a Jeddah delivery's slot while staff schedule them (F78) and its district while staff list the
 *  ones they serve (F79: "district_unserved"). */
export function checkoutProblems(s: CheckoutState): string[] {
  const base = formProblems({ fulfil: s.way, contact: s.contact, address: s.address });
  const slot = s.way === "jeddah" && s.slots && !slotOk(s.slots, s.today, s.slot) ? ["slot"] : [];
  const district = s.way === "jeddah" && s.districts && s.address.district.trim() && !districtServed(s.districts, s.address.district) ? ["district_unserved"] : [];
  return [...base.filter((f) => stepOfField(f) === "contact"), ...slot, ...base.filter((f) => stepOfField(f) !== "contact"), ...district];
}

/** The step to open: the first one with something to fix, else the review. */
export function firstOpen(steps: readonly StepId[], problems: readonly string[]): StepId {
  return steps.find((st) => problems.some((f) => stepOfField(f) === st)) ?? steps[steps.length - 1];
}

/** After Continue on `from`: the next step not yet seen or with something to fix, else the review. */
export function nextStep(steps: readonly StepId[], from: StepId, seen: readonly StepId[], problems: readonly string[]): StepId {
  const i = steps.indexOf(from);
  for (let k = i + 1; k < steps.length; k++) {
    if (!seen.includes(steps[k]) || problems.some((f) => stepOfField(f) === steps[k])) return steps[k];
  }
  return steps[steps.length - 1];
}

/** What a Jeddah district the customer gave means (F79): served, or not served and so collected instead (when pickup is
 *  offered), or refused (no pickup either). Always "ok" while staff list no districts. */
export function districtOutcome(districts: readonly District[] | null, way: Way, district: string, pickupOn: boolean): "ok" | "switch" | "refuse" {
  if (way !== "jeddah" || !districts || !district.trim() || districtServed(districts, district)) return "ok";
  return pickupOn ? "switch" : "refuse";
}

// ── The checks a field gets as it is left (F77) ─────────────────────────────────────────────────────

/** What is wrong with one field, as specifically as can be said (a code the page has words for, and a count for the
 *  codes that name one: "phone_len", "postal_len", "extra_len"), or null. An empty optional field is fine. */
export type Check = { code: string; n?: number } | null;
export function fieldCheck(field: string, raw: string, way: Way): Check {
  const v = raw.trim();
  switch (field) {
    case "name":
      return v.replace(/\s+/g, " ").length < 2 ? { code: "name" } : null;
    case "phone": {
      if (storePhone(raw)) return null;
      const d = latinDigits(raw);
      if (!d.trim()) return { code: "phone" };
      if (/[^\d\s+\-().]/.test(d)) return { code: "phone_chars" };
      const digits = d.replace(/\D/g, "");
      if (/^(00|\+|966)/.test(d.trim()) || digits.startsWith("966")) return { code: "phone" }; // written with the country code
      if (/^05/.test(digits)) return { code: "phone_len", n: digits.length };
      if (/^(0[0-46-9]|[1-46-9])/.test(digits)) return { code: "phone_start" };
      return { code: "phone" };
    }
    case "email": {
      if (!v) return null;
      if (/\s/.test(v)) return { code: "email_space" };
      if (!v.includes("@")) return { code: "email_at" };
      const at = v.indexOf("@"), domain = v.slice(at + 1);
      if (at < 1) return { code: "email" };
      if (!/^[^@\s]+\.[^@\s]+$/.test(domain)) return { code: "email_domain" };
      return v.length > 120 ? { code: "email" } : null;
    }
    case "city":
      return way === "ksa" && !v ? { code: "city" } : null;
    case "district":
    case "street":
      return way !== "pickup" && way !== "digital" && !v ? { code: field } : null;
    case "postal":
      return v && !/^\d{5}$/.test(v) ? { code: "postal_len", n: v.length } : null;
    case "extra":
      return v && !/^\d{4}$/.test(v) ? { code: "extra_len", n: v.length } : null;
    case "short": {
      if (!v) return way === "ksa" ? { code: "short" } : null;
      if (/^[A-Z]{4}\d{4}$/.test(v)) return null;
      return /^[A-Z]{4}/.test(v) ? { code: "short_digits" } : { code: "short_letters" };
    }
    default:
      return null;
  }
}

// ── What the order costs (F31, F67, F57, F72, L04) ──────────────────────────────────────────────────

const r2 = (n: number) => Math.round(n * 100) / 100;
/** What a balance (a gift card's, the wallet's) takes of an amount: all it can, but never leaving the card less than
 *  1 SAR to pay (Moyasar's least), as store_checkout takes it. */
export function takeOf(balance: number | null | undefined, amount: number): number {
  const b = Math.max(0, Number(balance) || 0), a = Math.max(0, amount);
  if (!b || !a) return 0;
  const take = Math.min(b, a), left = r2(a - take);
  return left > 0 && left < 1 ? Math.max(r2(a - 1), 0) : r2(take);
}

export type Money = {
  subtotal: number;
  /** The starter sets the order makes (F31), each with what it saves; only beside the discount licence. */
  sets: { ref: string; sets: number; amount: number }[];
  setOff: number;
  /** What the code takes off (F67), as the database answered it for these lines. */
  codeOff: number;
  discount: number;
  /** The delivery fee on what the goods cost after the discounts; null when the way is not offered. */
  fee: number | null;
  total: number;
  gift: number;
  wallet: number;
  /** What is left for the card (or Tabby) to pay. */
  due: number;
};

/** The order's money, worked out in the database's order (store_checkout): subtotal, the starter sets' saving, the
 *  code's, the delivery fee on what is left, the total; then a gift card, then the wallet, and the rest to pay. */
export function checkoutMoney(a: {
  lines: CartLine[]; settings: PaySettings; way: Way; licence: string | boolean | null;
  code?: number | null; gift?: number | null; wallet?: number | null;
}): Money {
  const subtotal = subtotalOf(a.lines);
  const sets = bundleDiscount(a.lines, a.licence);
  const setOff = r2(Math.min(subtotal, sets.reduce((n, s) => n + s.amount, 0)));
  const codeOff = a.licence ? r2(Math.min(Math.max(0, Number(a.code) || 0), subtotal - setOff)) : 0;
  const discount = r2(setOff + codeOff);
  const fee = deliveryFee(a.settings, a.way, r2(subtotal - discount));
  const total = r2(subtotal - discount + (fee ?? 0));
  const gift = takeOf(a.gift, total);
  const wallet = takeOf(a.wallet, r2(total - gift));
  return { subtotal, sets, setOff, codeOff, discount, fee, total, gift, wallet, due: r2(total - gift - wallet) };
}

// ── Scheduled delivery (F78) and dates ──────────────────────────────────────────────────────────────

/** "Sat 21 Nov" in the page's language. */
export const dayLabel = (day: string, intl: string) => fmtRange({ from: day, to: day }, intl);
/** "15 Nov 2027": a date with its year (a gift card's expiry). */
export function dateLabel(iso: string, intl: string): string {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Riyadh" }).format(t) : "";
}
/** "09:00 – 13:00" (or "9:00 ص – 1:00 م"): a slot's hours in the page's language. */
export function timeLabel(t: SlotTime, intl: string): string {
  const f = new Intl.DateTimeFormat(intl, { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
  const at = (hm: string) => { const [h, m] = hm.split(":").map(Number); return f.format(Date.UTC(2000, 0, 1, h, m)); };
  return `${at(t.from)} – ${at(t.to)}`;
}

// ── The cart (F66, F68) ─────────────────────────────────────────────────────────────────────────────

/** "Goes with your bike" (F66): the products staff paired with the bikes in the cart (Goes with), in their order, that are
 *  still in stock and not in the cart already, never a gift card; two at most. */
export function goesWithCart(products: StoreProduct[], lines: readonly CartLine[], max = 2, keep: readonly string[] = []): StoreProduct[] {
  // `keep`: products just added from this row, which stay in it (their button says "Added")
  const inCart = new Set(lines.map((l) => l.product?.id).filter((id): id is string => !!id && !keep.includes(id)));
  const out: StoreProduct[] = [];
  for (const l of lines) {
    if (l.product?.category !== "bikes") continue;
    for (const p of relatedOf({ products }, l.product.goes_with, l.product.id)) {
      if (out.length >= max) return out;
      if (inCart.has(p.id) || out.includes(p) || isGiftCard(p) || productStock(p).kind === "out") continue;
      out.push(p);
    }
  }
  return out;
}

/** The one choice a product can be added with straight from a small card (one size, one colour, in stock), or null when
 *  the customer must choose on its page. */
export function onlyChoice(p: StoreProduct): StoreVariant | null {
  const o = optionsOf(p);
  const open = p.variants.filter((v) => v.stock > 0);
  return o.sizes.length <= 1 && o.colours.length <= 1 && open.length === 1 ? open[0] : null;
}

// ── Buy now (F35) with a bike's extras (F60) ────────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The lines a buy-now address names (/store/checkout?buy=<variant>&qty=<n>&with=<variant>,<variant>; CONTRACTS.md,
 *  additions by w3a): the item bought now, then each extra once with quantity 1 (8 at most, never the item again); []
 *  when it names no item. The cart is left alone. */
export function buyLinesOf(q: Record<string, string | string[] | undefined> | URLSearchParams): CartItem[] {
  const get = (k: string) => (q instanceof URLSearchParams ? q.get(k) : typeof q[k] === "string" ? (q[k] as string) : null);
  const id = (get("buy") ?? "").toLowerCase();
  if (!UUID.test(id)) return [];
  const n = Math.floor(Number(get("qty") ?? "1"));
  const out: CartItem[] = [{ variant: id, qty: n >= 1 && n <= MAX_QTY ? n : 1 }];
  for (const x of (get("with") ?? "").split(",").map((s) => s.trim().toLowerCase())) {
    if (out.length > 8) break;
    if (UUID.test(x) && !out.some((l) => l.variant === x)) out.push({ variant: x, qty: 1 });
  }
  return out;
}

// ── A code, a gift card and Tabby ───────────────────────────────────────────────────────────────────

/** The code typed in the cart, carried to checkout for this visit (sessionStorage). */
export const CODE_KEY = "mm-cart-code";
/** A gift card's code as typed: upper case, Latin, the dashes put back (GC-ABCD-EFGH-JKLM). */
export function giftCodeOf(raw: string): string {
  const s = latinDigits(raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = s.startsWith("GC") ? s.slice(2) : s;
  if (body.length !== 12) return raw.trim().toUpperCase();
  return `GC-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8)}`;
}
export const giftCodeOk = (c: string) => /^GC-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(c);
/** A promo code as the database keeps it. */
export const promoCodeOf = (raw: string) => latinDigits(raw).trim().toUpperCase().replace(/\s+/g, "");
export const promoCodeOk = (c: string) => /^[A-Z0-9-]{3,24}$/.test(c);
/** One of Tabby's four payments (the last takes what rounding leaves). */
export const tabbyQuarter = (amount: number) => Math.ceil((Number(amount) || 0) * 25) / 100;
