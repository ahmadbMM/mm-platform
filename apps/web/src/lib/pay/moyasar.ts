// Moyasar's API, from this server only (Basic auth with the secret key; docs.moyasar.com/api).
// The browser's form creates a payment with the publishable key; everything that decides money here
// (is it paid, how much, refund it) asks Moyasar itself, never the redirect or the webhook's body.

export type MoyasarSource = {
  type?: string;            // creditcard | applepay | stcpay | samsungpay | googlepay
  company?: string | null;  // mada | visa | master | amex | unionpay
  number?: string | null;   // masked: "XXXX-XXXX-XXXX-1111" or last four
  message?: string | null;
};
export type MoyasarPayment = {
  id: string;
  status: string;           // initiated paid failed authorized captured refunded voided verified expired
  amount: number;           // halalas
  currency: string;
  refunded?: number;
  description?: string | null;
  metadata?: Record<string, string> | null;
  source?: MoyasarSource | null;
};

const BASE = "https://api.moyasar.com/v1";
const auth = (sk: string) => "Basic " + btoa(`${sk}:`);

export type MoyasarAnswer<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

async function call<T>(sk: string, path: string, init: RequestInit = {}, fetchImpl: typeof fetch = fetch): Promise<MoyasarAnswer<T>> {
  try {
    const res = await fetchImpl(`${BASE}${path}`, {
      ...init,
      headers: { Authorization: auth(sk), Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}) },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok) return { ok: false, status: res.status, message: String(body?.message ?? res.statusText ?? "") };
    return { ok: true, data: body as T };
  } catch (e) {
    return { ok: false, status: 0, message: e instanceof Error ? e.message : "network" };
  }
}

/** A Moyasar payment id is a UUID. */
export const MOYASAR_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const fetchPayment = (sk: string, id: string, f?: typeof fetch) =>
  MOYASAR_ID.test(id) ? call<MoyasarPayment>(sk, `/payments/${id}`, {}, f) : Promise.resolve({ ok: false, status: 400, message: "id" } as const);

/** Every Moyasar payment carrying our payment's id in its metadata (each attempt: a declined card, then another). */
export async function paymentsFor(sk: string, payId: string, f?: typeof fetch): Promise<MoyasarAnswer<MoyasarPayment[]>> {
  const r = await call<{ payments?: MoyasarPayment[] }>(sk, `/payments?metadata[pay_id]=${encodeURIComponent(payId)}`, {}, f);
  return r.ok ? { ok: true, data: Array.isArray(r.data.payments) ? r.data.payments : [] } : r;
}

/** A refund of so many halalas (the whole payment when omitted). Moyasar answers the payment, its `refunded` the total so far. */
export const refundPayment = (sk: string, id: string, halalas?: number, f?: typeof fetch) =>
  call<MoyasarPayment>(sk, `/payments/${id}/refund`, { method: "POST", body: JSON.stringify(halalas ? { amount: halalas } : {}) }, f);

/** A webhook's one-time code sent back (docs.moyasar.com, Verify Webhook, 2026-11-14): a new webhook receives no events until
 *  it is verified, and Moyasar sends the 6-digit code once, to the webhook's own address, in a `webhook_verification` event
 *  (data.webhook_id, data.verification_code), valid 30 minutes. Answering it here means nobody has to catch the code and
 *  type it into the dashboard. */
export const WEBHOOK_CODE = /^\d{6}$/;
export const verifyWebhook = (sk: string, webhookId: string, code: string, f?: typeof fetch) =>
  MOYASAR_ID.test(webhookId) && WEBHOOK_CODE.test(code)
    ? call<{ id: string; verified?: boolean }>(sk, `/webhooks/${webhookId}/verify`, { method: "POST", body: JSON.stringify({ code }) }, f)
    : Promise.resolve({ ok: false, status: 400, message: "id" } as const);

/** SAR to halalas, exactly (57.5 -> 5750). */
export const toHalalas = (sar: number) => Math.round(Number(sar) * 100);

/** What we keep of a payment's source: how it was paid and the card's last four, never more. */
export function sourceInfo(p: MoyasarPayment): { method: string | null; brand: string | null; last4: string | null; message: string | null } {
  const s = p.source ?? {};
  const company = (s.company ?? "").toLowerCase();
  const digits = (s.number ?? "").replace(/\D/g, "");
  return {
    method: s.type ? String(s.type).slice(0, 20) : null,
    brand: company === "master" ? "mastercard" : company ? company.slice(0, 20) : null,
    last4: digits.length >= 4 ? digits.slice(-4) : null,
    message: s.message ? String(s.message).slice(0, 200) : null,
  };
}

/** Constant-time string comparison (the webhook's secret token). */
export function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a), eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}
