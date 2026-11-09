import { rpcServer } from "@/lib/account";
import { guard, json, langOf, payError } from "@/lib/pay/http";
import { payRpc, type PayView } from "@/lib/pay/server";

// POST /api/pay/locker {id, token, day, period, codes, names, lang}: micromobility.sa/lockers' "Pay by card".
// The lockers page keeps its own sign-in (its id and token, as it calls customer_locker_book itself), so
// they come in the body here; the database checks them. The lockers are reserved for card payment
// (customer_locker_book, p_pay 'card') and held for pay.holdMinutes while the rider pays; unpaid, they are
// let go by themselves.
export async function POST(req: Request) {
  const g = await guard(req, { signin: false });
  if (!g.ok) return g.res;
  const b = g.body;
  const id = typeof b.id === "string" ? b.id : "", token = typeof b.token === "string" ? b.token : "";
  const day = typeof b.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.day) ? b.day : "";
  const period = typeof b.period === "string" && /^(early|late|both|pm)$/.test(b.period) ? b.period : "";
  const codes = Array.isArray(b.codes) ? b.codes.filter((x): x is string => typeof x === "string").slice(0, 3).map((x) => x.slice(0, 8)) : [];
  const names = Array.isArray(b.names) ? b.names.map((x) => (typeof x === "string" ? x.slice(0, 60) : "")).slice(0, 3) : null;
  if (!id || !token || !day || !period || !codes.length) return json({ ok: false, error: "invalid" }, 400);
  const booked = await rpcServer<{ ok: boolean; rentals: { id: string }[] }>("customer_locker_book", {
    p_id: id, p_token: token, p_day: day, p_period: period, p_codes: codes, p_pay: "card", p_names: names,
  }, 8000);
  if (booked.status !== 200 || !booked.data?.rentals?.length) { const e = payError(booked); return json({ ok: false, error: e.error, detail: booked.message }, e.status); }
  const r = await payRpc<PayView>("pay_locker_start", { p_id: id, p_token: token, p_rentals: booked.data.rentals.map((x) => x.id), p_lang: langOf(b.lang) });
  if (r.status !== 200 || !r.data) { const e = payError(r); return json({ ok: false, error: e.error }, e.status); }
  return json({ ok: true, pay: r.data.id, url: `/pay/${r.data.id}` });
}
