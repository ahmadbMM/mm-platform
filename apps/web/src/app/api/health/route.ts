// micromobility.sa/api/health, for an uptime monitor (DEPLOY.md, "Monitoring"): 200 when the site
// answers and can read the database, 503 when it cannot. One tiny read (a single row of
// site_content), never cached, so a monitor sees the truth.
export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let db = false;
  if (url && key) {
    try {
      const r = await fetch(`${url}/rest/v1/site_content?select=key&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      });
      db = r.ok;
    } catch { db = false; }
  }
  return new Response(JSON.stringify({ ok: db, site: true, database: db }), {
    status: db ? 200 : 503,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
