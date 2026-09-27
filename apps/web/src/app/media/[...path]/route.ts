// Photos staff upload in the staff page live in Supabase Storage (bucket "site"). The site shows
// them from here, so Cloudflare's edge keeps a copy and the database's egress is paid once per
// photo per location, not once per visitor. Upload names are unique, so a year's cache is safe.
//
// ?w=640 or ?w=1280 asks for the smaller WebP copy the staff page saves beside a photo it uploads
// (<name>.w640.webp); a photo uploaded before those copies existed is answered with itself. That
// fallback costs a round trip every time: the storage answers a missing copy with 400, which
// Cloudflare does not cache. To do, in the booking app's staff page (never from here - this route
// only reads): back-fill the two copies for the photos uploaded before 2026-09-27, so every ?w=
// request is answered from the edge.
//
// Only pictures and PDFs are served: raster images (a model's photos, a category's cover) and the
// catalogue's spec sheets. Never SVG: an SVG is a document that can carry script, and served inline
// from the site's own address it would run as the site. The type is the storage's own, never
// guessed from the name (nosniff). Eight seconds per fetch: past that the answer is a 504 nobody
// keeps, not a Worker hanging on a slow bucket.
const WIDTHS = new Set(["640", "1280"]);
const TIMEOUT_MS = 8000;
const SERVED = /^(?:image\/(?!svg)[a-z0-9.+-]+|application\/pdf)\b/i;

/** One fetch from the bucket, kept at the edge for a year; null when it was unreachable or slow. */
async function fromStorage(url: string): Promise<Response | null> {
  const init: RequestInit & { cf?: Record<string, unknown> } = { cf: { cacheTtl: 31536000, cacheEverything: true }, signal: AbortSignal.timeout(TIMEOUT_MS) };
  try {
    return await fetch(url, init as RequestInit);
  } catch {
    return null;
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const rel = path.join("/");
  if (!/^[a-z0-9_-]+(\/[A-Za-z0-9_.-]+)+$/.test(rel) || rel.includes("..")) return new Response("Not found", { status: 404 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return new Response("Not found", { status: 404 });
  const base = `${url}/storage/v1/object/public/site/`;
  const w = new URL(req.url).searchParams.get("w") ?? "";
  const small = WIDTHS.has(w) && /\.(jpe?g|png|webp)$/i.test(rel) ? rel.replace(/\.(jpe?g|png|webp)$/i, `.w${w}.webp`) : "";
  let res = small ? await fromStorage(base + small) : null;
  if (!res || !res.ok) res = await fromStorage(base + rel);
  if (!res) return new Response("The photo could not be fetched", { status: 504, headers: { "cache-control": "no-store" } });
  if (!res.ok) return new Response("Not found", { status: 404, headers: { "cache-control": "public, max-age=60" } });
  const type = res.headers.get("content-type") || "application/octet-stream";
  if (!SERVED.test(type)) return new Response("Not found", { status: 404 });
  return new Response(res.body, {
    // inline: a spec sheet opens in the browser's own viewer rather than downloading.
    headers: { "content-type": type, "content-disposition": "inline", "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" },
  });
}
