import { edgeScope, memo } from "../memo";
import type { MkBrowse, MkBrowseQuery, MkIndex } from "./core";
import { mkBrowse, mkIndex, type MkResult } from "./server";
import { w1KeptKey, w1MayKeep } from "./w1";

// Browsing the Marketplace on the server (W1): the public reads the browse page, a shop's page, the sitemap and the
// site's search share, kept a minute in the Worker as the site's other public reads are (lib/memo.ts). market_browse
// and market_index take no account and answer everyone the same, so a kept copy can never show one person what is
// another's. What is NOT kept: a listing's own page (market_listing_get: once it is sold, removed or deleted it must
// stop being shown at once, and its seller reads their own state through it) and any search people typed.

const TTL_MS = 60_000;
type Fail = Extract<MkResult<MkBrowse>, { ok: false }>;
// why the last read under a key failed, so a kept "nothing" still says whether the database has no marketplace yet
// ("absent") or did not answer; as many keys as are kept, at most
const fails = new Map<string, Fail>();
const GENERIC: Fail = { ok: false, error: "generic", detail: "", status: 502 };
// the keys kept so far: W1_KEPT_MAX at most (lib/market/w1.ts w1MayKeep), so what is kept never grows with what
// people type into an address
const keys = new Set<string>();

/** One page of the grid. The first page of everything, of one sport, one product type, one seller kind or one shop
 *  is kept a minute (lib/market/w1.ts w1KeptKey); any other search is read as it is asked, and so is one more
 *  search than the Worker keeps.
 *  `vouched`: every sport and product type in `q` is one the database listed. False when the categories could not be
 *  read and the address was taken as written: such a sport or type is asked for, never kept. */
export async function browseKept(q: MkBrowseQuery = {}, vouched = true): Promise<MkResult<MkBrowse>> {
  const k = w1KeptKey(q);
  if (k === null || (!vouched && (q.sport || q.category))) return mkBrowse(q);
  const key = `market:browse:${edgeScope()}:${k}`;
  if (!w1MayKeep(keys, key)) return mkBrowse(q);
  const data = await memo<MkBrowse>(key, {
    ttl: TTL_MS,
    read: async () => {
      const r = await mkBrowse(q);
      if (r.ok) { fails.delete(key); return r.data; }
      fails.set(key, r);
      return null;
    },
  });
  return data ? { ok: true, data } : fails.get(key) ?? GENERIC;
}

/** Every listing on sale and every approved shop (market_index), for the sitemap and the site's search; null when the
 *  database has not answered. */
export async function indexKept(): Promise<MkIndex | null> {
  return memo<MkIndex>(`market:index:${edgeScope()}`, {
    ttl: TTL_MS,
    read: async () => {
      const r = await mkIndex();
      return r.ok ? r.data : null;
    },
  });
}
