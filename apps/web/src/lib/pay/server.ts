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
  // Done only once the database recorded it so: an answer it could not record (a timeout, an error) leaves the refund
  // pending for the reconcile run, which confirms it by Moyasar's total; it was reported done while still pending.
  const done = async (total: number) => {
    const d = await payRpc<{ status?: string }>("pay_refund_done", { p_refund: rf.id, p_ok: true, p_refunded_halalas: total, p_error: null }, env);
    return d.status === 200 && d.data?.status === "done";
  };
  const fail = (why: string) => payRpc("pay_refund_done", { p_refund: rf.id, p_ok: false, p_refunded_halalas: 0, p_error: why.slice(0, 300) }, env);
  const before = await fetchPayment(sk, rf.provider_id);
  if (!before.ok) { await fail(`gateway ${before.status} ${before.message}`); return false; }
  const r0 = before.data.refunded ?? 0;
  const r = await refundPayment(sk, rf.provider_id, want);
  if (r.ok) return done(r.data.refunded ?? r0 + want);
  const after = await fetchPayment(sk, rf.provider_id);
  if (after.ok && (after.data.refunded ?? 0) >= r0 + want) return done(after.data.refunded ?? r0 + want);
  // No answer (a timeout: the request may still land after that reading), or Moyasar's own error with its total not
  // read again: the refund may have gone through. It stays pending for the reconcile run to judge by Moyasar's total
  // minutes later (confirmRefunds). Failed is what staff retry, and a retry of a refund that went through pays twice.
  if (r.status === 0 || (r.status >= 500 && !after.ok)) return false;
  await fail(`${r.status} ${r.message}`);
  return false;
}

/** Refunds left 'pending' minutes ago on one Moyasar payment (the server stopped between Moyasar and the database,
 *  or Moyasar never answered): never sent again. Moyasar's refunded total is one number for all of them. What it holds
 *  beyond the card refunds the database counts done (the oldest one's 'already', pay_reconcile_list, rentals
 *  20261110235200) is the money these pending ones may account for, and only refunds whose amounts add up to exactly
 *  that went through (bug hunt 2026-11-11: oldest first, an older refund that never left was confirmed by a newer
 *  one's money, and the newer one marked failed for staff to send again). When one set of amounts adds up, those
 *  refunds are confirmed and the rest marked failed for staff to check and retry; when none does (a refund still being
 *  sent, or one made on Moyasar's dashboard) or two different ones do, nothing is judged for an hour, then all are
 *  marked failed for staff to check Moyasar's dashboard. The database is told the total counted so far, not Moyasar's
 *  whole total; it keeps whichever is more of that and the refunds done (pay_refund_done). Answers how many were
 *  confirmed and recorded. */
export async function confirmRefunds(list: PendingRefund[], env: PayEnv = payEnv()): Promise<number> {
  const id = list[0]?.provider_id;
  if (!id || !env.MOYASAR_SECRET_KEY || list.some((rf) => rf.provider_id !== id)) return 0;
  const f = await fetchPayment(env.MOYASAR_SECRET_KEY, id);
  if (!f.ok) return 0; // asked again on the next run
  const total = f.data.refunded ?? 0;
  // the smallest 'already' is the oldest refund's: the done ones alone (a database before 20261110235200 gave every
  // refund the same, the payment's refunded total, which this reads the same way)
  let counted = toHalalas(Math.max(0, Math.min(...list.map((rf) => Number(rf.already) || 0))));
  const order = (rf: PendingRefund) => `${rf.created_at ?? ""}|${rf.id}`;
  const sorted = [...list].sort((a, b) => order(a).localeCompare(order(b))).slice(0, 12); // the rest wait for a later run
  const wants = sorted.map((rf) => toHalalas(rf.amount));
  // every set of these refunds whose amounts add up to what Moyasar refunded beyond the ones done (the empty set when
  // nothing more left), told apart by their amounts alone: two refunds of one amount are the same money
  const extra = total - counted;
  const amounts = (m: number) => wants.filter((w, i) => w > 0 && m & (1 << i)).sort((a, b) => a - b).join(",");
  const fits: string[] = [];
  for (let m = 0; m < 1 << sorted.length; m++) {
    if (wants.reduce((s, w, i) => (m & (1 << i) ? s + w : s), 0) === extra && !fits.includes(amounts(m))) fits.push(amounts(m));
  }
  const fail = (rf: PendingRefund) =>
    payRpc("pay_refund_done", { p_refund: rf.id, p_ok: false, p_refunded_halalas: 0, p_error: "not confirmed by Moyasar: check its dashboard, then retry" }, env);
  if (fits.length !== 1) {
    const newest = Math.max(...sorted.map((rf) => Date.parse(rf.created_at ?? "") || 0));
    if (Date.now() - newest < 3600000) return 0; // asked again on the next run
    for (const rf of sorted) await fail(rf);
    return 0;
  }
  // the refunds that went through, oldest first for each amount
  const left = fits[0] ? fits[0].split(",").map(Number) : [];
  let n = 0;
  for (const [i, rf] of sorted.entries()) {
    const k = left.indexOf(wants[i]);
    if (k < 0) { await fail(rf); continue; }
    left.splice(k, 1);
    counted += wants[i]; // in Moyasar's total either way: a record that failed is judged again on the next run
    const d = await payRpc<{ status?: string }>("pay_refund_done", { p_refund: rf.id, p_ok: true, p_refunded_halalas: counted, p_error: null }, env);
    if (d.status === 200 && d.data?.status === "done") n++;
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
