"use server";

import { loadMarketCategories, mkBrowse } from "@/lib/market/server";
import { W1_NONE, w1FiltersFrom, w1QueryOf, type W1More } from "@/lib/market/w1";

// "Show more" on a grid of listings (components/market/w1/Results.tsx): the next page of the same search, asked for
// by the cursor the page before answered with (market_browse's `next`). A server action, like the site's search
// (app/[locale]/search-index.ts): the browser never calls the database. It is a public read - market_browse takes no
// account and answers everyone the same - and anyone can call it, so everything it is sent is checked exactly as the
// page checks its own address (lib/market/w1.ts w1FiltersFrom), and it answers cards and a cursor, nothing else.
//   filters   the page's filters, as the page holds them
//   shop      a shop's slug on a shop's page (only its listings, by sport), else null
//   after     the cursor
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function moreListings(input: unknown): Promise<W1More> {
  const o = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const after = typeof o.after === "string" && o.after.length > 0 && o.after.length <= 400 ? o.after : null;
  if (!after) return { ok: false, error: "invalid", detail: "" };
  const shop = typeof o.shop === "string" && o.shop.length >= 3 && o.shop.length <= 40 && SLUG.test(o.shop) ? o.shop : null;
  const f = w1FiltersFrom(o.filters, await loadMarketCategories());
  const r = await mkBrowse(w1QueryOf(shop ? { ...W1_NONE, sport: f.sport } : f, { shop: shop ?? undefined, after }));
  return r.ok ? { ok: true, items: r.data.items, next: r.data.next } : { ok: false, error: r.error, detail: r.detail };
}
