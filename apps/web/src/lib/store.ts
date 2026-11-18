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
import { edgeStore, memo, resetMemo } from "./memo";
import { reviewsOf, storeOf, type Store, type StoreReview } from "./store-core";

export * from "./store-core";

const TTL_MS = 60_000;
const KEY = "store";
const REVIEWS_KEY = "store-reviews";
const BASE_COLS = "id,slug,category,brand,name_en,name_ar,tagline_en,tagline_ar,description_en,description_ar,specs,images,price,compare_at,ship_ksa,sort,created_at";
const NEW_COLS = "kind,condition,warranty_months,key_specs,box,fit,faq,sizes,image_meta,goes_with,compare_with,bundle,sale_from,sale_to,catalog_model";
const PRODUCT_COLS = `${BASE_COLS},${NEW_COLS}`;
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

async function readStore(fetchImpl: typeof fetch): Promise<Store | null> {
  const products = (q: string) => readRows("store_products", `select=${q}&published=is.true&order=sort.asc,name_en.asc,id.asc`, fetchImpl);
  const [full, variants] = await Promise.all([
    products(PRODUCT_COLS),
    readRows("store_variants", `select=${VARIANT_COLS}&active=is.true&order=sort.asc,id.asc`, fetchImpl),
  ]);
  if (!("rows" in variants)) return null;
  // read again with the columns it has only when the database says one is missing: a read that timed out or failed
  // otherwise keeps the last good copy (memo), rather than a store without the conditions, warranties, sale dates
  // and bundles being kept and written to the edge's copy (bug hunt 2026-11-18)
  const rows = "rows" in full ? full : columnMissing(full) ? await products(BASE_COLS) : null;
  return rows && "rows" in rows ? storeOf(rows.rows, variants.rows) : null;
}

/** The reviews staff show (status shown; row security shows the public no other), newest first, by product: all of
 *  them, so each product's count and average are whole (up to 10,000). */
async function readReviews(fetchImpl: typeof fetch): Promise<{ reviews: StoreReview[] } | null> {
  const r = await readRows("store_reviews", `select=${REVIEW_COLS}&status=eq.shown&order=created_at.desc,id.asc`, fetchImpl, 10);
  return "rows" in r ? { reviews: reviewsOf(r.rows) } : null;
}

/** The published store, read once per Worker instance and kept for a minute; null when nothing was ever read. */
export async function loadStore(fetchImpl: typeof fetch = fetch, now: number = Date.now()): Promise<Store | null> {
  return memo<Store>(KEY, { ttl: TTL_MS, now, read: () => readStore(fetchImpl), keep: edgeStore("store") });
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
}

