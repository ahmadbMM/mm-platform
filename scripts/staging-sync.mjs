// Live → staging: copies what the live website shows (page text and settings, the bike catalogue, ride
// prices) into the staging database, and the pictures those pages use into staging's storage, so
// staging always looks like micromobility.sa. Run by .github/workflows/staging-sync.yml (every hour,
// after every production deploy, and by hand); safe to run any time.
//
// The store's catalogue too (2026-11-19, rentals 20261119400000/400100): staff keep the products, categories and
// collections in the live staff app, on the live database, while the store itself is open on staging only. What the
// public key can read there (live and Preview products, their active variants, visible categories, collections in
// their dates) is copied here, with the store's photos, so staging.micromobility.sa shows what staff publish. Live
// keeps no store pages: micromobility.sa/store still forwards to the old shop.
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
  // The store's catalogue (absent on a live database without it, or still empty there: skipped, said in the summary,
  // staging's rows left as they are). `id` names the column other tables point at when it is not "id". `created`: live's
  // created_at is copied too (the store's New mark, its "newest" collections and its Newest order read it).
  { name: "store_categories", pk: ["slug"], id: "slug", optional: true, created: true },
  { name: "store_collections", pk: ["slug"], id: "slug", optional: true, created: true },
  { name: "store_products", pk: ["id"], optional: true, created: true },
  { name: "store_variants", pk: ["id"], optional: true, created: true },
  { name: "store_collection_items", pk: ["collection", "product_id"], optional: true },
];
const idOf = (t, r) => r[t.id || "id"];
// Store rows the public key no longer sees (a product unpublished, a variant switched off, a category hidden) are not
// removed from staging but switched off there: staging's orders, stock requests and reviews point at them.
// A hidden category also lets go of its parent: a sub-category staging keeps under P would otherwise stop live from
// moving P under another category (two levels only: a category with sub-categories has no parent).
const SOFT_GONE = {
  store_products: { published: false, preview: false },
  store_variants: { active: false },
  store_categories: { visible: false, parent: null },
};
// Stamps the database sets itself on every write; comparing them would rewrite every row every run.
const IGNORE = new Set(["updated_at", "updated_by", "created_at"]);
const ignored = (t, k) => IGNORE.has(k) && !(t.created && k === "created_at");
const PAGES = ["experiences", "workshop", "business", "help", "ambassadors", "club", "about", "events", "gallery", "routes", "journal", "account", "terms", "bikes"];
const STAGING_OVERRIDES = { "site.coming_soon": false, ...Object.fromEntries(PAGES.map((p) => [`page.${p}.visible`, true])) };
// Staging's own settings, never copied from live nor removed (2026-11-10): online payments are tried on staging first
// (pay.*), and the store is open there (store.open) while live keeps it shut. Every other store.* setting is kept by
// staff in the live staff app since 2026-11-19 and copied here like the rest - once live has any (storeFromLive, set
// when live's settings are read): until then staging keeps all its store.* settings, as before.
let storeFromLive = false;
const STAGING_OWN = (key) => /^pay\./.test(key) || key === "store.open" || (!storeFromLive && /^store\./.test(key));

const prodH = { apikey: PROD_ANON_KEY, Authorization: `Bearer ${PROD_ANON_KEY}` };
const stgH = { apikey: STAGING_SERVICE_KEY, Authorization: `Bearer ${STAGING_SERVICE_KEY}` };

class Absent extends Error {}
async function readAll(base, headers, t) {
  const rows = [], table = t.name;
  for (let from = 0; ; from += 1000) {
    // in the primary key's order: pages of an unordered read can skip rows, which would then read as gone
    const res = await fetch(`${base}/rest/v1/${table}?select=*&order=${t.pk.join(",")}`, { headers: { ...headers, Range: `${from}-${from + 999}`, "Range-Unit": "items" } });
    if (res.status === 404) throw new Absent(`${table}: not on ${base}`); // PostgREST: no such table (PGRST205)
    if (!res.ok) throw new Error(`${table}: read ${base} answered ${res.status} ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}
const pkOf = (t, r) => JSON.stringify(t.pk.map((c) => r[c]));
const same = (t, a, b) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)].filter((k) => !ignored(t, k)));
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
  // The store: a sub-category's parent, a product's category, a variant's product, a collection's rows. A product's
  // fleet bike is live's fleet, not staging's: never copied (fleet_bike_id is cleared below).
  store_categories: [{ col: "parent", to: "store_categories" }],
  store_products: [{ col: "category", to: "store_categories" }],
  store_variants: [{ col: "product_id", to: "store_products" }],
  store_collection_items: [{ col: "collection", to: "store_collections" }, { col: "product_id", to: "store_products" }],
};
// Columns a live row carries that mean something only on live's own database.
const LOCAL_ONLY = { store_products: { fleet_bike_id: null } };
// The unique keys besides the primary key: a row live deleted and made again (a new id, the same slug), or two rows that
// swapped slugs, would meet staging's copy still holding the slug. That copy takes a placeholder slug first; the same
// upsert then rewrites it, or it is removed below (or kept unpublished).
const UNIQUE = {
  catalog_categories: [{ key: (r) => JSON.stringify([r.parent_id ?? null, r.slug]), free: (s) => ({ slug: `stale-${s.id}` }) }],
  catalog_models: [{ key: (r) => r.slug, free: (s) => ({ slug: `stale-${s.id}` }) }],
  store_products: [{ key: (r) => r.slug, free: (s) => ({ slug: `stale-${s.id}` }) }],
  // a variant's SKU and barcode are unique and may be empty: an empty one holds nothing
  store_variants: [
    { key: (r) => r.sku ?? null, free: () => ({ sku: null }) },
    { key: (r) => r.barcode ?? null, free: () => ({ barcode: null }) },
  ],
};
async function freeKeys(t, rows, stg) {
  let n = 0;
  for (const { key, free } of UNIQUE[t.name] || []) {
    const wanted = new Map(rows.filter((r) => key(r) != null).map((r) => [key(r), pkOf(t, r)]));
    for (const s of stg) {
      const k = key(s);
      if (k == null) continue;
      const by = wanted.get(k);
      if (by === undefined || by === pkOf(t, s)) continue;
      await write("PATCH", `${t.name}?${pkFilter(t, s)}`, free(s));
      n++;
    }
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
  let prod;
  try {
    prod = await readAll(PROD_URL, prodH, t);
  } catch (e) {
    // A table live does not have yet (the store's, before its migration): nothing to copy, nothing removed.
    if (!(e instanceof Absent) || !t.optional) throw e;
    prod = null;
  }
  if (prod && t.optional && !prod.length) prod = null; // still empty on live: staging's own rows are not switched off
  if (!prod) {
    t.skip = true;
    have[t.name] = new Set((await readAll(STAGING_URL, stgH, t).catch(() => [])).map((r) => idOf(t, r)));
    summary.push(`${t.name}: none on live, skipped (staging's left as they are)`);
    continue;
  }
  if (LOCAL_ONLY[t.name]) prod = prod.map((r) => ({ ...r, ...LOCAL_ONLY[t.name] }));
  if (t.name === "site_content") {
    storeFromLive = prod.some((r) => /^store\./.test(r.key) && r.key !== "store.open");
    prod = prod.filter((r) => !(r.key in STAGING_OVERRIDES) && !STAGING_OWN(r.key));
    for (const [key, value] of Object.entries(STAGING_OVERRIDES)) prod.push({ key, value });
  }
  let stg = await readAll(STAGING_URL, stgH, t);
  if (t.name === "site_content") stg = stg.filter((r) => !STAGING_OWN(r.key)); // staging's own pay./store. keys: never written over, never removed
  const refs = REFS[t.name] || [];
  const own = new Set([...stg, ...prod].map((r) => idOf(t, r))); // a parent in the same table: written in the same upsert, first
  const shown = [], left = [];
  let unlinked = 0, unbundled = 0;
  for (const p of prod) {
    let r = p, why = null;
    for (const { col, to, optional } of refs) {
      if (r[col] == null || (to === t.name ? own : have[to] || new Set()).has(r[col])) continue;
      if (optional) { r = { ...r, [col]: null }; unlinked++; } else { why = `${idOf(t, r) ?? pkOf(t, r)} (${col} ${r[col]})`; break; }
    }
    // A bundle (a set price for this product with up to three others) names products staging must hold: one live
    // does not show (a draft) is never copied, and staging's product check would refuse the bundle, so it goes.
    if (!why && t.name === "store_products" && r.bundle && Array.isArray(r.bundle.items) && !r.bundle.items.every((id) => own.has(id))) {
      r = { ...r, bundle: null };
      unbundled++;
    }
    if (why) left.push(why); else shown.push(r);
  }
  live[t.name] = shown;
  const stgBy = new Map(stg.map((r) => [pkOf(t, r), r]));
  let changed = shown.filter((r) => { const s = stgBy.get(pkOf(t, r)); return !s || !same(t, r, s); });
  // Parents first inside the upsert: a row's BEFORE trigger sees only the rows written before it in the same statement.
  const self = refs.find((x) => x.to === t.name);
  if (self) changed = [...changed.filter((r) => r[self.col] == null), ...changed.filter((r) => r[self.col] != null)];
  // the same for a bundle: the products it names first
  if (t.name === "store_products") changed = [...changed.filter((r) => !r.bundle), ...changed.filter((r) => r.bundle)];
  let written = 0, freed = 0;
  const done = [];
  if (changed.length) {
    // Only the columns the live site gave; the stamps are left to staging's own triggers.
    const bodyOf = (r) => Object.fromEntries(Object.entries(r).filter(([k]) => !ignored(t, k) || t.pk.includes(k)));
    const path = `${t.name}?on_conflict=${t.pk.join(",")}`;
    try {
      freed = await freeKeys(t, changed, stg);
      await write("POST", path, changed.map(bodyOf));
      done.push(...changed);
    } catch (e) {
      // One row staging refuses (a product check, a category's level) must not hold back the rest: one at a time.
      for (const r of changed) {
        try { await write("POST", path, [bodyOf(r)]); done.push(r); }
        catch (e1) { errors.push(`${t.name} ${pkOf(t, r)}: ${e1.message}`); }
      }
    }
    written = done.length;
  }
  const keep = new Set(shown.map((r) => pkOf(t, r)));
  t.gone = stg.filter((r) => !keep.has(pkOf(t, r)));
  // What staging holds now: its rows, those written in their new form.
  t.stay = new Map(stg.map((r) => [pkOf(t, r), r]));
  for (const r of done) t.stay.set(pkOf(t, r), r);
  // A category leaving staging may yet be kept (a row staying points at it), and the store's rows are switched off,
  // not removed (SOFT_GONE); the other tables' leaving rows go.
  const goneIds = new Set(t.name === "catalog_categories" || SOFT_GONE[t.name] ? [] : t.gone.map((r) => idOf(t, r)));
  have[t.name] = new Set([...t.stay.values()].map((r) => idOf(t, r)).filter((id) => !goneIds.has(id)));
  summary.push(`${t.name}: ${prod.length} on live, ${written} written` + (freed ? `, ${freed} unique key(s) (slug, SKU, barcode) freed for them` : "") +
    (unlinked ? `, ${unlinked} without a link live hides` : "") + (unbundled ? `, ${unbundled} without a bundle naming a product live hides` : "") +
    (left.length ? `, ${left.length} left out (live hides what they belong to): ${left.join(", ")}` : ""));
}
// Whether a row staging keeps points at this category: a model by its category or sub-type, a sub-type by its parent.
const pointedAt = (id) =>
  [...TABLES.find((x) => x.name === "catalog_models").stay.values()].some((m) => m.category_id === id || m.subtype_id === id) ||
  [...TABLES.find((x) => x.name === "catalog_categories").stay.values()].some((c) => c.id !== id && c.parent_id === id);
for (const t of [...TABLES].reverse()) {
  if (t.skip) continue;
  // Sub-types before the categories they belong to (parent_id is ON DELETE RESTRICT).
  const gone = t.name === "catalog_categories" ? [...t.gone.filter((r) => r.parent_id != null), ...t.gone.filter((r) => r.parent_id == null)] : t.gone;
  let removed = 0, kept = 0;
  for (const r of gone) {
    try {
      const off = SOFT_GONE[t.name];
      if (off) {
        // switched off on staging, once (a row already off is left as it is, and not counted again)
        if (Object.entries(off).some(([k, v]) => r[k] !== v)) { await write("PATCH", `${t.name}?${pkFilter(t, r)}`, off); kept++; }
        continue;
      }
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
  if (kept) summary.push(SOFT_GONE[t.name] ? `${t.name}: ${kept} not public on live, switched off here` : `${t.name}: ${kept} kept, unpublished (rows staging keeps belong to them)`);
}

// Pictures: every /media/<path> and every site-bucket URL the copied content names.
const text = JSON.stringify(live);
const paths = new Set();
for (const m of text.matchAll(/\/media\/([a-z0-9_-]+(?:\/[A-Za-z0-9_.-]+)+)/g)) paths.add(m[1]);
for (const m of text.matchAll(/\/storage\/v1\/object\/public\/site\/([A-Za-z0-9_./-]+)/g)) paths.add(m[1]);
// The store's photos are kept as site-bucket paths ('/site/store/<slug>/<file>', categories' and collections' tiles too).
for (const m of text.matchAll(/"\/site\/(store\/[A-Za-z0-9_./-]+)"/g)) paths.add(m[1]);
// A photo's smaller copies too (<name>.w640.webp, .w1280.webp, which the staff page saves beside it; the store's
// .w320 and .w1600 as well): the pages ask for them (lib/img.ts, ?w=), and without them staging sent every photo
// whole - a 21 MB Home.
const SIZES = new Set();
for (const p of [...paths]) {
  if (!/\.(jpe?g|png|webp)$/i.test(p) || /\.w\d+\.webp$/i.test(p)) continue;
  for (const w of p.startsWith("store/") ? [320, 640, 1280, 1600] : [640, 1280]) { const c = p.replace(/\.(jpe?g|png|webp)$/i, `.w${w}.webp`); paths.add(c); SIZES.add(c); }
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
