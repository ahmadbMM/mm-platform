import { loadSiteContent } from "@/lib/site";
import { smsaLabel } from "@/lib/store-api";
import { storeSwitches } from "@/lib/store-settings";

// POST /api/store/smsa-label (F108): staff, in the staff page's Store > Orders, ask SMSA for a waybill and its label for
// an order going across the kingdom by courier. Built but off: it answers smsa_off until staff switch store.smsa.on on
// AND the Worker has SMSA's key (SMSA_API_KEY, a Worker secret, never in the database or the page). The staff page sends
// its own signed-in session (Authorization: Bearer <access token>) as it does for /api/pay/refund; the order is read
// with that session first (only staff may read store orders), so nobody else can have a label made. Once SMSA answers,
// the order is marked shipped with SMSA and the waybill, with the same session (staff_store_order_set), and the label
// (a PDF, base64) goes back to be printed.
// Body: {order}. Answers {ok: true, awb, label, saved} or {ok: false, error: smsa_off | signin | not_found | state | invalid | ...}.
export const dynamic = "force-dynamic";

const STAFF_ORIGINS = ["https://staff.micromobility.sa", "https://staff-staging.micromobility.sa", "https://micromobility-staff-staging.pages.dev"];
const allowed = (o: string | null) => !!o && (STAFF_ORIGINS.includes(o) || (process.env.MM_ENV === "staging" && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(o)));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cors(origin: string | null, res: Response): Response {
  if (allowed(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin!);
    res.headers.set("Vary", "Origin");
  }
  return res;
}
const json = (origin: string | null, body: unknown, status = 200) =>
  cors(origin, new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } }));

export function OPTIONS(req: Request) {
  const o = req.headers.get("origin");
  const res = new Response(null, { status: 204 });
  if (allowed(o)) {
    res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "authorization, content-type");
    res.headers.set("Access-Control-Max-Age", "600");
  }
  return cors(o, res);
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (!allowed(origin)) return new Response("forbidden", { status: 403 });
  // off means absent: nothing is read or asked while the switch is off
  if (!storeSwitches(await loadSiteContent()).smsa) return json(origin, { ok: false, error: "smsa_off" }, 503);
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!/^[A-Za-z0-9._-]{20,4096}$/.test(jwt)) return json(origin, { ok: false, error: "signin" }, 401);
  let b: Record<string, unknown> = {};
  try { b = (await req.json()) as Record<string, unknown>; } catch { /* empty */ }
  const order = typeof b.order === "string" && UUID.test(b.order) ? b.order.toLowerCase() : null;
  if (!order) return json(origin, { ok: false, error: "invalid" }, 400);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return json(origin, { ok: false, error: "config" }, 503);
  const headers = { apikey: key, Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" };
  // the order as staff read it (store orders are staff's alone to read): who asks is staff, and it goes by courier
  const read = await fetch(`${url}/rest/v1/store_orders?id=eq.${order}&select=id,status,fulfil`, { headers, cache: "no-store", signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!read) return json(origin, { ok: false, error: "generic" }, 502);
  if (read.status === 401) return json(origin, { ok: false, error: "signin" }, 401);
  const rows = (await read.json().catch(() => null)) as { id: string; status: string; fulfil: string }[] | null;
  const o = Array.isArray(rows) ? rows[0] : null;
  if (!o) return json(origin, { ok: false, error: "not_found" }, 404);
  if (o.fulfil !== "ksa" || !["paid", "preparing"].includes(o.status)) return json(origin, { ok: false, error: "state" }, 409);

  const lbl = await smsaLabel(o.id, true);
  if (!lbl.ok) return json(origin, { ok: false, error: lbl.error }, lbl.status);
  const set = await fetch(`${url}/rest/v1/rpc/staff_store_order_set`, {
    method: "POST", headers, cache: "no-store", signal: AbortSignal.timeout(8000),
    body: JSON.stringify({ p_order: o.id, p_status: "shipped", p_note: null, p_courier: "SMSA", p_tracking: lbl.data.awb }),
  }).catch(() => null);
  // the waybill exists at SMSA either way: its label goes back, and staff type the waybill in by hand if it was not saved
  return json(origin, { ok: true, awb: lbl.data.awb, label: lbl.data.label, saved: !!set?.ok });
}
