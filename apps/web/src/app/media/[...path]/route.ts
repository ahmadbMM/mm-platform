// Photos staff upload in the staff page live in Supabase Storage (bucket "site"). The site shows
// them from here, so Cloudflare's edge keeps a copy and the database's egress is paid once per
// photo per location, not once per visitor. Upload names are unique, so a year's cache is safe.
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const rel = path.join("/");
  if (!/^[a-z0-9_-]+(\/[A-Za-z0-9_.-]+)+$/.test(rel) || rel.includes("..")) return new Response("Not found", { status: 404 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return new Response("Not found", { status: 404 });
  const init: RequestInit & { cf?: Record<string, unknown> } = { cf: { cacheTtl: 31536000, cacheEverything: true } };
  const res = await fetch(`${url}/storage/v1/object/public/site/${rel}`, init as RequestInit);
  if (!res.ok) return new Response("Not found", { status: 404, headers: { "cache-control": "public, max-age=60" } });
  const type = res.headers.get("content-type") || "application/octet-stream";
  if (!/^image\//.test(type)) return new Response("Not found", { status: 404 });
  return new Response(res.body, {
    headers: { "content-type": type, "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" },
  });
}
