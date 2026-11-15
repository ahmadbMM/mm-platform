import { guard, json } from "@/lib/pay/http";
import { promoCheck } from "@/lib/store-api";

// POST /api/store/promo {code, items:[{variant, qty}]}: what a code takes off these cart lines (F67; store_promo_check,
// CONTRACTS.md section 5.1). The database prices the lines itself, needs the discount licence for any code and meters
// the asking; it changes nothing (checkout applies the code again and counts its use). Answers {ok, code, discount,
// eligible} or {ok: false, error} ("promo", "promo_min", "promo_used", "licence", "busy").
export async function POST(req: Request) {
  const g = await guard(req, { signin: false });
  if (!g.ok) return g.res;
  const code = typeof g.body.code === "string" ? g.body.code.slice(0, 40) : "";
  const items = (Array.isArray(g.body.items) ? g.body.items : []).slice(0, 20).map((x) => {
    const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    return { variant: typeof o.variant === "string" ? o.variant.toLowerCase() : "", qty: Number(o.qty) };
  });
  const r = await promoCheck(code, items);
  if (!r.ok) return json({ ok: false, error: r.error }, r.status);
  return json({ ok: true, code: r.data.code, discount: Number(r.data.discount) || 0, eligible: Number(r.data.eligible) || 0 });
}
