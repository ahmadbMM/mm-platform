import { ACCOUNT_COOKIE, decodeSession, sameOrigin } from "@/lib/account-core";
import { birthOk } from "@/lib/booking";
import { rpcCall } from "@/lib/booking-server";
import { cookieValue } from "@/lib/live";

// POST /api/booking/profile {birth, nationality, community}: the two details the booking app asks
// for before a booking (_profileGate): after the eighth booking, through customer_set_birth_nat;
// for a community member the server asked them of, through customer_fix_save, which answers with
// what is still owed. The rider's own id and token come from the cookie. Only this site's own
// pages may call it.
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ ok: false, error: "signin" }, 401);
  let b: { birth?: unknown; nationality?: unknown; community?: unknown } = {};
  try { b = (await req.json()) as typeof b; } catch { /* empty body */ }
  const birth = String(b.birth ?? ""), nat = String(b.nationality ?? "").trim().slice(0, 80);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
  if (!birthOk(birth, today)) return json({ ok: false, error: "birth" }, 400);
  if (!nat) return json({ ok: false, error: "nationality" }, 400);
  const args = { p_id: acct.id, p_token: acct.token };
  if (b.community === true) {
    const r = await rpcCall<string[]>("customer_fix_save", { ...args, p_values: { birth_date: birth, nationality: nat } });
    if (r.status === 0 || r.status >= 500) return json({ ok: false, error: "generic" }, 502);
    if (!Array.isArray(r.data)) return json({ ok: false, error: "signin" }, 401);
    if (r.data.some((k) => k === "birth_date" || k === "nationality")) return json({ ok: false, error: "generic" }, 409);
    return json({ ok: true, asks: r.data });
  }
  const r = await rpcCall<boolean>("customer_set_birth_nat", { ...args, p_birth_date: birth, p_nationality: nat });
  if (r.status === 0 || r.status >= 500) return json({ ok: false, error: "generic" }, 502);
  if (r.data !== true) return json({ ok: false, error: "signin" }, 401);
  return json({ ok: true, asks: [] });
}
