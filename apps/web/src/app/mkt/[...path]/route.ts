import { MK_PHOTO_NAME, MK_SMALL_SIDE, mkSmallName } from "@/lib/market/core";

// The photos of the Marketplace's listings and the shops' logos live in Supabase Storage (bucket "market", public
// read). The site shows them from here, as it shows staff's photos from /media: Cloudflare's edge keeps a copy, so the
// database's egress is paid once per photo per location and day, not once per visitor. A name is issued once by the
// database and never written twice, so a copy never goes stale - but a photo the database lets go of (a seller took it
// off, a listing long deleted) must stop being served: the edge keeps a copy for a day and a browser for an hour (then
// uses it while it asks again).
//
//   /mkt/l<listing>/<32 hex>.jpg|webp        the full photo (longest side 1600)
//   /mkt/s<shop>/<32 hex>.jpg|webp           a shop's logo
//   ?w=480                                   the small copy stored beside it (<name>.w480.<ext>); a photo whose small
//                                            copy is not there is answered with itself
//
// Only a name of that exact shape is asked for, and only a JPEG or a WebP picture is handed over, by the storage's own
// type (nosniff): nothing else in the bucket, and never an SVG. Eight seconds per fetch: past that the answer is a 504
// nobody keeps, not a Worker hanging on a slow bucket.
const TIMEOUT_MS = 8000;
const SERVED = /^image\/(?:jpeg|webp)\b/i;
/** How long Cloudflare's edge keeps a file fetched from the bucket: a day. */
const EDGE_TTL_S = 86400;
/** What a browser is told: an hour, then the copy it has while it asks again (up to a day). */
const PHOTO_CACHE = "public, max-age=3600, stale-while-revalidate=86400";

/** One fetch from the bucket, kept at the edge for a day; null when it was unreachable or slow. */
async function fromStorage(url: string): Promise<Response | null> {
  const init: RequestInit & { cf?: Record<string, unknown> } = { cf: { cacheTtl: EDGE_TTL_S, cacheEverything: true }, signal: AbortSignal.timeout(TIMEOUT_MS) };
  try {
    return await fetch(url, init as RequestInit);
  } catch {
    return null;
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const rel = path.join("/");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!MK_PHOTO_NAME.test(rel) || !url) return new Response("Not found", { status: 404, headers: { "cache-control": "public, max-age=60" } });
  const base = `${url}/storage/v1/object/public/market/`;
  const small = new URL(req.url).searchParams.get("w") === String(MK_SMALL_SIDE);
  let res = small ? await fromStorage(base + mkSmallName(rel)) : null;
  if (!res || !res.ok) res = await fromStorage(base + rel);
  if (!res) return new Response("The photo could not be fetched", { status: 504, headers: { "cache-control": "no-store" } });
  if (!res.ok) return new Response("Not found", { status: 404, headers: { "cache-control": "public, max-age=60" } });
  const type = res.headers.get("content-type") || "application/octet-stream";
  if (!SERVED.test(type)) return new Response("Not found", { status: 404 });
  return new Response(res.body, {
    headers: { "content-type": type, "content-disposition": "inline", "cache-control": PHOTO_CACHE, "x-content-type-options": "nosniff" },
  });
}
