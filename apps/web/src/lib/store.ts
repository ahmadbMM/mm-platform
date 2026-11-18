// The online store (micromobility.sa/store, rentals migration 20261110150000): the products staff publish
// and their variants, read with the public key the way the bike catalogue is (lib/catalog.ts): row security
// shows the public only published products and their active variants, and the reads ask for exactly those
// too, so a policy change can never widen what the pages show. Both tables are read together and kept for
// a minute per Worker instance (lib/memo.ts); a failed read keeps the last good copy.
//
// Prices are VAT included. A variant's own price, when it has one, replaces the product's. The pages only
// show prices: the database prices every order itself (store_checkout), so nothing here decides money.
//
// The store build (2026-11-15, rentals migration 20261115235500) added the product's richer fields (NEW_COLS) and the
// verified buyers' reviews staff show (store_reviews, read the same way). A database without those columns yet answers
// the first read with an error naming the column, so the products are read again with the columns it has: the pages
// never go empty while the migration waits.
//
// The product-management build (2026-11-19, CONTRACT.md sections 2-5) added the columns SPM_COLS names (tags, a mark,
// SEO, a limit per order, pre-order, Preview and the publish window), staff's categories (store_categories, loadCats),
// collections (store_collections and their items, loadColls) and the best sellers (store_bestsellers, loadBest). Each is
// read the same way, and a database without it yet reads as the store was before: the columns fall back as above, a
// table or function that is not there reads as none (the six built-in categories, no collections). Row security decides
// what the public sees (live products, and Preview ones too); the reads here ask for published rows, and on the staging
// site for Preview ones as well, and loadStore keeps only what this site shows at this moment (lib/store-rules.ts
// visibleProducts: never a Preview product off staging) in a category it shows.
import { edgeStore, memo, resetMemo } from "./memo";
import { isStaging } from "./staging";
import { BUILTIN_TREE, catTree, inShownCat, topOf, type CatTree } from "./store-cats";
import { bestIds, collsOf, type StoreColl } from "./store-colls";
import { reviewsOf, storeOf, type Store, type StoreReview } from "./store-core";
import { visibleProducts } from "./store-rules";

export * from "./store-core";

const TTL_MS = 60_000;
/** How long "could not be read, and no copy kept" is held for staff's categories, collections and best sellers before
 *  they are asked again (a cold start during a failed read; a good copy is kept TTL_MS). */
const FAIL_TTL_MS = 5_000;
const KEY = "store";
const REVIEWS_KEY = "store-reviews";
const CATS_KEY = "store-cats";
const COLLS_KEY = "store-colls";
const BEST_KEY = "store-best";
const BASE_COLS = "id,slug,category,brand,name_en,name_ar,tagline_en,tagline_ar,description_en,description_ar,specs,images,price,compare_at,ship_ksa,sort,created_at";
const NEW_COLS = "kind,condition,warranty_months,key_specs,box,fit,faq,sizes,image_meta,goes_with,compare_with,bundle,sale_from,sale_to,catalog_model";
const PRODUCT_COLS = `${BASE_COLS},${NEW_COLS}`;
const SPM_COLS = "published,preview,publish_at,unpublish_at,tags,badge,badge_en,badge_ar,badge_until,seo_title_en,seo_title_ar,seo_desc_en,seo_desc_ar,max_per_order,preorder,ships_on";
const ALL_COLS = `${PRODUCT_COLS},${SPM_COLS}`;
const CAT_COLS = "slug,parent,name_en,name_ar,blurb_en,blurb_ar,image,sort,seo_title_en,seo_title_ar,seo_desc_en,seo_desc_ar,filters";
const COLL_COLS = "slug,name_en,name_ar,blurb_en,blurb_ar,image,sort,on_store,starts_on,ends_on,kind,days,max_items,seo_title_en,seo_title_ar,seo_desc_en,seo_desc_ar";
/** The most best sellers a collection's page lists (store_bestsellers' p_limit; a section shows its own max_items). */
const BEST_LIMIT = 48;
const VARIANT_COLS = "id,product_id,size,color_en,color_ar,color_hex,price,stock,sort";
const REVIEW_COLS = "id,product_id,rating,body,lang,bought_month";

/** The rows read, or why not: the answer's status (0 for no answer: a timeout, the network, no keys) and PostgREST's code. */
type Read = { rows: Record<string, unknown>[] } | { status: number; code: string };
/** PostgREST answers at most 1,000 rows a request: every read asks for pages of that many until one comes back short. */
const PAGE = 1000;

async function readPage(table: string, query: string, fetchImpl: typeof fetch): Promise<Read & { got?: number }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { status: 0, code: "" };
  try {
    const res = await fetchImpl(`${url}/rest/v1/${table}?${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) {
      const b = (await res.json().catch(() => null)) as { code?: unknown } | null;
      return { status: res.status, code: typeof b?.code === "string" ? b.code : "" };
    }
    const rows = (await res.json()) as unknown;
    if (!Array.isArray(rows)) return { status: res.status, code: "" };
    return { rows: rows.filter((r): r is Record<string, unknown> => !!r && typeof r === "object"), got: rows.length };
  } catch {
    return { status: 0, code: "" };
  }
}

/** Every row a query matches (its order must name a unique column last, so the pages never overlap), up to `pages`
 *  pages: one request while there are fewer than 1,000 (bug hunt 2026-11-18: past 1,000 the rest were dropped). */
async function readRows(table: string, query: string, fetchImpl: typeof fetch, pages = 20): Promise<Read> {
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < pages; i++) {
    const r = await readPage(table, `${query}&limit=${PAGE}&offset=${i * PAGE}`, fetchImpl);
    if (!("rows" in r)) return r;
    rows.push(...r.rows);
    if ((r.got ?? 0) < PAGE) break;
  }
  return { rows };
}

/** A database without the store build's columns yet: PostgREST names the column it does not have (42703, or PGRST204). */
const columnMissing = (r: Read) => !("rows" in r) && r.status === 400 && (r.code === "42703" || r.code === "PGRST204");
/** A table or function the database does not have yet (PGRST205 / PGRST202 / 42P01 / 42883), or one without a column
 *  this read asks for: the store reads as before it existed. */
const notThere = (r: Read) => !("rows" in r) && (columnMissing(r) || ((r.status === 404 || r.status === 400) && ["PGRST205", "PGRST202", "42P01", "42883"].includes(r.code)));

async function readStore(fetchImpl: typeof fetch): Promise<Store | null> {
  const products = (q: string, which: string) => readRows("store_products", `select=${q}&${which}&order=sort.asc,name_en.asc,id.asc`, fetchImpl);
  // the staging site asks for the products staff mark Preview as well (row security lets the public read them); the live
  // site never asks for them
  const [full, variants] = await Promise.all([
    products(ALL_COLS, isStaging() ? "or=(published.is.true,preview.is.true)" : "published=is.true"),
    readRows("store_variants", `select=${VARIANT_COLS}&active=is.true&order=sort.asc,id.asc`, fetchImpl),
  ]);
  if (!("rows" in variants)) return null;
  // read again with the columns it has only when the database says one is missing: a read that timed out or failed
  // otherwise keeps the last good copy (memo), rather than a store without the conditions, warranties, sale dates
  // and bundles being kept and written to the edge's copy (bug hunt 2026-11-18)
  let rows: Read | null = full;
  if (columnMissing(rows)) rows = await products(PRODUCT_COLS, "published=is.true");
  if (columnMissing(rows)) rows = await products(BASE_COLS, "published=is.true");
  return rows && "rows" in rows ? storeOf(rows.rows, variants.rows) : null;
}

/** Staff's categories (the visible ones); none when the table is not there yet. Null when they could not be read. */
async function readCats(fetchImpl: typeof fetch): Promise<{ rows: Record<string, unknown>[] } | null> {
  const r = await readRows("store_categories", `select=${CAT_COLS}&order=sort.asc,slug.asc`, fetchImpl, 2);
  return "rows" in r ? { rows: r.rows } : notThere(r) ? { rows: [] } : null;
}

/** The collections the public sees (visible, inside their dates) and their items; none when the tables are not there. */
async function readColls(fetchImpl: typeof fetch): Promise<{ colls: StoreColl[] } | null> {
  const [c, i] = await Promise.all([
    readRows("store_collections", `select=${COLL_COLS}&order=sort.asc,slug.asc`, fetchImpl, 1),
    readRows("store_collection_items", "select=collection,product_id,sort&order=collection.asc,sort.asc,product_id.asc", fetchImpl, 10),
  ]);
  if (!("rows" in c)) return notThere(c) ? { colls: [] } : null;
  if (!("rows" in i)) return notThere(i) ? { colls: collsOf(c.rows, []) } : null;
  return { colls: collsOf(c.rows, i.rows) };
}

/** The best sellers of the last `days` days (store_bestsellers), best first; none where the database has no orders. */
async function readBest(days: number, fetchImpl: typeof fetch): Promise<{ ids: string[] } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetchImpl(`${url}/rest/v1/rpc/store_bestsellers`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ p_days: days, p_limit: BEST_LIMIT }),
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) {
      const b = (await res.json().catch(() => null)) as { code?: unknown } | null;
      return notThere({ status: res.status, code: typeof b?.code === "string" ? b.code : "" }) ? { ids: [] } : null;
    }
    return { ids: bestIds(await res.json()) };
  } catch {
    return null;
  }
}

/** The reviews staff show (status shown; row security shows the public no other), newest first, by product: all of
 *  them, so each product's count and average are whole (up to 10,000). */
async function readReviews(fetchImpl: typeof fetch): Promise<{ reviews: StoreReview[] } | null> {
  const r = await readRows("store_reviews", `select=${REVIEW_COLS}&status=eq.shown&order=created_at.desc,id.asc`, fetchImpl, 10);
  return "rows" in r ? { reviews: reviewsOf(r.rows) } : null;
}

/** The store as this site shows it now, read once per Worker instance and kept for a minute; null when nothing was ever
 *  read. Only what is live at `now` (and on the staging site what staff mark Preview), in a category the store shows. */
export async function loadStore(fetchImpl: typeof fetch = fetch, now: number = Date.now()): Promise<Store | null> {
  const [raw, cats] = await Promise.all([
    // the edge's copy under a name of its own since the product-management build: a copy kept before it has no publish
    // window, Preview or limit, and must never be read as products without them
    memo<Store>(KEY, { ttl: TTL_MS, now, read: () => readStore(fetchImpl), keep: edgeStore("store-2") }),
    loadCats(fetchImpl, now),
  ]);
  return raw ? { products: inShownCat(cats, visibleProducts(raw.products, now, isStaging())).map((p) => ({ ...p, top: topOf(cats, p.category) })) } : null;
}

/** The store's categories (store_categories, kept a minute like the products); the six built-in ones while there are
 *  none (the table is missing or empty). Never read at all (a failed read with no copy kept, asked again after a few
 *  seconds): the six, marked `unread`, so no product is hidden for a category nothing is known of. */
export async function loadCats(fetchImpl: typeof fetch = fetch, now: number = Date.now()): Promise<CatTree> {
  const r = await memo<{ rows: Record<string, unknown>[] }>(CATS_KEY, { ttl: TTL_MS, failTtl: FAIL_TTL_MS, now, read: () => readCats(fetchImpl), keep: edgeStore("store-cats") });
  return r ? catTree(r.rows) : { ...BUILTIN_TREE, unread: true };
}

/** The collections the public sees, kept a minute; none while they cannot be read. */
export async function loadColls(fetchImpl: typeof fetch = fetch, now: number = Date.now()): Promise<StoreColl[]> {
  const r = await memo<{ colls: StoreColl[] }>(COLLS_KEY, { ttl: TTL_MS, failTtl: FAIL_TTL_MS, now, read: () => readColls(fetchImpl), keep: edgeStore("store-colls") });
  return r?.colls ?? [];
}

/** The best sellers' product ids for each number of days asked (store_bestsellers), kept a minute; none while they
 *  cannot be read. */
export async function loadBest(days: readonly number[], fetchImpl: typeof fetch = fetch, now: number = Date.now()): Promise<Map<number, string[]>> {
  const out = new Map<number, string[]>();
  await Promise.all([...new Set(days)].map(async (d) => {
    const r = await memo<{ ids: string[] }>(`${BEST_KEY}-${d}`, { ttl: TTL_MS, failTtl: FAIL_TTL_MS, now, read: () => readBest(d, fetchImpl) });
    out.set(d, r?.ids ?? []);
  }));
  return out;
}

/** Every review shown, by product id (lower case), kept a minute like the products; empty when none could be read. */
export async function loadReviews(fetchImpl: typeof fetch = fetch, now: number = Date.now()): Promise<Map<string, StoreReview[]>> {
  const r = await memo<{ reviews: StoreReview[] }>(REVIEWS_KEY, { ttl: TTL_MS, now, read: () => readReviews(fetchImpl), keep: edgeStore("store-reviews") });
  const by = new Map<string, StoreReview[]>();
  for (const x of r?.reviews ?? []) by.set(x.product_id.toLowerCase(), [...(by.get(x.product_id.toLowerCase()) ?? []), x]);
  return by;
}

/** For tests: forget the cached copies. */
export function resetStore(): void {
  resetMemo(KEY);
  resetMemo(REVIEWS_KEY);
  resetMemo(CATS_KEY);
  resetMemo(COLLS_KEY);
  resetMemo(BEST_KEY);
}

