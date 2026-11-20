import type { Metadata } from "next";
import MkFrame, { marketSite } from "@/components/market/MkFrame";
import { T } from "@/components/market/Market.text";
import SellLink from "@/components/market/SellLink";
import Browse from "@/components/market/w1/Browse";
import { T as W } from "@/components/market/w1.text";
import "@/components/market/w1.css";
import { serverLocalize } from "@/i18n/dicts";
import { MK_HOME, mkCatName } from "@/lib/market/core";
import { loadMarketCategories } from "@/lib/market/server";
import { w1FiltersOf, w1Narrowed, w1Nearby, w1QueryOf, w1SportChips, w1TypeOptions, type W1Search } from "@/lib/market/w1";
import { browseKept } from "@/lib/market/w1-server";
import { pageMeta } from "@/lib/seo";
import { isComingSoon, loadSiteContent, marketplaceOn, siteCanOpen } from "@/lib/site";

// micromobility.sa/marketplace: what people, shops and MicroMobility have on sale, newest first, 24 to a page and more
// by the "Show more" button. Everything a visitor picks is in the address (lib/market/w1.ts: q, sport, type, seller,
// city, condition, min, max, sort), each value checked here before it is asked for, so the page is drawn whole on the
// server for any search and a search can be shared. The page reads the visible categories and one page of
// market_browse; the answer also says which sports and product types have something to show, which is what the chips
// and the type picker offer - an empty sport is never a chip. A search that finds nothing is answered with where to
// look next and the newest listings. The first page of the common searches is kept a minute (lib/market/w1-server.ts);
// the plain address is kept at the edge like any page (lib/page-cache.ts).
//   The page opens by its address whatever the launch switch says (site_content 'marketplace.on'); while it is off it
// is kept out of search engines, as every Marketplace page is.
type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const t = serverLocalize(T, locale), w = serverLocalize(W, locale);
  const content = await loadSiteContent();
  const closed = siteCanOpen() ? isComingSoon(content) : true;
  return pageMeta({ path: MK_HOME, locale, title: `${t.name} · MicroMobility`, description: w.metaDesc, closed, noindex: !marketplaceOn(content) });
}

export default async function MarketplacePage({ params, searchParams }: { params: Params; searchParams: Promise<W1Search> }) {
  const { locale } = await params;
  const [sp, at, cats] = await Promise.all([searchParams, marketSite(locale), loadMarketCategories()]);
  const t = serverLocalize(T, locale);
  const filters = w1FiltersOf(sp, cats);
  // with no categories to check the address against, its sport and type are as written: asked for, never kept
  const r = await browseKept(w1QueryOf(filters), cats.length > 0);
  const data = r.ok ? r.data : null;
  // a search that found nothing: where to look next, and the newest listings to go on from
  const nothing = data !== null && data.items.length === 0 && w1Narrowed(filters);
  const newest = nothing ? await browseKept({}) : null;
  const named = (c: { slug: string; name_en: string; name_ar: string }) => ({ slug: c.slug, name: mkCatName(c, locale) });
  return (
    <MkFrame locale={locale} at={at}>
      <Browse
        locale={locale}
        base={MK_HOME}
        filters={filters}
        sports={w1SportChips(cats, data?.sports ?? [], filters.sport).map(named)}
        types={w1TypeOptions(cats, filters, data?.categories ?? []).map(named)}
        result={data ? { items: data.items, next: data.next } : null}
        fail={r.ok ? null : { error: r.error, detail: r.detail }}
        near={nothing ? w1Nearby(cats, filters, data.sports).map((n) => ({ key: n.key, name: n.sport ? mkCatName(n.sport, locale) : null, filters: n.filters })) : []}
        newest={newest?.ok ? newest.data.items.slice(0, 8) : []}
        sell={<SellLink t={t} />}
      />
    </MkFrame>
  );
}
