import { rpcServer } from "@/lib/account";
import { json, unreachable, writeSession } from "@/lib/account-route";
import { PHOTO_MAX_BYTES, imageKind, photoBase } from "@/lib/account-profile";

// The account's photo, as the booking app's My Account keeps it. POST: the image the page made
// (a 256 px square JPEG, resized in the browser) goes to the public Storage bucket `photos` at
// p/<random>.<kind> - the only place its policy lets anyone add to, and never over an existing
// file - and the account takes its address (customer_set_photo). The session is checked before
// anything is stored, the bytes must be a JPEG, PNG or WebP of 400 KB at most, and the answer is
// the photo's address. DELETE: the account has no photo again (customer_set_photo null).
const TYPES = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;

export async function POST(req: Request) {
  const w = writeSession(req);
  if ("refuse" in w) return w.refuse;
  const { id, token } = w.session;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return json({ ok: false, error: "generic" }, 502);
  const len = Number(req.headers.get("content-length") || 0);
  if (len > PHOTO_MAX_BYTES) return json({ ok: false, error: "large" }, 413);
  let buf: ArrayBuffer;
  try { buf = await req.arrayBuffer(); } catch { return json({ ok: false, error: "invalid" }, 400); }
  const bytes = new Uint8Array(buf);
  if (bytes.length > PHOTO_MAX_BYTES) return json({ ok: false, error: "large" }, 413);
  const kind = imageKind(bytes);
  if (!kind) return json({ ok: false, error: "invalid" }, 400);

  // Only a signed-in account stores anything.
  const who = await rpcServer<unknown[]>("customer_profile", { p_id: id, p_token: token });
  if (unreachable(who)) return json({ ok: false, error: "generic" }, 502);
  if (!Array.isArray(who.data) || !who.data.length) return json({ ok: false, error: "signin" }, 401);

  const path = `p/${crypto.randomUUID().replace(/-/g, "")}.${kind}`;
  try {
    const up = await fetch(`${url}/storage/v1/object/photos/${path}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "content-type": TYPES[kind], "x-upsert": "false", "cache-control": "max-age=31536000" },
      body: buf,
      signal: AbortSignal.timeout(8000),
    });
    if (!up.ok) return json({ ok: false, error: "generic" }, 502);
  } catch {
    return json({ ok: false, error: "generic" }, 502);
  }
  const photo = `${photoBase(url)}${path}`;
  const r = await rpcServer<boolean>("customer_set_photo", { p_id: id, p_token: token, p_photo: photo });
  if (unreachable(r)) return json({ ok: false, error: "generic" }, 502);
  if (r.data !== true) return json({ ok: false, error: "signin" }, 401);
  return json({ ok: true, photo });
}

export async function DELETE(req: Request) {
  const w = writeSession(req);
  if ("refuse" in w) return w.refuse;
  const r = await rpcServer<boolean>("customer_set_photo", { p_id: w.session.id, p_token: w.session.token, p_photo: null });
  if (unreachable(r)) return json({ ok: false, error: "generic" }, 502);
  if (r.data !== true) return json({ ok: false, error: "signin" }, 401);
  return json({ ok: true });
}
