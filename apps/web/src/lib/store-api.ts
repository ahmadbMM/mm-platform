import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { CartItem } from "./cart";
import { payError } from "./pay/http";
import { payRpc, payView } from "./pay/server";
import { tabbyCheckout, type TabbyOrder } from "./pay/tabby";
import { orderOf, RETURN_REASONS, type IssuedGiftCard, type Order, type ReturnReason } from "./store-order";

// The store build's calls to the database from this server (2026-11-15, rentals migration 20261115235500;
// CONTRACTS.md sections 5.1 and 6). Each takes the server key the way store_checkout does (payRpc), so the public key
// alone opens none of them; the routes that call these are the chains' own (/api/store/promo, /gift-card,
// /stock-request, /return, /review). The answer is the data, or the page's code for the database's refusal (payError)
// with the status the route answers with. The three outside services (the national address, Tabby, SMSA) are built
// but off: their keys are Worker secrets that do not exist yet, and their calls answer "*_off" until they do.

export type ApiAnswer<T> = { ok: true; data: T } | { ok: false; error: string; status: number };
type Rpc<T> = Awaited<ReturnType<typeof payRpc<T>>>;

function answer<T>(r: Rpc<T>, ok: (d: T) => boolean = (d) => d != null): ApiAnswer<T> {
  if (r.status === 200 && r.data != null && ok(r.data)) return { ok: true, data: r.data };
  const e = payError(r);
  return { ok: false, error: r.status === 200 ? "generic" : e.error, status: r.status === 200 ? 502 : e.status };
}
const bad = (error = "invalid"): { ok: false; error: string; status: number } => ({ ok: false, error, status: 400 });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LANG = /^[a-z]{2}$/;
const KEY32 = /^[0-9a-f]{32}$/i;
/** A code as the database keeps it: upper case, letters, digits and dashes (STORE_PROMO otherwise). */
export const codeOf = (raw: string) => raw.trim().toUpperCase().replace(/\s+/g, "");

// ── Codes and gift cards (F67, F57; w4) ─────────────────────────────────────────────────────────

export type PromoCheck = { code: string; kind: "percent" | "amount"; value: number; discount: number; eligible: number };
/** Whether a code takes something off these cart lines (store_promo_check): the database prices the lines itself. `from`
 *  is the shopper's request: the database meters each visitor, not the Worker's one address. */
export async function promoCheck(code: string, items: CartItem[], from?: Request): Promise<ApiAnswer<PromoCheck>> {
  const c = codeOf(code);
  if (!/^[A-Z0-9-]{3,24}$/.test(c)) return { ok: false, error: "promo", status: 409 };
  const lines = items.filter((i) => UUID.test(i.variant) && i.qty >= 1 && i.qty <= 10).slice(0, 20).map((i) => ({ variant: i.variant, qty: i.qty }));
  if (!lines.length) return bad("empty");
  return answer(await payRpc<PromoCheck>("store_promo_check", { p_code: c, p_items: lines }, undefined, from), (d) => typeof d.discount === "number");
}

/** expires_at: a card ends a year after it was issued (CONTRACTS.md, additions by lead 3); null from a database that
 *  does not say. An expired card is refused (STORE_GIFT_EXPIRED, "gift_expired"; additions by w4). */
export type GiftCardCheck = { code: string; balance: number; expires_at: string | null };
/** What a gift card still holds and until when (store_gift_card_check). */
export async function giftCardCheck(code: string, from?: Request): Promise<ApiAnswer<GiftCardCheck>> {
  const c = codeOf(code);
  if (!/^GC-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(c)) return { ok: false, error: "gift", status: 409 };
  const r = answer(await payRpc<GiftCardCheck>("store_gift_card_check", { p_code: c }, undefined, from), (d) => Number.isFinite(Number(d.balance)));
  if (!r.ok) return r;
  const at = typeof r.data.expires_at === "string" && Number.isFinite(Date.parse(r.data.expires_at)) ? r.data.expires_at : null;
  return { ok: true, data: { code: typeof r.data.code === "string" ? r.data.code : c, balance: Number(r.data.balance), expires_at: at } };
}

// ── Back in stock (F34; w3a) ────────────────────────────────────────────────────────────────────

/** A shopper asks to be called when a sold-out choice is back (store_stock_request); staff call them on WhatsApp. `from`
 *  is the shopper's request: the database meters each visitor (10 in 10 minutes), not the Worker's one address. */
export async function stockRequest(a: { variant: string; name: string; phone: string; lang: string | null }, from?: Request): Promise<ApiAnswer<{ id: string }>> {
  if (!UUID.test(a.variant)) return bad();
  const name = a.name.trim().replace(/\s+/g, " ").slice(0, 60);
  return answer(await payRpc<{ id: string }>("store_stock_request", {
    p_variant: a.variant, p_name: name, p_phone: a.phone.trim().slice(0, 20), p_lang: a.lang && LANG.test(a.lang) ? a.lang : null,
  }, undefined, from), (d) => typeof d.id === "string");
}

// ── After the order: returns and reviews (F93, F94; w5) ─────────────────────────────────────────

/** Asks to return or exchange items of a delivered order (store_return_request); answers the order as it is now. */
export async function returnRequest(a: { no: number; key: string; kind: "return" | "exchange"; items: { item: number; qty: number }[]; reason: ReturnReason; note: string }):
  Promise<ApiAnswer<Order>> {
  if (!Number.isInteger(a.no) || !KEY32.test(a.key) || !(RETURN_REASONS as readonly string[]).includes(a.reason)) return bad();
  const items = a.items.filter((i) => Number.isInteger(i.item) && i.item > 0 && Number.isInteger(i.qty) && i.qty >= 1 && i.qty <= 10).slice(0, 20)
    .map((i) => ({ item_id: i.item, qty: i.qty }));
  if (!items.length) return { ok: false, error: "return_items", status: 409 };
  const r = await payRpc<unknown>("store_return_request", {
    p_no: a.no, p_track: a.key, p_kind: a.kind === "exchange" ? "exchange" : "return", p_items: items, p_reason: a.reason, p_note: a.note.trim().slice(0, 300) || null,
  });
  const got = answer(r);
  if (!got.ok) return got;
  const o = orderOf(got.data, a.key);
  return o ? { ok: true, data: o } : { ok: false, error: "generic", status: 502 };
}

/** A verified buyer's review of one product of a delivered order (store_review_add); staff show it after reading it. */
export async function reviewAdd(a: { no: number; key: string; product: string; rating: number; body: string; lang: string | null }): Promise<ApiAnswer<{ id: string }>> {
  if (!Number.isInteger(a.no) || !KEY32.test(a.key) || !UUID.test(a.product) || !Number.isInteger(a.rating) || a.rating < 1 || a.rating > 5) return bad();
  return answer(await payRpc<{ id: string }>("store_review_add", {
    p_no: a.no, p_track: a.key, p_product: a.product, p_rating: a.rating, p_body: a.body.trim().slice(0, 1000) || null,
    p_lang: a.lang && LANG.test(a.lang) ? a.lang : null,
  }), (d) => typeof d.id === "string");
}

/** The gift cards an order bought, with their whole codes for its buyer (store_order_get with the order's gift key, which
 *  the checkout gave this buyer's browser; CONTRACTS.md Additions by lead: gift card codes). A wrong gift key reads them
 *  masked, as the order's link alone does; "not_found" for a number and key that name no order. */
export async function giftCodes(a: { no: number; key: string; gift: string }): Promise<ApiAnswer<IssuedGiftCard[]>> {
  if (!Number.isInteger(a.no) || a.no < 1 || !KEY32.test(a.key) || !KEY32.test(a.gift)) return bad();
  const r = await payRpc<unknown>("store_order_get", { p_no: a.no, p_track: a.key, p_gift: a.gift.toLowerCase() });
  if (r.status === 200 && r.data == null) return { ok: false, error: "not_found", status: 404 };
  const got = answer(r);
  if (!got.ok) return got;
  const o = orderOf(got.data, a.key);
  return o ? { ok: true, data: o.gift_cards } : { ok: false, error: "generic", status: 502 };
}

// ── The outside services, built but off until their keys exist ────────────────────────────────

/** The Worker secrets the outside services take (none exist yet; `wrangler secret put <NAME> --env staging`). */
export type StoreEnv = { NATIONAL_ADDRESS_KEY?: string; TABBY_SECRET_KEY?: string; TABBY_PUBLIC_KEY?: string; TABBY_MERCHANT_CODE?: string; TABBY_WEBHOOK_SECRET?: string; SMSA_API_KEY?: string };
export function storeEnv(): StoreEnv {
  let env: StoreEnv = {};
  try { env = getCloudflareContext().env as StoreEnv; } catch { /* a local run or a test */ }
  const pick = (k: keyof StoreEnv) => env[k] || process.env[k] || undefined;
  return {
    NATIONAL_ADDRESS_KEY: pick("NATIONAL_ADDRESS_KEY"), TABBY_SECRET_KEY: pick("TABBY_SECRET_KEY"), TABBY_PUBLIC_KEY: pick("TABBY_PUBLIC_KEY"),
    TABBY_MERCHANT_CODE: pick("TABBY_MERCHANT_CODE"), TABBY_WEBHOOK_SECRET: pick("TABBY_WEBHOOK_SECRET"), SMSA_API_KEY: pick("SMSA_API_KEY"),
  };
}

export type FoundAddress = { city: string; district: string; street: string; building: string; postal: string; extra: string };

/** The national address's own service (Saudi Post, SPL: api.address.gov.sa, "address by short address"), asked with
 *  the key NATIONAL_ADDRESS_KEY. CHECK when the key is bought: the path and the answer's names below are the service's
 *  v3.1 ones as published (Addresses[0].City, District, Street, BuildingNumber, PostCode, AdditionalNumber); the parser
 *  also takes them in camel case. */
export const NATIONAL_ADDRESS_URL = "https://apina.address.gov.sa/NationalAddress/v3.1/Address/address-by-shortaddress";

/** The address the service answered, or null when it names none. */
export function nationalAddressOf(data: unknown): FoundAddress | null {
  const o = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const list = (o.Addresses ?? o.addresses ?? o.Address ?? o.address) as unknown;
  const a = (Array.isArray(list) ? list[0] : list) as Record<string, unknown> | undefined;
  if (!a || typeof a !== "object") return null;
  const g = (...k: string[]) => { for (const x of k) { const v = a[x]; if (typeof v === "string" && v.trim()) return v.trim(); if (typeof v === "number") return String(v); } return ""; };
  const digits = (s: string, n: number) => (new RegExp(`^\\d{${n}}$`).test(s) ? s : "");
  const out = {
    city: g("City", "city", "CityName").slice(0, 40), district: g("District", "district", "DistrictName").slice(0, 60),
    street: g("Street", "street", "StreetName").slice(0, 80), building: digits(g("BuildingNumber", "buildingNumber"), 4),
    postal: digits(g("PostCode", "postCode", "ZipCode", "zipCode"), 5), extra: digits(g("AdditionalNumber", "additionalNumber"), 4),
  };
  return out.district || out.street ? out : null;
}

/** The district and street of a national short address (F76). Off until the switch (store.addressLookup.on) and
 *  NATIONAL_ADDRESS_KEY are both there; "not_found" for a short address the service does not know. */
export async function addressLookup(short: string, on: boolean, env: StoreEnv = storeEnv(), lang = "en", f: typeof fetch = fetch): Promise<ApiAnswer<FoundAddress>> {
  if (!on || !env.NATIONAL_ADDRESS_KEY) return { ok: false, error: "lookup_off", status: 503 };
  if (!/^[A-Z]{4}\d{4}$/.test(short)) return bad();
  const u = new URL(NATIONAL_ADDRESS_URL);
  u.searchParams.set("shortaddress", short);
  u.searchParams.set("language", lang === "ar" ? "A" : "E");
  u.searchParams.set("format", "json");
  u.searchParams.set("encode", "utf8");
  try {
    const r = await f(u.toString(), { headers: { api_key: env.NATIONAL_ADDRESS_KEY, accept: "application/json" }, signal: AbortSignal.timeout(6000) });
    if (r.status === 404 || r.status === 400) return { ok: false, error: "not_found", status: 404 };
    if (!r.ok) return { ok: false, error: "lookup_off", status: 503 };
    const a = nationalAddressOf(await r.json().catch(() => null));
    return a ? { ok: true, data: a } : { ok: false, error: "not_found", status: 404 };
  } catch {
    return { ok: false, error: "lookup_off", status: 503 };
  }
}

/** A Tabby checkout for one payment of ours (F84; lib/pay/tabby.ts): Tabby's page to send the shopper to. Off until
 *  store.tabby.on and the TABBY_* secrets; only a store order still to pay. */
export async function tabbySession(payId: string, on: boolean, env: StoreEnv = storeEnv(), opts: { origin: string; lang: string; showroom: string } = { origin: "https://micromobility.sa", lang: "en", showroom: "" }):
  Promise<ApiAnswer<{ url: string }>> {
  if (!on || !env.TABBY_SECRET_KEY || !env.TABBY_PUBLIC_KEY || !env.TABBY_MERCHANT_CODE) return { ok: false, error: "tabby_off", status: 503 };
  if (!UUID.test(payId)) return bad();
  const v = await payView(payId);
  if (!v) return { ok: false, error: "not_found", status: 404 };
  if (v.kind !== "order" || v.status !== "initiated") return { ok: false, error: "not_open", status: 409 };
  return tabbyCheckout(v as typeof v & TabbyOrder, opts, env);
}

/** An SMSA label and waybill for an order staff ship (F108; w5 builds the route, the staff page the button). Off until
 *  store.smsa.on and SMSA_API_KEY. */
export async function smsaLabel(orderId: string, on: boolean, env: StoreEnv = storeEnv()): Promise<ApiAnswer<{ awb: string; label: string }>> {
  if (!on || !env.SMSA_API_KEY) return { ok: false, error: "smsa_off", status: 503 };
  if (!UUID.test(orderId)) return bad();
  return { ok: false, error: "smsa_off", status: 503 }; // w5: SMSA's call goes here
}
