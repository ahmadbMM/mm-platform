import { ACCOUNT_COOKIE, decodeSession, sameOrigin } from "@/lib/account-core";
import { birthOk } from "@/lib/booking";
import { rpcCall } from "@/lib/booking-server";
import { cookieValue } from "@/lib/live";
import { riyadhClock } from "@/lib/workshop-days";

// POST /api/booking/profile {birth, nationality, community, ask}: the details the booking app asks
// for before a booking (_profileGate): the nationality from the first booking and the birth date from
// the fourth, through customer_set_birth_nat; for a community member the server asked them of, through
// customer_fix_save, which answers with what is still owed. `ask` names what the page asked ("birth",
// "nat"; both when it is missing): only those are checked, and customer_set_birth_nat, which writes the
// two, is given the other as the account holds it now (customer_profile), so it is never cleared (_pgSave).
// The rider's own id and token come from the cookie. Only this site's own pages may call it.
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ ok: false, error: "signin" }, 401);
  let b: { birth?: unknown; nationality?: unknown; community?: unknown; ask?: unknown } = {};
  try { b = (await req.json()) as typeof b; } catch { /* empty body */ }
  const birth = String(b.birth ?? ""), nat = String(b.nationality ?? "").trim().slice(0, 80);
  const asked = Array.isArray(b.ask) ? (b.ask as unknown[]).filter((k): k is "birth" | "nat" => k === "birth" || k === "nat") : [];
  const ask: ("birth" | "nat")[] = asked.length ? asked : ["birth", "nat"];
  // Riyadh's day, never the locale's formatting (an iOS gave en-CA dates as 10/27/2026)
  const today = riyadhClock(new Date()).slice(0, 10);
  if (ask.includes("birth") && !birthOk(birth, today)) return json({ ok: false, error: "birth" }, 400);
  if (ask.includes("nat") && !nat) return json({ ok: false, error: "nationality" }, 400);
  const args = { p_id: acct.id, p_token: acct.token };
  if (b.community === true) {
    // the server takes what it asked for and ignores the rest
    const values = { ...(ask.includes("birth") ? { birth_date: birth } : {}), ...(ask.includes("nat") ? { nationality: nat } : {}) };
    const r = await rpcCall<string[]>("customer_fix_save", { ...args, p_values: values });
    if (r.status === 0 || r.status >= 500) return json({ ok: false, error: "generic" }, 502);
    if (!Array.isArray(r.data)) return json({ ok: false, error: "signin" }, 401);
    if (r.data.some((k) => k === "birth_date" || k === "nationality")) return json({ ok: false, error: "generic" }, 409);
    return json({ ok: true, asks: r.data });
  }
  let keep: Record<string, unknown> = {};
  if (ask.length < 2) {
    const p = await rpcCall<Record<string, unknown>[]>("customer_profile", args);
    if (p.status === 0 || p.status >= 500) return json({ ok: false, error: "generic" }, 502);
    const row = Array.isArray(p.data) ? p.data[0] : null;
    if (!row) return json({ ok: false, error: "signin" }, 401);
    keep = row;
  }
  const r = await rpcCall<boolean>("customer_set_birth_nat", {
    ...args,
    p_birth_date: ask.includes("birth") ? birth : typeof keep.birth_date === "string" ? keep.birth_date : null,
    p_nationality: ask.includes("nat") ? nat : typeof keep.nationality === "string" ? keep.nationality : null,
  });
  if (r.status === 0 || r.status >= 500) return json({ ok: false, error: "generic" }, 502);
  if (r.data !== true) return json({ ok: false, error: "signin" }, 401);
  return json({ ok: true, asks: [] });
}
