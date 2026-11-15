import type { CartItem } from "./cart";
import type { Fulfil } from "./store-delivery";

// The checkout form's rules, the same as the database's (store_checkout, _pay_phone), so a customer is
// told what to fix before the order is sent; the database checks everything again.

/** Arabic-Indic and Eastern Arabic-Indic digits as 0-9, and the direction marks a paste from an RTL
 *  contact brings, taken out. */
export function latinDigits(s: string): string {
  return s
    .replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, "")
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0));
}

/** A Saudi mobile written any usual way (05.., 5.., +9665.., 009665.., spaces, Arabic-Indic digits)
 *  as 9665XXXXXXXX, or null: _pay_phone. */
export function storePhone(raw: string): string | null {
  const d = latinDigits(raw).replace(/\D/g, "");
  return /^(00966|966|0)?5\d{8}$/.test(d) ? `966${d.slice(-9)}` : null;
}

/** The national short address (4 letters, 4 digits: RCMA7933) as typed: upper case, Latin digits, no spaces. */
export const shortAddress = (raw: string) => latinDigits(raw).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
export const shortOk = (s: string) => /^[A-Z]{4}\d{4}$/.test(s);
/** Only the digits of a number field (postal code, building and additional numbers), Latin. */
export const digitsOnly = (raw: string, max: number) => latinDigits(raw).replace(/\D/g, "").slice(0, max);

export type Address = { city: string; district: string; street: string; building: string; postal: string; extra: string; short: string };
export const EMPTY_ADDRESS: Address = { city: "", district: "", street: "", building: "", postal: "", extra: "", short: "" };
export type Contact = { name: string; phone: string; email: string };

/** The fields the customer must fix before the order can be sent, by name ("name", "phone", "email",
 *  "district", "street", "city", "postal", "extra", "short"). */
export function formProblems(f: { fulfil: Fulfil | "digital"; contact: Contact; address: Address }): string[] {
  const out: string[] = [];
  if (f.contact.name.trim().replace(/\s+/g, " ").length < 2) out.push("name");
  if (!storePhone(f.contact.phone)) out.push("phone");
  const email = f.contact.email.trim();
  if (email && (email.length > 120 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) out.push("email");
  if (f.fulfil === "pickup" || f.fulfil === "digital") return out;
  const a = f.address;
  if (f.fulfil === "ksa" && !a.city.trim()) out.push("city");
  if (!a.district.trim()) out.push("district");
  if (!a.street.trim()) out.push("street");
  if (a.postal && !/^\d{5}$/.test(a.postal)) out.push("postal");
  if (a.extra && !/^\d{4}$/.test(a.extra)) out.push("extra");
  if (f.fulfil === "ksa" ? !shortOk(a.short) : a.short !== "" && !shortOk(a.short)) out.push("short");
  return out;
}

/** What the store build added to a checkout (CONTRACTS.md section 5.1): a code (F67), a gift card to pay with (F57), a
 *  gift order and its note (F58), a scheduled Jeddah delivery (F78). */
export type CheckoutExtras = { promo?: string; giftCard?: string; gift?: boolean; giftNote?: string; slot?: { day: string; time: string } | null };

/** The body of POST /api/store/checkout. The city of a Jeddah delivery is Jeddah. A gift card alone goes "digital":
 *  nothing is delivered and no address is sent. */
export function checkoutBody(f: { items: CartItem[]; fulfil: Fulfil | "digital"; contact: Contact; address: Address; note: string; wallet: boolean; lang: string } & CheckoutExtras) {
  const a = f.address;
  const address = f.fulfil === "pickup" || f.fulfil === "digital" ? undefined : {
    city: f.fulfil === "jeddah" ? "Jeddah" : a.city.trim(), district: a.district.trim(), street: a.street.trim(),
    building: a.building.trim() || undefined, postal: a.postal || undefined, extra: a.extra || undefined, short: a.short || undefined,
  };
  return {
    items: f.items.map((i) => ({ variant: i.variant, qty: i.qty })),
    fulfil: f.fulfil,
    contact: { name: f.contact.name.trim().replace(/\s+/g, " "), phone: f.contact.phone.trim(), email: f.contact.email.trim() || undefined },
    address,
    note: f.note.trim() || undefined,
    wallet: f.wallet,
    lang: f.lang,
    promo: f.promo?.trim() ? f.promo.trim().toUpperCase() : undefined,
    giftCard: f.giftCard?.trim() ? f.giftCard.trim().toUpperCase() : undefined,
    gift: f.gift ? true : undefined,
    giftNote: f.gift && f.giftNote?.trim() ? f.giftNote.trim() : undefined,
    slot: f.fulfil === "jeddah" && f.slot ? f.slot : undefined,
  };
}

/** Where the checkout's refusal (api/store/checkout, lib/pay/http.ts payError) belongs on the page: a field,
 *  the cart line it names, or the form as a whole. */
export function refusalPlace(error: string): { field?: string; line?: true } {
  if (error === "stock" || error === "gone" || error === "no_ship") return { line: true };
  if (error === "phone" || error === "name" || error === "email" || error === "city") return { field: error };
  if (error === "address") return { field: "address" };
  // the store build (2026-11-15): the district a Jeddah delivery does not serve, the delivery slot, the code, the gift card
  if (error === "district" || error === "slot") return { field: error };
  if (error === "promo" || error === "promo_min" || error === "promo_used" || error === "licence") return { field: "promo" };
  if (error === "gift" || error === "gift_on_gift" || error === "gift_expired") return { field: "giftCard" };
  return {};
}
