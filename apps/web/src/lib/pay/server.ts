import { rpcServer } from "@/lib/account";
import { payEnv, type PayEnv } from "./config";
import { fetchPayment, paymentsFor, refundPayment, sourceInfo, toHalalas, type MoyasarPayment } from "./moyasar";

// The database's half of a payment, from this server: every pay_* function takes the server key
// (PAY_SERVER_KEY; the database keeps its sha256), so the public key alone opens none of them.

export type PayView = {
  id: string; kind: "order" | "booking" | "locker" | "topup" | "workshop"; ref: string; amount: number; currency: string;
  description: string; status: "initiated" | "paid" | "expired" | "cancelled" | "refunded" | "partly_refunded";
  hold: boolean; expires_at: string; paid_at: string | null; method: string | null; brand: string | null; last4: string | null;
  message: string | null; refunded: number; receipt_no: number | null; created_at: string;
  order_no?: number; order_key?: string; order_status?: string; delivery_fee?: number; wallet_paid?: number;
  items?: { name: string; variant: string | null; qty: number; unit_price: number; image: string | null }[];
  rides?: { id: string; name: string; type: string; date: string; title: string | null; kind: string | null; status: string; paid: boolean }[];
  lockers?: { code: string; day: string; period: string; status: string }[];
  job?: string;
};

export type Refund = { id: string; provider_id: string | null; amount: number };
type RpcAnswer<T> = Awaited<ReturnType<typeof rpcServer<T>>>;

/** A pay_* function with the server key. */
export function payRpc<T>(fn: string, args: Record<string, unknown>, env: PayEnv = payEnv()): Promise<RpcAnswer<T>> {
  return rpcServer<T>(fn, { p_key: env.PAY_SERVER_KEY ?? "", ...args }, 8000);
}

/** The refusal the database named (its exception text up to a colon), for the page's words. */
export const refusal = (r: { message: string }) => (/^[A-Z_]+/.exec(r.message ?? "")?.[0] ?? "");

export async function payView(id: string, env?: PayEnv): Promise<PayView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const r = await payRpc<PayView | null>("pay_view", { p_pay: id }, env);
  return r.status === 200 && r.data && typeof r.data === "object" ? r.data : null;
}

/** Sends a refund the database wrote 'pending' to Moyasar and records the answer. Safe to repeat:
 *  pay_refund_done ignores a refund no longer pending. */
export async function sendRefund(rf: Refund, env: PayEnv = payEnv()): Promise<boolean> {
  if (!rf.provider_id || !env.MOYASAR_SECRET_KEY) return false;
  const r = await refundPayment(env.MOYASAR_SECRET_KEY, rf.provider_id, toHalalas(rf.amount));
  if (!r.ok) {
    // already refunded that much (a retry after a lost answer): Moyasar refuses; read what it holds
    const now = await fetchPayment(env.MOYASAR_SECRET_KEY, rf.provider_id);
    if (now.ok && (now.data.refunded ?? 0) >= toHalalas(rf.amount) && ["refunded", "paid"].includes(now.data.status)) {
      await payRpc("pay_refund_done", { p_refund: rf.id, p_ok: true, p_refunded_halalas: now.data.refunded ?? 0, p_error: null }, env);
      return true;
    }
    await payRpc("pay_refund_done", { p_refund: rf.id, p_ok: false, p_refunded_halalas: 0, p_error: `${r.status} ${r.message}`.slice(0, 300) }, env);
    return false;
  }
  await payRpc("pay_refund_done", { p_refund: rf.id, p_ok: true, p_refunded_halalas: r.data.refunded ?? toHalalas(rf.amount), p_error: null }, env);
  return true;
}

export type Settled = { ok: boolean; status: string; error?: string };

/** One Moyasar payment, fetched by this server, settled against ours: it must carry our id in its
 *  metadata (the form puts it there), then the database checks amount and currency and applies it.
 *  A refund the database answers (paid twice, wrong amount, no longer held) is sent at once. */
export async function settle(payId: string, p: MoyasarPayment, source: "return" | "webhook" | "reconcile" | "attach", env: PayEnv = payEnv()): Promise<Settled> {
  if (p.metadata?.pay_id !== payId) return { ok: false, status: "unknown", error: "metadata" };
  const info = sourceInfo(p);
  const r = await payRpc<{ ok: boolean; status: string; error?: string; refund: Refund | null }>("pay_settle", {
    p_pay: payId, p_provider_id: p.id, p_status: p.status, p_amount_halalas: p.amount, p_currency: p.currency,
    p_info: info, p_source: source,
  }, env);
  if (r.status !== 200 || !r.data) return { ok: false, status: "unknown", error: refusal(r) || "generic" };
  if (r.data.refund) await sendRefund(r.data.refund, env);
  return { ok: r.data.ok, status: r.data.status, error: r.data.error };
}

/** Asks Moyasar about one Moyasar payment id and settles it (the return page, the webhook). */
export async function settleById(moyasarId: string, source: "return" | "webhook" | "attach", expectPay: string | null, env: PayEnv = payEnv()): Promise<Settled & { payId?: string }> {
  if (!env.MOYASAR_SECRET_KEY) return { ok: false, status: "unknown", error: "config" };
  const f = await fetchPayment(env.MOYASAR_SECRET_KEY, moyasarId);
  if (!f.ok) return { ok: false, status: "unknown", error: f.status === 404 ? "not_found" : "gateway" };
  const payId = f.data.metadata?.pay_id ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(payId) || (expectPay && payId !== expectPay)) return { ok: false, status: "unknown", error: "metadata" };
  return { ...(await settle(payId, f.data, source, env)), payId };
}

/** The reconcile run: every unpaid payment Moyasar may hold money for, asked by its metadata, and card
 *  refunds that never reached Moyasar. Webhooks and the return page settle nearly everything; this
 *  catches a rider who closed the tab after 3-D Secure while a webhook was lost. */
export async function reconcile(env: PayEnv = payEnv()): Promise<{ checked: number; settled: number; refunds: number }> {
  const out = { checked: 0, settled: 0, refunds: 0 };
  if (!env.MOYASAR_SECRET_KEY) return out;
  const list = await payRpc<{ payments: string[]; refunds: Refund[] }>("pay_reconcile_list", {}, env);
  if (list.status !== 200 || !list.data) return out;
  for (const id of list.data.payments ?? []) {
    out.checked++;
    const r = await paymentsFor(env.MOYASAR_SECRET_KEY, id);
    if (!r.ok) continue;
    for (const p of r.data) {
      if (["paid", "captured"].includes(p.status) && (await settle(id, p, "reconcile", env)).status === "paid") out.settled++;
    }
  }
  if ((list.data.payments ?? []).length) await payRpc("pay_checked", { p_pays: list.data.payments }, env);
  for (const rf of list.data.refunds ?? []) if (await sendRefund(rf, env)) out.refunds++;
  return out;
}
