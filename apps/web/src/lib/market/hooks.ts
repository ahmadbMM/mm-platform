import type { SiteContent } from "../site";
import type { MkSearchItem } from "./core";

// Where the rest of the site asks the Marketplace what it has: the sitemap (app/sitemap.ts) and the header's search
// (app/[locale]/search-index.ts). Both ask only while the launch switch is on (lib/site.ts marketplaceOn), so nothing
// here needs to read it. The foundation leaves both empty; the browse builder (W1) fills them (this file is W1's from
// here on) from lib/market/server.ts mkIndex, which lists every listing on sale and every approved shop:
//   marketPaths   "/marketplace", "/marketplace/rules", "/marketplace/<id>" for each listing on sale and
//                 "/marketplace/shop/<slug>" for each approved shop - never an account's own pages (the selling form,
//                 My listings, the inbox, My shop, a shop's application);
//   marketSearch  one result per listing on sale (its title, its page) and per approved shop, in the visitor's language.

/** The Marketplace's addresses for the sitemap. `content`: the staff content the sitemap already read. */
export async function marketPaths(content: SiteContent | null): Promise<string[]> {
  void content;
  return [];
}

/** The Marketplace's entries in the site's search, in the visitor's language. */
export async function marketSearch(locale: string): Promise<MkSearchItem[]> {
  void locale;
  return [];
}
