// The online store (micromobility.sa/store, rentals migration 20261110150000): the products staff publish
// and their variants, read with the public key the way the bike catalogue is (lib/catalog.ts): row security
// shows the public only published products and their active variants, and the reads ask for exactly those
// too, so a policy change can never widen what the pages show. Both tables are read together and kept for
// a minute per Worker instance (lib/memo.ts); a failed read keeps the last good copy.
//
// Prices are VAT included. A variant's own price, when it has one, replaces the product's. The pages only
// show prices: the database prices every order itself (store_checkout), so nothing here decides money.
import { edgeStore, memo, resetMemo } from "./memo";
import { storeOf, type Store } from "./store-core";

export * from "./store-core";

const TTL_MS = 60_000;
const KEY = "store";
const PRODUCT_COLS = "id,slug,category,brand,name_en,name_ar,tagline_en,tagline_ar,description_en,description_ar,specs,images,price,compare_at,ship_ksa,sort,created_at";
const VARIANT_COLS = "id,product_id,size,color_en,color_ar,color_hex,price,stock,sort";

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
  const [products, variants] = await Promise.all([
    readRows("store_products", `select=${PRODUCT_COLS}&published=is.true&order=sort.asc,name_en.asc`, fetchImpl),
    readRows("store_variants", `select=${VARIANT_COLS}&active=is.true&order=sort.asc`, fetchImpl),
  ]);
  return products && variants ? storeOf(products, variants) : null;
}

/** The published store, read once per Worker instance and kept for a minute; null when nothing was ever read. */
export async function loadStore(fetchImpl: typeof fetch = fetch, now: number = Date.now()): Promise<Store | null> {
  return memo<Store>(KEY, { ttl: TTL_MS, now, read: () => readStore(fetchImpl), keep: edgeStore("store") });
}

/** For tests: forget the cached copy. */
export function resetStore(): void {
  resetMemo(KEY);
}

