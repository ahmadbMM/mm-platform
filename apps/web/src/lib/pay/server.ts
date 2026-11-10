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
/** A refund the reconcile run lists: 'already' is what the database counted as refunded on that Moyasar payment. */
export type PendingRefund = Refund & { already?: number; created_at?: string };
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

/** Sends a refund the database wrote 'pending' to Moyasar and records the answer. Moyasar documents no
 *  idempotency key for refunds, so the payment's refunded total is read first: an answer lost on the way (a
 *  timeout) is judged by whether that total grew by this refund, never by sending it again. */
export async function sendRefund(rf: Refund, env: PayEnv = payEnv()): Promise<boolean> {
  if (!rf.provider_id || !env.MOYASAR_SECRET_KEY) return false;
  const sk = env.MOYASAR_SECRET_KEY, want = toHalalas(rf.amount);
  const done = (total: number) => payRpc("pay_refund_done", { p_refund: rf.id, p_ok: true, p_refunded_halalas: total, p_error: null }, env);
  const fail = (why: string) => payRpc("pay_refund_done", { p_refund: rf.id, p_ok: false, p_refunded_halalas: 0, p_error: why.slice(0, 300) }, env);
  const before = await fetchPayment(sk, rf.provider_id);
  if (!before.ok) { await fail(`gateway ${before.status} ${before.message}`); return false; }
  const r0 = before.data.refunded ?? 0;
  const r = await refundPayment(sk, rf.provider_id, want);
  if (r.ok) { await done(r.data.refunded ?? r0 + want); return true; }
  const after = await fetchPayment(sk, rf.provider_id);
  if (after.ok && (after.data.refunded ?? 0) >= r0 + want) { await done(after.data.refunded ?? r0 + want); return true; }
  // No answer (a timeout: the request may still land after that reading), or Moyasar's own error with its total not
  // read again: the refund may have gone through. It stays pending for the reconcile run to judge by Moyasar's total
  // minutes later (confirmRefunds). Failed is what staff retry, and a retry of a refund that went through pays twice.
  if (r.status === 0 || (r.status >= 500 && !after.ok)) return false;
  await fail(`${r.status} ${r.message}`);
  return false;
}

/** Refunds left 'pending' minutes ago on one Moyasar payment (the server stopped between Moyasar and the database,
 *  or Moyasar never answered): never sent again. Moyasar's refunded total is one number for all of them, so they are
 *  counted one after another, oldest first, from what the database already counted for that payment: each is
 *  confirmed only while the total covers it too (two refunds are never confirmed by the same money), and the rest are
 *  marked failed for staff to check and retry. The database is told the total counted so far, not Moyasar's whole
 *  total, which may hold a refund still pending. Answers how many were confirmed. */
export async function confirmRefunds(list: PendingRefund[], env: PayEnv = payEnv()): Promise<number> {
  const id = list[0]?.provider_id;
  if (!id || !env.MOYASAR_SECRET_KEY || list.some((rf) => rf.provider_id !== id)) return 0;
  const f = await fetchPayment(env.MOYASAR_SECRET_KEY, id);
  if (!f.ok) return 0; // asked again on the next run
  const total = f.data.refunded ?? 0;
  let counted = toHalalas(Math.max(0, ...list.map((rf) => Number(rf.already) || 0)));
  let n = 0;
  for (const rf of [...list].sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")))) {
    const want = toHalalas(rf.amount);
    if (want > 0 && total >= counted + want) {
      counted += want;
      await payRpc("pay_refund_done", { p_refund: rf.id, p_ok: true, p_refunded_halalas: counted, p_error: null }, env);
      n++;
    } else {
      await payRpc("pay_refund_done", { p_refund: rf.id, p_ok: false, p_refunded_halalas: 0, p_error: "not confirmed by Moyasar: check its dashboard, then retry" }, env);
    }
  }
  return n;
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
 *  catches a rider who closed the tab after 3-D Secure while a webhook was lost. A refund left pending is
 *  confirmed against Moyasar, never sent twice. */
export async function reconcile(env: PayEnv = payEnv()): Promise<{ checked: number; settled: number; refunds: number }> {
  const out = { checked: 0, settled: 0, refunds: 0 };
  if (!env.MOYASAR_SECRET_KEY) return out;
  const list = await payRpc<{ payments: string[]; refunds: PendingRefund[] }>("pay_reconcile_list", {}, env);
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
  // the pending refunds by Moyasar payment: its one refunded total judges them together (confirmRefunds)
  const byPayment = new Map<string, PendingRefund[]>();
  for (const rf of list.data.refunds ?? []) {
    if (!rf.provider_id) continue;
    byPayment.set(rf.provider_id, [...(byPayment.get(rf.provider_id) ?? []), rf]);
  }
  for (const group of byPayment.values()) out.refunds += await confirmRefunds(group, env);
  return out;
}
