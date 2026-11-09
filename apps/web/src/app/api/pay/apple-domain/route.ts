import { payEnv } from "@/lib/pay/config";

// GET /.well-known/apple-developer-merchantid-domain-association (next.config.ts rewrites it here): the file
// Moyasar's dashboard hands out for Apple Pay on the web (Settings > Apple Pay Domains > Download
// Association), kept in the Worker secret APPLE_PAY_DOMAIN_FILE. Apple wants it at that exact address, with
// no extension and no redirect. Each host is registered on its own (staging.micromobility.sa,
// micromobility.sa, www.micromobility.sa).
export const dynamic = "force-dynamic";

export function GET() {
  const f = payEnv().APPLE_PAY_DOMAIN_FILE;
  if (!f) return new Response("not found", { status: 404 });
  return new Response(f, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=300" } });
}
