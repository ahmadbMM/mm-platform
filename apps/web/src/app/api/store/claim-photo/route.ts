import { sameOrigin } from "@/lib/account-core";
import { imageKind } from "@/lib/account-profile";
import { payReady } from "@/lib/pay/config";
import { json } from "@/lib/pay/http";
import { payRpc } from "@/lib/pay/server";
import { withinLimit } from "@/lib/rate-limit";
import { orderOf } from "@/lib/store-order";
import { UPLOAD_MAX } from "@/lib/sx-B4";

// POST /api/store/claim-photo?no=<n>&k=<key> with a JPEG body: one photo for a warranty claim or a return (N08, N31;
// builder B4), shrunk on the phone first (1600 px, under 700 KB). Only for a delivered order read with its own key; the
// bytes must be a JPEG. It goes to the private Storage bucket store-claims at o<number>/<random>.jpg (the only place its
// policy lets the public key add to, never over a file: SX/sql/B4.sql), where staff read it from the claim or the
// return; the answer is that path, which the claim or the return then names (the database checks the folder).
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
  const path = `o${no}/${crypto.randomUUID().replace(/-/g, "")}.jpg`;
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
