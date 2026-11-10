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

// What a catalogue row points at. The public key reads each row on its own `published` (rentals
// 20260927100000_bike_catalog.sql), so live can hide a category while its sub-types and models stay public; staging's
// triggers and foreign keys refuse a row whose parent is not there. A row whose parent is neither public on live nor on
// staging is left out - live shows it nowhere either (a model whose category is unpublished is left out everywhere,
// apps/web/src/lib/catalog.ts) - and an `optional` link is dropped instead (a model under an unpublished sub-type still
// shows under its category there). A parent staging has and the public key cannot see is kept, unpublished (below).
const REFS = {
  catalog_categories: [{ col: "parent_id", to: "catalog_categories" }],
  catalog_models: [{ col: "category_id", to: "catalog_categories" }, { col: "subtype_id", to: "catalog_categories", optional: true }],
  catalog_colors: [{ col: "model_id", to: "catalog_models" }],
  catalog_photos: [{ col: "model_id", to: "catalog_models" }, { col: "color_id", to: "catalog_colors", optional: true }],
};
// The unique keys besides the primary key: a row live deleted and made again (a new id, the same slug), or two rows that
// swapped slugs, would meet staging's copy still holding the slug. That copy takes a placeholder slug first; the same
// upsert then rewrites it, or it is removed below (or kept unpublished).
const UNIQUE = {
  catalog_categories: (r) => JSON.stringify([r.parent_id ?? null, r.slug]),
  catalog_models: (r) => r.slug,
};
async function freeKeys(t, rows, stg) {
  const key = UNIQUE[t.name];
  if (!key) return 0;
  const wanted = new Map(rows.map((r) => [key(r), pkOf(t, r)]));
  let n = 0;
  for (const s of stg) {
    const by = wanted.get(key(s));
    if (by === undefined || by === pkOf(t, s)) continue;
    await write("PATCH", `${t.name}?${pkFilter(t, s)}`, { slug: `stale-${s.id}` });
    n++;
  }
  return n;
}

const summary = [];
// A write that fails is said at the end and fails the run, but never stops the rest: the tables after it, the removals
// and the pictures still go (one refused row used to stop every hourly run in the same place).
const errors = [];
const live = {};
const have = {}; // table -> the ids on staging once its rows are written: what the next tables' rows may point at
for (const t of TABLES) {
  let prod = await readAll(PROD_URL, prodH, t.name);
  if (t.name === "site_content") {
    prod = prod.filter((r) => !(r.key in STAGING_OVERRIDES));
    for (const [key, value] of Object.entries(STAGING_OVERRIDES)) prod.push({ key, value });
  }
  const stg = await readAll(STAGING_URL, stgH, t.name);
  const refs = REFS[t.name] || [];
  const own = new Set([...stg, ...prod].map((r) => r.id)); // a parent in the same table: written in the same upsert, first
  const shown = [], left = [];
  let unlinked = 0;
  for (const p of prod) {
    let r = p, why = null;
    for (const { col, to, optional } of refs) {
      if (r[col] == null || (to === t.name ? own : have[to]).has(r[col])) continue;
      if (optional) { r = { ...r, [col]: null }; unlinked++; } else { why = `${r.id} (${col} ${r[col]})`; break; }
    }
    if (why) left.push(why); else shown.push(r);
  }
  live[t.name] = shown;
  const stgBy = new Map(stg.map((r) => [pkOf(t, r), r]));
  let changed = shown.filter((r) => { const s = stgBy.get(pkOf(t, r)); return !s || !same(r, s); });
  // Parents first inside the upsert: a row's BEFORE trigger sees only the rows written before it in the same statement.
  const self = refs.find((x) => x.to === t.name);
  if (self) changed = [...changed.filter((r) => r[self.col] == null), ...changed.filter((r) => r[self.col] != null)];
  let written = 0, freed = 0;
  if (changed.length) {
    try {
      freed = await freeKeys(t, changed, stg);
      // Only the columns the live site gave; the stamps are left to staging's own triggers.
      const body = changed.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !IGNORE.has(k) || t.pk.includes(k))));
      await write("POST", `${t.name}?on_conflict=${t.pk.join(",")}`, body);
      written = changed.length;
    } catch (e) {
      errors.push(`${t.name}: ${e.message}`);
    }
  }
  const keep = new Set(shown.map((r) => pkOf(t, r)));
  t.gone = stg.filter((r) => !keep.has(pkOf(t, r)));
  // What staging holds now: its rows, those written in their new form.
  t.stay = new Map(stg.map((r) => [pkOf(t, r), r]));
  if (written) for (const r of changed) t.stay.set(pkOf(t, r), r);
  // A category leaving staging may yet be kept (a row staying points at it); the other tables' leaving rows go.
  const goneIds = new Set(t.name === "catalog_categories" ? [] : t.gone.map((r) => r.id));
  have[t.name] = new Set([...t.stay.values()].map((r) => r.id).filter((id) => !goneIds.has(id)));
  summary.push(`${t.name}: ${prod.length} on live, ${written} written` + (freed ? `, ${freed} slug(s) freed for them` : "") +
    (unlinked ? `, ${unlinked} without a link live hides` : "") + (left.length ? `, ${left.length} left out (live hides what they belong to): ${left.join(", ")}` : ""));
}
// Whether a row staging keeps points at this category: a model by its category or sub-type, a sub-type by its parent.
const pointedAt = (id) =>
  [...TABLES.find((x) => x.name === "catalog_models").stay.values()].some((m) => m.category_id === id || m.subtype_id === id) ||
  [...TABLES.find((x) => x.name === "catalog_categories").stay.values()].some((c) => c.id !== id && c.parent_id === id);
for (const t of [...TABLES].reverse()) {
  // Sub-types before the categories they belong to (parent_id is ON DELETE RESTRICT).
  const gone = t.name === "catalog_categories" ? [...t.gone.filter((r) => r.parent_id != null), ...t.gone.filter((r) => r.parent_id == null)] : t.gone;
  let removed = 0, kept = 0;
  for (const r of gone) {
    try {
      if (t.name === "catalog_categories" && pointedAt(r.id)) {
        // Live has it too (rows it shows point at it), unpublished, so the public key cannot see it: so on staging.
        if (r.published !== false) await write("PATCH", `${t.name}?${pkFilter(t, r)}`, { published: false });
        kept++;
        continue;
      }
      await write("DELETE", `${t.name}?${pkFilter(t, r)}`);
      t.stay.delete(pkOf(t, r));
      removed++;
    } catch (e) {
      errors.push(`${t.name} ${pkOf(t, r)}: ${e.message}`);
    }
  }
  if (removed) summary.push(`${t.name}: ${removed} removed`);
  if (kept) summary.push(`${t.name}: ${kept} kept, unpublished (rows staging keeps belong to them)`);
}

// Pictures: every /media/<path> and every site-bucket URL the copied content names.
const text = JSON.stringify(live);
const paths = new Set();
for (const m of text.matchAll(/\/media\/([a-z0-9_-]+(?:\/[A-Za-z0-9_.-]+)+)/g)) paths.add(m[1]);
for (const m of text.matchAll(/\/storage\/v1\/object\/public\/site\/([A-Za-z0-9_./-]+)/g)) paths.add(m[1]);
// A photo's smaller copies too (<name>.w640.webp, .w1280.webp, which the staff page saves beside it): the
// pages ask for them (lib/img.ts, ?w=), and without them staging sent every photo whole - a 21 MB Home.
const SIZES = new Set();
for (const p of [...paths]) {
  if (!/\.(jpe?g|png|webp)$/i.test(p) || /\.w\d+\.webp$/i.test(p)) continue;
  for (const w of [640, 1280]) { const c = p.replace(/\.(jpe?g|png|webp)$/i, `.w${w}.webp`); paths.add(c); SIZES.add(c); }
}
let copied = 0, present = 0;
for (const p of paths) {
  if (p.includes("..")) continue;
  const enc = p.split("/").map(encodeURIComponent).join("/");
  const there = await fetch(`${STAGING_URL}/storage/v1/object/public/site/${enc}`, { method: "HEAD" });
  if (there.ok) { present++; continue; }
  const src = await fetch(`${PROD_URL}/storage/v1/object/public/site/${enc}`);
  if (!src.ok) {
    // a photo smaller than a copy's width has no copy of that width: nothing to say
    if (!SIZES.has(p)) summary.push(`picture ${p}: not on live storage (${src.status}), skipped`);
    continue;
  }
  if (!DRY) {
    const up = await fetch(`${STAGING_URL}/storage/v1/object/site/${enc}`, {
      method: "POST",
      headers: { ...stgH, "Content-Type": src.headers.get("content-type") || "application/octet-stream", "x-upsert": "true" },
      body: Buffer.from(await src.arrayBuffer()),
    });
    if (!up.ok) { errors.push(`picture ${p}: upload ${up.status} ${await up.text()}`); continue; }
  }
  copied++;
}
summary.push(`pictures: ${paths.size} named, ${present} already on staging, ${copied} copied`);
console.log((DRY ? "[dry run] " : "") + summary.join("\n"));
if (errors.length) {
  console.error(`${errors.length} write(s) refused:\n${errors.join("\n")}`);
  process.exitCode = 1;
}
