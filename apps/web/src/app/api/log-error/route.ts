import { sameOrigin } from "@/lib/account-core";
import { withinLimit } from "@/lib/rate-limit";

// A page that failed in a visitor's browser reports here (lib/report-error.ts). The report is
// written to the Worker's log, where Workers Logs keeps it (wrangler.jsonc: observability); it
// is never stored anywhere else. Only this site's own pages may send one, every field is cut
// short, and a connection sends 30 a minute at most (lib/rate-limit.ts), so the log cannot be
// flooded. The path is the page's address without its query: a query can carry a one-time code
// or someone's details, and never belongs in a log.
const clip = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return new Response(null, { status: 403 });
  if (!(await withinLimit(req, "log-error"))) return new Response(null, { status: 429, headers: { "cache-control": "no-store" } });
  let b: Record<string, unknown> = {};
  try { b = JSON.parse((await req.text()).slice(0, 4000)) as Record<string, unknown>; } catch { return new Response(null, { status: 400 }); }
  console.error(JSON.stringify({
    kind: "page-error",
    digest: clip(b.digest, 40),
    message: clip(b.message, 300),
    path: clip(b.path, 200).split(/[?#]/)[0],
    ua: clip(req.headers.get("user-agent"), 160),
  }));
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}
