import { T as W } from "@/components/market/w1.text";
import { serverLocalize } from "@/i18n/dicts";
import type { SiteContent } from "../site";
import type { MkSearchItem } from "./core";
import { w1Paths, w1SearchItems } from "./w1";
import { indexKept } from "./w1-server";

// Where the rest of the site asks the Marketplace what it has: the sitemap (app/sitemap.ts) and the header's search
// (app/[locale]/search-index.ts). Both ask only while the launch switch is on (lib/site.ts marketplaceOn), so nothing
// here needs to read it. Both read market_index once a minute (lib/market/w1-server.ts indexKept), which lists every
// listing on sale and every approved shop:
//   marketPaths   "/marketplace", "/marketplace/rules", "/marketplace/shop/<slug>" for each approved shop and
//                 "/marketplace/<id>" for the listings on sale, the newest 200 (the sitemap writes each address in
//                 sixteen languages: lib/market/w1.ts W1_SITEMAP_LISTINGS) - never an account's own pages (the
//                 selling form, My listings, the inbox, My shop, a shop's application);
//   marketSearch  one result per approved shop and per listing on sale (the newest 200: the list is sent whole to the
//                 browser), in the visitor's language. The Marketplace's own search looks through every listing.
// A database that does not answer leaves the two fixed pages in the sitemap and nothing in the search.

/** The Marketplace's addresses for the sitemap. `content`: the staff content the sitemap already read. */
export async function marketPaths(content: SiteContent | null): Promise<string[]> {
  void content;
  return w1Paths(await indexKept());
}

/** The Marketplace's entries in the site's search, in the visitor's language. */
export async function marketSearch(locale: string): Promise<MkSearchItem[]> {
  const w = serverLocalize(W, locale);
  return w1SearchItems(await indexKept(), locale, { listing: w.searchListing, shop: w.searchShop });
}
