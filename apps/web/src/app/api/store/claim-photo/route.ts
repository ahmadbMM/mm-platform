import { sameOrigin } from "@/lib/account-core";
import { imageKind } from "@/lib/account-profile";
import { payReady } from "@/lib/pay/config";
import { json } from "@/lib/pay/http";
import { payRpc, refusal } from "@/lib/pay/server";
import { withinLimit } from "@/lib/rate-limit";
import { orderOf } from "@/lib/store-order";
import { UPLOAD_MAX } from "@/lib/sx-B4";
import { claimPhotoPathOk } from "@/lib/sx-f1";

// POST /api/store/claim-photo?no=<n>&k=<key> with a JPEG body: one photo for a warranty claim or a return (N08, N31;
// builder B4), shrunk on the phone first (1600 px, under 700 KB). Only for a delivered order read with its own key; the
// bytes must be a JPEG. It goes to the private Storage bucket store-claims at o<number>/<random>.jpg, a name the database
// hands this server for that order (store_after_photo_slot: one upload, five minutes, 24 a day per order); the bucket's
// policy takes nothing else from the public key, never over a file (security review 2026-11-18, M2). Staff read it from
// the claim or the return; the answer is that path, which the claim or the return then names (the database checks the
// folder).
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  if (!payReady()) return json({ ok: false, error: "pay_off" }, 503);
  if (!(await withinLimit(req, "pay"))) return json({ ok: false, error: "busy" }, 429);
  const q = new URL(req.url).searchParams;
  const no = Number(q.get("no")), key = (q.get("k") ?? "").toLowerCase();
  if (!Number.isInteger(no) || no < 1 || no > 999999999 || !/^[0-9a-f]{32}$/.test(key)) return json({ ok: false, error: "invalid" }, 400);
  if (Number(req.headers.get("content-length") || 0) > UPLOAD_MAX) return json({ ok: false, error: "large" }, 413);
  let buf: ArrayBuffer;
  try { buf = await req.arrayBuffer(); } catch { return json({ ok: false, error: "invalid" }, 400); }
  if (buf.byteLength > UPLOAD_MAX) return json({ ok: false, error: "large" }, 413);
  if (imageKind(new Uint8Array(buf)) !== "jpg") return json({ ok: false, error: "photos" }, 400);

  // the order, with its key, handed over: nothing is stored for anything else
  const r = await payRpc<unknown>("store_order_get", { p_no: no, p_track: key });
  const o = r.status === 200 ? orderOf(r.data, key) : null;
  if (!o) return json({ ok: false, error: "not_found" }, 404);
  if (o.status !== "delivered") return json({ ok: false, error: "state" }, 409);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return json({ ok: false, error: "generic" }, 502);
  // the name to store it at, from the database (its ticket): never one made here
  const t = await payRpc<{ path?: unknown }>("store_after_photo_slot", { p_no: no, p_track: key }, undefined, req);
  const path = t.status === 200 && typeof t.data?.path === "string" && claimPhotoPathOk(t.data.path, no) ? t.data.path : "";
  if (!path) {
    const c = refusal(t);
    if (c === "STORE_AFTER_BUSY") return json({ ok: false, error: "busy" }, 429);
    if (c === "STORE_AFTER_STATE") return json({ ok: false, error: "state" }, 409);
    if (c === "NOT_FOUND") return json({ ok: false, error: "not_found" }, 404);
    return json({ ok: false, error: t.code === "PGRST202" ? "off" : "generic" }, 502);
  }
  try {
    const up = await fetch(`${url}/storage/v1/object/store-claims/${path}`, {
      method: "POST",
      headers: { apikey: anon, Authorization: `Bearer ${anon}`, "content-type": "image/jpeg", "x-upsert": "false" },
      body: buf,
      signal: AbortSignal.timeout(10000),
    });
    if (!up.ok) return json({ ok: false, error: up.status === 404 || up.status === 400 ? "off" : "generic" }, 502);
  } catch {
    return json({ ok: false, error: "generic" }, 502);
  }
  return json({ ok: true, path });
}
