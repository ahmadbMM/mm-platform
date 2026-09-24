import { PAGES } from "@/content";

// What staff can edit, for the staff page's Website editor (staff.micromobility.sa). Public:
// it holds labels and the design's default words, nothing more.
const ALLOWED = new Set([
  "https://staff.micromobility.sa",
  "https://micromobilityrentals.pages.dev",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
]);

function cors(req: Request): Record<string, string> {
  const o = req.headers.get("origin") || "";
  return ALLOWED.has(o) || /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(o)
    ? { "access-control-allow-origin": o, vary: "origin" }
    : {};
}

export function GET(req: Request) {
  return new Response(JSON.stringify({ version: 1, pages: PAGES }), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300", ...cors(req) },
  });
}

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: { "access-control-allow-methods": "GET", ...cors(req) } });
}
