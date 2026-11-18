import { guard, json } from "@/lib/pay/http";
import { arrive } from "@/lib/sx-B4-api";

// POST /api/store/arrive {no, key, car}: "I'm here" (N14, builder B4) on a pickup order's page on its pickup day: the
// customer is at the showroom, with their car's colour if they gave it (store_after_arrive; staff see it at once in the
// staff Store screen). The order is named by its number and its own key, never by the account. Answers {ok, arrival}
// or {ok: false, error: state | car | not_found | busy | off | ...}.
export async function POST(req: Request) {
  const g = await guard(req, { signin: false });
  if (!g.ok) return g.res;
  const b = g.body;
  const no = typeof b.no === "number" ? b.no : Number(b.no);
  const key = typeof b.key === "string" ? b.key.trim().toLowerCase() : "";
  const r = await arrive({ no, key, car: b.car });
  return r.ok ? json({ ok: true, arrival: r.data.arrival }) : json({ ok: false, error: r.error }, r.status);
}
