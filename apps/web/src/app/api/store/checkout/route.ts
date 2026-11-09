import { guard, json, langOf, payError, refusedVariant } from "@/lib/pay/http";
import { payRpc, type PayView } from "@/lib/pay/server";

// POST /api/store/checkout: places a store order (store_checkout) and answers where to pay it. A guest
// may order (name and a Saudi mobile; the order is tracked by its number and that phone); a signed-in
// account's order is theirs, and only they may let the wallet pay part of it. The body names variants and
// quantities, never a price: every price, the delivery fee and the total are the database's. Stock is held
// for store.orderMinutes while the customer pays, and put back if they do not.
// Body: {items:[{variant, qty}], fulfil, contact:{name, phone, email}, address?, note?, wallet?, lang}.
export async function POST(req: Request) {
  const g = await guard(req, { signin: false });
  if (!g.ok) return g.res;
  const b = g.body;
  const items = Array.isArray(b.items)
    ? b.items.slice(0, 20).map((x) => {
        const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
        return { variant: typeof o.variant === "string" ? o.variant : "", qty: Number(o.qty) };
      }).filter((x) => /^[0-9a-f-]{36}$/i.test(x.variant) && Number.isInteger(x.qty) && x.qty >= 1 && x.qty <= 10)
    : [];
  if (!items.length) return json({ ok: false, error: "empty" }, 400);
  const str = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : undefined);
  const c = (b.contact && typeof b.contact === "object" ? b.contact : {}) as Record<string, unknown>;
  const a = (b.address && typeof b.address === "object" ? b.address : {}) as Record<string, unknown>;
  const order = {
    items,
    fulfil: str(b.fulfil, 10),
    contact: { name: str(c.name, 60), phone: str(c.phone, 20), email: str(c.email, 120) },
    address: { city: str(a.city, 40), district: str(a.district, 60), street: str(a.street, 80), building: str(a.building, 10),
               postal: str(a.postal, 5), extra: str(a.extra, 4), short: str(a.short, 8), notes: str(a.notes, 200) },
    note: str(b.note, 300),
    wallet: b.wallet === true && !!g.acct,
    lang: langOf(b.lang),
  };
  const r = await payRpc<{ order: { id: string; no: number; status: string; total: number }; key: string; payment: PayView | null }>("store_checkout", {
    p_id: g.acct?.id ?? null, p_token: g.acct?.token ?? null, p_order: order,
  });
  if (r.status !== 200 || !r.data) {
    const e = payError(r);
    return json({ ok: false, error: e.error, variant: refusedVariant(r.message) }, e.status);
  }
  const { order: o, key, payment } = r.data;
  return json({
    ok: true, no: o.no, key,
    url: payment ? `/pay/${payment.id}` : `/store/order/${o.no}?k=${key}`,
  });
}
