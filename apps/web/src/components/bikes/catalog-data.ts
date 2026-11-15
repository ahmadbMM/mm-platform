import { bikesSchema } from "@/content/pages/bikes";
import { siteSchema } from "@/content/pages/site";
import { asLocale, resolvePage } from "@/lib/content";
import { loadCatalog, type Catalog } from "@/lib/catalog";
import { loadFares } from "@/lib/biz";
import { pageState } from "@/lib/page-state";
import { loadSiteContent } from "@/lib/site";
import { loadStore, storeOpen } from "@/lib/store";
import { storeLinksByModel } from "@/lib/store-site";
import { serverL } from "@/i18n/dicts";

// What every catalogue page needs: the page state (Bikes is a switched page), the site's settings
// and the page's own words for this language (typed from the schema: c.hero.title is a string), and
// the catalogue itself - null when it could not be read and nothing was read before - and the fares
// a model's ride price is quoted at (lib/biz.ts loadFares: the booking app's Settings > Pricing). `shop`: the models a
// product of the site's own store sells, each with its store page (the store build, 2026-11-15, F12: "See it in the
// store"), only while that store is open - until then /store forwards to the Salla shop, which has no page per model.
// The store's tables are read only while it is open (the site's content, which says so, is the one pageState reads,
// kept a minute): a closed store - production has no store tables at all - costs the catalogue no database call and
// no wait.
export async function bikesState(locale: string) {
  const shopStore = loadSiteContent().then((content) => (storeOpen(content) ? loadStore() : null));
  const [state, catalog, fares, store] = await Promise.all([pageState("bikes"), loadCatalog(), loadFares(), shopStore]);
  const L = asLocale(locale);
  return {
    ...state,
    L,
    tx: serverL(locale),
    site: resolvePage(siteSchema, state.content, L),
    c: resolvePage(bikesSchema, state.content, L),
    catalog,
    fares,
    shop: store && storeOpen(state.content) ? storeLinksByModel(store) : new Map<string, string>(),
  };
}

export type BikesState = Awaited<ReturnType<typeof bikesState>>;

/** The catalogue, or the failure error.tsx shows. With nothing ever read - a Worker instance that
 *  has just started while the database is down - a page must not answer "not found" (a 404 search
 *  engines would believe, and drop the page for) or an empty catalogue (which the edge would keep for
 *  a minute); the error is seen by that visitor alone, offers a retry, and is kept nowhere. */
export function catalogOrThrow(s: BikesState): Catalog {
  if (!s.catalog) throw new Error("The bike catalogue could not be read");
  return s.catalog;
}
