import { guard, json } from "@/lib/pay/http";
import { loadSiteContent } from "@/lib/site";
import { afterSettings } from "@/lib/sx-B4";
import { pushSet } from "@/lib/sx-B4-api";

// POST /api/store/order-push {no, key, on}: notifications for this order's status on the account's browsers (N04,
// builder B4; off until staff turn store.push.on on). The account is the signed-in one (its cookie, never the body);
// the database checks its token and that it placed the order (store_after_push). The browser itself is subscribed
// through /api/account/push, as the Account page's switch does.
export async function POST(req: Request) {
  const g = await guard(req, { signin: true });
  if (!g.ok) return g.res;
  if (!afterSettings(await loadSiteContent()).push) return json({ ok: false, error: "push_off" }, 409);
  const b = g.body;
  const no = typeof b.no === "number" ? b.no : Number(b.no);
  const key = typeof b.key === "string" ? b.key.trim().toLowerCase() : "";
  const acct = g.acct;
  if (!acct) return json({ ok: false, error: "signin" }, 401);
  const r = await pushSet({ no, key, on: b.on === true, customer: acct.id, token: acct.token });
  return r.ok ? json({ ok: true, on: r.data.push }) : json({ ok: false, error: r.error }, r.status);
}
