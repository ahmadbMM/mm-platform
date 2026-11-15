// The online store (micromobility.sa/store, rentals migration 20261110150000): the products staff publish
// and their variants, read with the public key the way the bike catalogue is (lib/catalog.ts): row security
// shows the public only published products and their active variants, and the reads ask for exactly those
// too, so a policy change can never widen what the pages show. Both tables are read together and kept for
// a minute per Worker instance (lib/memo.ts); a failed read keeps the last good copy.
//
// Prices are VAT included. A variant's own price, when it has one, replaces the product's. The pages only
// show prices: the database prices every order itself (store_checkout), so nothing here decides money.
//
// The store build (2026-11-15, rentals migration 20261115200100) added the product's richer fields (NEW_COLS) and the
// verified buyers' reviews staff show (store_reviews, read the same way). A database without those columns yet answers
// the first read with an error, so the products are read again with the columns it has: the pages never go empty
// while the migration waits.
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

async function readRows(table: string, query: string, fetchImpl: typeof fetch): Promise<Record<string, unknown>[] | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetchImpl(`${url}/rest/v1/${table}?${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as unknown;
    return Array.isArray(rows) ? rows.filter((r): r is Record<string, unknown> => !!r && typeof r === "object") : null;
  } catch {
    return null;
  }
}

async function readStore(fetchImpl: typeof fetch): Promise<Store | null> {
  const products = (q: string) => readRows("store_products", `select=${q}&published=is.true&order=sort.asc,name_en.asc`, fetchImpl);
  const [full, variants] = await Promise.all([
    products(PRODUCT_COLS),
    readRows("store_variants", `select=${VARIANT_COLS}&active=is.true&order=sort.asc`, fetchImpl),
  ]);
  const rows = full ?? (variants ? await products(BASE_COLS) : null);
  return rows && variants ? storeOf(rows, variants) : null;
}

/** The reviews staff show (status shown; row security shows the public no other), newest first, by product. */
async function readReviews(fetchImpl: typeof fetch): Promise<{ reviews: StoreReview[] } | null> {
  const rows = await readRows("store_reviews", `select=${REVIEW_COLS}&status=eq.shown&order=created_at.desc&limit=1000`, fetchImpl);
  return rows ? { reviews: reviewsOf(rows) } : null;
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

