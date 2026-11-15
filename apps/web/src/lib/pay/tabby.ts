import { payRpc, refusal, type PayView, type Settled } from "./server";
import { safeEqual } from "./moyasar";

// Tabby's "Pay in 4" for a store order (F84; store build 2026-11-15, chain w4). Built but off: it is offered only while
// staff switch it on (site_content store.tabby.on) and the Worker holds Tabby's keys (TABBY_PUBLIC_KEY for the checkout
// session, TABBY_SECRET_KEY for the payment calls, TABBY_MERCHANT_CODE, TABBY_WEBHOOK_SECRET for its webhook), none of
// which exist yet. The flow is Tabby's API v2: this server opens a checkout session for our payment (its id is the
// order's reference at Tabby), the shopper approves it on Tabby's own page, and Tabby sends them back to
// /api/pay/tabby/return (and posts to /api/pay/tabby/webhook). Neither address is believed: this server reads the
// payment from Tabby, captures it, and settles it in the database (pay_settle, provider "tabby") as a Moyasar payment is
// settled. A payment the database will not keep (paid twice, no longer held) is refunded through Tabby.
// Register the webhook once with Tabby: POST /api/v1/webhooks {"url": "https://<host>/api/pay/tabby/webhook",
// "header": {"title": "X-Webhook-Secret", "value": <TABBY_WEBHOOK_SECRET>}} with the secret key and the merchant code.

export const TABBY_API = "https://api.tabby.ai/api/v2";
export const TABBY_HOOK_HEADER = "x-webhook-secret";
export type TabbyEnv = { TABBY_SECRET_KEY?: string; TABBY_PUBLIC_KEY?: string; TABBY_MERCHANT_CODE?: string; TABBY_WEBHOOK_SECRET?: string };
type Answer<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

/** Whether Tabby can be offered here: the keys and the merchant code are all in the Worker. */
export const tabbyKeys = (e: TabbyEnv) => !!(e.TABBY_SECRET_KEY && e.TABBY_PUBLIC_KEY && e.TABBY_MERCHANT_CODE);

async function call<T>(key: string, path: string, init: { method?: string; body?: unknown } = {}, f: typeof fetch = fetch): Promise<Answer<T>> {
  try {
    const r = await f(`${TABBY_API}${path}`, {
      method: init.method ?? "GET",
      headers: { authorization: `Bearer ${key}`, accept: "application/json", ...(init.body ? { "content-type": "application/json" } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(10000),
    });
    const data = (await r.json().catch(() => null)) as T | null;
    if (!r.ok || data == null) return { ok: false, status: r.status, message: String((data as { error?: unknown } | null)?.error ?? r.statusText ?? "") };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, status: 0, message: e instanceof Error ? e.message : "network" };
  }
}

const money = (n: number) => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
const halalas = (s: unknown) => Math.round(Number(s) * 100);

export type TabbyOrder = {
  /** The order's buyer as pay_view gives it (server only; CONTRACTS.md, additions by w4). */
  buyer?: { name: string; phone: string; email: string | null } | null;
  ship?: { city?: string; district?: string; street?: string; postal?: string } | null;
};

/** The checkout session Tabby is asked for: what the card part of the order is (the amount still to pay after a gift
 *  card or the wallet), the order's lines, the buyer, and where Tabby sends the shopper back. */
export function tabbyBody(v: PayView & TabbyOrder, a: { origin: string; lang: string; merchant: string; showroom: string }): Record<string, unknown> {
  const items = (v.items ?? []).map((i, n) => ({
    title: [i.name, i.variant].filter(Boolean).join(" · ").slice(0, 120), quantity: i.qty, unit_price: money(i.unit_price),
    discount_amount: "0.00", reference_id: `${v.order_no ?? v.ref}-${n + 1}`, category: "Bikes and accessories",
    ...(i.image && /^\//.test(i.image) ? { image_url: `${a.origin}${i.image}` } : {}),
  }));
  const goods = (v.items ?? []).reduce((n, i) => n + i.unit_price * i.qty, 0) + (v.delivery_fee ?? 0);
  const phone = v.buyer?.phone && /^9665\d{8}$/.test(v.buyer.phone) ? `+${v.buyer.phone}` : undefined;
  const s = v.ship ?? null;
  const back = (q: string) => `${a.origin}/pay/${v.id}?tabby=${q}`;
  return {
    payment: {
      amount: money(v.amount), currency: "SAR", description: v.description.slice(0, 200),
      buyer: { name: v.buyer?.name ?? "", phone, email: v.buyer?.email ?? undefined },
      shipping_address: s && s.city
        ? { city: s.city, address: [s.street, s.district].filter(Boolean).join(", "), zip: s.postal ?? "" }
        : { city: "Jeddah", address: a.showroom, zip: "" },
      order: {
        reference_id: v.id, items, shipping_amount: money(v.delivery_fee ?? 0), tax_amount: "0.00",
        // what the gift card, the wallet and the discounts took: the lines and delivery less the amount Tabby takes
        discount_amount: money(Math.max(0, goods - v.amount)),
        updated_at: new Date().toISOString(),
      },
      buyer_history: { registered_since: v.created_at, loyalty_level: 0 },
      order_history: [],
      meta: { order_id: v.order_no != null ? `#${v.order_no}` : v.ref },
    },
    lang: a.lang === "ar" ? "ar" : "en",
    merchant_code: a.merchant,
    merchant_urls: { success: `${a.origin}/api/pay/tabby/return?pay=${v.id}`, cancel: back("cancel"), failure: back("fail") },
  };
}

type Session = { id?: string; status?: string; configuration?: { available_products?: { installments?: { web_url?: string }[] } } };

/** Opens Tabby's checkout for one of our payments: Tabby's page to send the shopper to, or why not ("tabby_rejected"
 *  when Tabby will not take this buyer or amount). */
export async function tabbyCheckout(v: PayView & TabbyOrder, a: { origin: string; lang: string; showroom: string }, env: TabbyEnv, f: typeof fetch = fetch):
  Promise<{ ok: true; data: { url: string } } | { ok: false; error: string; status: number }> {
  if (!tabbyKeys(env)) return { ok: false, error: "tabby_off", status: 503 };
  const r = await call<Session>(env.TABBY_PUBLIC_KEY!, "/checkout", { method: "POST", body: tabbyBody(v, { ...a, merchant: env.TABBY_MERCHANT_CODE! }) }, f);
  if (!r.ok) return { ok: false, error: r.status >= 400 && r.status < 500 ? "tabby_rejected" : "generic", status: r.status >= 400 && r.status < 500 ? 409 : 502 };
  const url = r.data.configuration?.available_products?.installments?.[0]?.web_url;
  if (r.data.status !== "created" || !url || !/^https:\/\//.test(url)) return { ok: false, error: "tabby_rejected", status: 409 };
  return { ok: true, data: { url } };
}

export type TabbyPayment = { id: string; status: string; amount: string; currency: string; order?: { reference_id?: string }; captures?: { amount?: string }[] };
const TABBY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isTabbyId = (s: string) => TABBY_ID.test(s);

/** Settles one Tabby payment for our payment `payId`: read from Tabby (the address or the webhook is never believed),
 *  captured while it is only approved, then given to the database (pay_settle, provider "tabby"). A payment of another
 *  amount, or one for a payment of ours already paid some other way, is closed at Tabby, never captured. A refund the
 *  database answers (no longer held, paid twice) is sent through Tabby. */
export async function tabbySettle(payId: string, tabbyId: string, source: "return" | "webhook", view: PayView | null, env: TabbyEnv, f: typeof fetch = fetch): Promise<Settled> {
  if (!env.TABBY_SECRET_KEY || !isTabbyId(tabbyId)) return { ok: false, status: "unknown", error: "config" };
  const sk = env.TABBY_SECRET_KEY;
  const got = await call<TabbyPayment>(sk, `/payments/${tabbyId}`, {}, f);
  if (!got.ok) return { ok: false, status: "unknown", error: got.status === 404 ? "not_found" : "gateway" };
  let p = got.data;
  if (p.order?.reference_id !== payId) return { ok: false, status: "unknown", error: "metadata" };
  const st = String(p.status ?? "").toUpperCase();
  const settle = (status: string, amount: number, message: string | null = null) => payRpc<{ ok: boolean; status: string; error?: string; refund: { id: string; provider_id: string; amount: number } | null }>("pay_settle", {
    p_pay: payId, p_provider_id: tabbyId, p_status: status, p_amount_halalas: amount, p_currency: String(p.currency ?? "").toUpperCase(),
    p_info: { provider: "tabby", method: "tabby", message }, p_source: source,
  });
  if (st === "REJECTED" || st === "EXPIRED") {
    await settle("failed", halalas(p.amount), st.toLowerCase());
    return { ok: false, status: view?.status ?? "initiated", error: st.toLowerCase() };
  }
  // What Tabby holds as captured: only its captures count. A CLOSED payment with none was closed without the money ever
  // being taken (this server closed it below: another amount, or ours paid another way), so it pays nothing.
  const capturedOf = (x: TabbyPayment) => (x.captures ?? []).reduce((n, c) => n + (halalas(c.amount) || 0), 0);
  let captured: number;
  if (st === "AUTHORIZED") {
    // our own payment not read (a database blip): left authorised at Tabby for the webhook or the return to take again,
    // never closed for it (a close cannot be undone, and the shopper did approve)
    if (!view) return { ok: false, status: "unknown", error: "gateway" };
    // never captured: another amount, or ours already paid another way (the authorisation is let go at Tabby)
    const taken = view.status === "paid" || view.status === "refunded" || view.status === "partly_refunded";
    if (halalas(p.amount) !== Math.round(view.amount * 100) || String(p.currency).toUpperCase() !== "SAR" || taken) {
      await call(sk, `/payments/${tabbyId}/close`, { method: "POST", body: {} }, f);
      await settle("failed", halalas(p.amount), "closed");
      return { ok: false, status: view.status, error: "amount" };
    }
    const asked = halalas(p.amount);
    const cap = await call<TabbyPayment>(sk, `/payments/${tabbyId}/captures`, { method: "POST", body: { amount: p.amount, reference_id: `cap-${payId}` } }, f);
    if (!cap.ok) return { ok: false, status: view.status, error: "gateway" };
    p = cap.data;
    captured = capturedOf(p) || asked; // the capture went through: what was asked, when its answer lists no captures
  } else if (st === "CLOSED") {
    captured = capturedOf(p);
    if (!captured) {
      await settle("failed", halalas(p.amount), "closed");
      return { ok: false, status: view?.status ?? "unknown", error: "closed" };
    }
  } else {
    return { ok: false, status: view?.status ?? "initiated", error: "not_paid" }; // still on Tabby's page
  }
  const r = await settle("captured", captured);
  if (r.status !== 200 || !r.data) return { ok: false, status: "unknown", error: refusal(r) || "generic" };
  if (r.data.refund) await tabbyRefund(r.data.refund, env, f);
  return { ok: r.data.ok, status: r.data.status, error: r.data.error };
}

/** A refund the database wrote for a Tabby payment, sent to Tabby and recorded (pay_refund_done). Tabby takes a
 *  reference per refund, so a refund sent twice is one refund. */
export async function tabbyRefund(rf: { id: string; provider_id: string; amount: number }, env: TabbyEnv, f: typeof fetch = fetch): Promise<boolean> {
  if (!env.TABBY_SECRET_KEY || !isTabbyId(rf.provider_id)) return false;
  const r = await call<TabbyPayment & { refunds?: { amount?: string }[] }>(env.TABBY_SECRET_KEY, `/payments/${rf.provider_id}/refunds`,
    { method: "POST", body: { amount: money(rf.amount), reference_id: rf.id } }, f);
  if (!r.ok) {
    if (r.status === 0 || r.status >= 500) return false; // left pending: it may have gone through
    await payRpc("pay_refund_done", { p_refund: rf.id, p_ok: false, p_refunded_halalas: 0, p_error: `tabby ${r.status} ${r.message}`.slice(0, 300) });
    return false;
  }
  const total = (r.data.refunds ?? []).reduce((n, x) => n + halalas(x.amount), 0) || halalas(rf.amount);
  const d = await payRpc<{ status?: string }>("pay_refund_done", { p_refund: rf.id, p_ok: true, p_refunded_halalas: total, p_error: null });
  return d.status === 200 && d.data?.status === "done";
}

/** Whether a webhook carries the secret we registered it with (constant time). */
export const tabbyHookOk = (header: string | null, env: TabbyEnv) => !!env.TABBY_WEBHOOK_SECRET && !!header && safeEqual(header, env.TABBY_WEBHOOK_SECRET);
