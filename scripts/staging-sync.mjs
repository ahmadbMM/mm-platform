// Live → staging: copies what the live website shows (page text and settings, the bike catalogue, ride
// prices) into the staging database, and the pictures those pages use into staging's storage, so
// staging always looks like micromobility.sa. Run by .github/workflows/staging-sync.yml (every hour,
// after every production deploy, and by hand); safe to run any time.
//
// It reads the live site the way the website does - with the public key, so only what the public
// can see - and writes staging with staging's service key. Only rows that differ are written, and rows
// the live site no longer has are removed from staging. Riders, rides and bookings are never touched:
// staging keeps its made-up ones.
//
// Staging stays OPEN whatever the live site says: Coming Soon off and every page switched on
// (STAGING_OVERRIDES), so the full site can be looked at there before launch.
//
//   PROD_URL PROD_ANON_KEY STAGING_URL STAGING_SERVICE_KEY  node scripts/staging-sync.mjs [--dry-run]

const { PROD_URL, PROD_ANON_KEY, STAGING_URL, STAGING_SERVICE_KEY } = process.env;
const DRY = process.argv.includes("--dry-run");
for (const [k, v] of Object.entries({ PROD_URL, PROD_ANON_KEY, STAGING_URL, STAGING_SERVICE_KEY })) {
  if (!v) throw new Error(`${k} is not set`);
}
if (PROD_URL === STAGING_URL) throw new Error("PROD_URL and STAGING_URL are the same project");
const keyRef = (k) => { try { return JSON.parse(Buffer.from(k.split(".")[1], "base64url").toString()).ref; } catch { return null; } };
const stagingRef = new URL(STAGING_URL).hostname.split(".")[0];
if (keyRef(STAGING_SERVICE_KEY) && keyRef(STAGING_SERVICE_KEY) !== stagingRef) throw new Error("STAGING_SERVICE_KEY is not staging's key");

// Parents before children (inserts); deletes run in the reverse order.
const TABLES = [
  { name: "site_content", pk: ["key"] },
  { name: "catalog_spec_fields", pk: ["key"] },
  { name: "catalog_categories", pk: ["id"] },
  { name: "catalog_models", pk: ["id"] },
  { name: "catalog_colors", pk: ["id"] },
  { name: "catalog_photos", pk: ["id"] },
  { name: "ride_prices", pk: ["type"] },
  { name: "ride_prices_by_kind", pk: ["ride_kind", "type"] },
];
// Stamps the database sets itself on every write; comparing them would rewrite every row every run.
const IGNORE = new Set(["updated_at", "updated_by", "created_at"]);
const PAGES = ["experiences", "workshop", "business", "help", "ambassadors", "club", "about", "events", "gallery", "routes", "journal", "account", "terms", "bikes"];
const STAGING_OVERRIDES = { "site.coming_soon": false, ...Object.fromEntries(PAGES.map((p) => [`page.${p}.visible`, true])) };

const prodH = { apikey: PROD_ANON_KEY, Authorization: `Bearer ${PROD_ANON_KEY}` };
const stgH = { apikey: STAGING_SERVICE_KEY, Authorization: `Bearer ${STAGING_SERVICE_KEY}` };

async function readAll(base, headers, table) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${base}/rest/v1/${table}?select=*`, { headers: { ...headers, Range: `${from}-${from + 999}`, "Range-Unit": "items" } });
    if (!res.ok) throw new Error(`${table}: read ${base} answered ${res.status} ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}
const pkOf = (t, r) => JSON.stringify(t.pk.map((c) => r[c]));
const same = (a, b) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)].filter((k) => !IGNORE.has(k)));
  for (const k of keys) if (JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null)) return false;
  return true;
};
const pkFilter = (t, r) => t.pk.map((c) => `${c}=eq.${encodeURIComponent(r[c])}`).join("&");

async function write(method, path, body) {
  if (DRY) return;
  const res = await fetch(`${STAGING_URL}/rest/v1/${path}`, {
    method,
    headers: { ...stgH, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
}

const summary = [];
const live = {};
for (const t of TABLES) {
  let prod = await readAll(PROD_URL, prodH, t.name);
  if (t.name === "site_content") {
    prod = prod.filter((r) => !(r.key in STAGING_OVERRIDES));
    for (const [key, value] of Object.entries(STAGING_OVERRIDES)) prod.push({ key, value });
  }
  live[t.name] = prod;
  const stg = await readAll(STAGING_URL, stgH, t.name);
  const stgBy = new Map(stg.map((r) => [pkOf(t, r), r]));
  const changed = prod.filter((r) => { const s = stgBy.get(pkOf(t, r)); return !s || !same(r, s); });
  if (changed.length) {
    // Only the columns the live site gave; the stamps are left to staging's own triggers.
    const body = changed.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !IGNORE.has(k) || t.pk.includes(k))));
    await write("POST", `${t.name}?on_conflict=${t.pk.join(",")}`, body);
  }
  t.gone = stg.filter((r) => !prod.some((p) => pkOf(t, p) === pkOf(t, r)));
  summary.push(`${t.name}: ${prod.length} on live, ${changed.length} written`);
}
for (const t of [...TABLES].reverse()) {
  for (const r of t.gone) await write("DELETE", `${t.name}?${pkFilter(t, r)}`);
  if (t.gone.length) summary.push(`${t.name}: ${t.gone.length} removed`);
}

// Pictures: every /media/<path> and every site-bucket URL the copied content names.
const text = JSON.stringify(live);
const paths = new Set();
for (const m of text.matchAll(/\/media\/([a-z0-9_-]+(?:\/[A-Za-z0-9_.-]+)+)/g)) paths.add(m[1]);
for (const m of text.matchAll(/\/storage\/v1\/object\/public\/site\/([A-Za-z0-9_./-]+)/g)) paths.add(m[1]);
let copied = 0, present = 0;
for (const p of paths) {
  if (p.includes("..")) continue;
  const enc = p.split("/").map(encodeURIComponent).join("/");
  const there = await fetch(`${STAGING_URL}/storage/v1/object/public/site/${enc}`, { method: "HEAD" });
  if (there.ok) { present++; continue; }
  const src = await fetch(`${PROD_URL}/storage/v1/object/public/site/${enc}`);
  if (!src.ok) { summary.push(`picture ${p}: not on live storage (${src.status}), skipped`); continue; }
  if (!DRY) {
    const up = await fetch(`${STAGING_URL}/storage/v1/object/site/${enc}`, {
      method: "POST",
      headers: { ...stgH, "Content-Type": src.headers.get("content-type") || "application/octet-stream", "x-upsert": "true" },
      body: Buffer.from(await src.arrayBuffer()),
    });
    if (!up.ok) throw new Error(`picture ${p}: upload ${up.status} ${await up.text()}`);
  }
  copied++;
}
summary.push(`pictures: ${paths.size} named, ${present} already on staging, ${copied} copied`);
console.log((DRY ? "[dry run] " : "") + summary.join("\n"));
