import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import MkFrame, { marketSite } from "@/components/market/MkFrame";
import { T } from "@/components/market/Market.text";
import ListingView from "@/components/market/w1/ListingView";
import { T as W } from "@/components/market/w1.text";
import "@/components/market/w1.css";
import JsonLd from "@/components/site/JsonLd";
import { serverLocalize } from "@/i18n/dicts";
import { MK_HOME, listingHref, listingIdOf, mkCatName, mkCategoryOf, mkPhotoSrc, mkWaDigits } from "@/lib/market/core";
import { loadMarketCategories, mkListingGet, mkSession } from "@/lib/market/server";
import { W1_NONE, w1Cut, w1Href, w1Indexable, w1Others, w1QueryOf, w1Stage } from "@/lib/market/w1";
import { w1ProductData } from "@/lib/market/w1-seo";
import { browseKept } from "@/lib/market/w1-server";
import { pageMeta } from "@/lib/seo";
import { isComingSoon, loadSiteContent, marketplaceOn, siteCanOpen } from "@/lib/site";
import { breadcrumbData } from "@/lib/structured-data";

// micromobility.sa/marketplace/<number>: one listing, as market_listing_get answers it for whoever is reading - a
// visitor, a signed-in account, or its own seller (who is also shown the states nobody else is: being checked, removed
// by staff, expired). The read carries the account's own session from its cookie and is never kept: a listing that is
// sold, removed or deleted stops being shown at once, here and at the edge (lib/page-cache.ts never keeps this page).
//   What the database does not answer is gone: the address says "not found" (404) and the page beside this one draws
// the Marketplace's own dead end. A sold listing keeps its page, marked Sold, for as long as the database answers it
// (market_listing_get: the days after the sale), and is gone after that. An address that is not a listing's number
// is not found either. A read that failed is an error (the site's "try again" page, a 5xx), never "gone": a search
// engine must not drop a listing because the database blinked.
//   For search engines: the Product and its Offer (lib/market/w1-seo.ts: the condition, the price, whether it can
// still be bought, the photos, and the seller - never the site, unless the listing is MicroMobility's own) and where
// the page sits. A listing only its seller sees, and every listing while the launch switch is off, is not indexed.
type Params = Promise<{ locale: string; id: string }>;

// one read for the page and its metadata
const read = cache(async (id: number) => mkListingGet(id, await mkSession()));

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, id } = await params;
  const w = serverLocalize(W, locale);
  const none: Metadata = { title: `${w.goneTitle} · MicroMobility`, robots: { index: false, follow: false } };
  const n = listingIdOf(id);
  if (n === null) return none;
  const [r, content] = await Promise.all([read(n), loadSiteContent()]);
  if (!r.ok || r.data === null) return none;
  const l = r.data;
  const closed = siteCanOpen() ? isComingSoon(content) : true;
  return pageMeta({
    path: listingHref(l.id), locale, title: `${l.title} · MicroMobility`, description: w1Cut(l.description), closed,
    image: mkPhotoSrc(Array.isArray(l.photos) ? l.photos[0] : null) ?? undefined, noindex: !w1Indexable(l.status, marketplaceOn(content)),
  });
}

export default async function ListingPage({ params }: { params: Params }) {
  const { locale, id } = await params;
  const n = listingIdOf(id);
  if (n === null) notFound();
  const [r, at, cats, session] = await Promise.all([read(n), marketSite(locale), loadMarketCategories(), mkSession()]);
  if (!r.ok) {
    if (r.error === "absent") notFound(); // a database without the marketplace yet has no listings
    throw new Error(`market_listing_get failed (${r.error})`);
  }
  const l = r.data;
  if (l === null) notFound();
  const t = serverLocalize(T, locale), w = serverLocalize(W, locale);
  const type = mkCategoryOf(cats, l.category), sport = mkCategoryOf(cats, l.sport);
  // the same product type's other listings, for everyone who can see this one
  const others = w1Stage(l.status) !== "private" && l.category
    ? await browseKept(w1QueryOf({ ...W1_NONE, sport: l.sport || null, type: l.category }))
    : null;
  const product = at.on ? w1ProductData(l, { locale, category: type ? mkCatName(type, locale) : "", privateLabel: t.seller_private, company: "MicroMobility" }) : null;
  const trail = [
    { name: t.name, path: MK_HOME },
    ...(sport ? [{ name: mkCatName(sport, locale), path: w1Href(MK_HOME, { ...W1_NONE, sport: sport.slug }) }] : []),
    ...(type ? [{ name: mkCatName(type, locale), path: w1Href(MK_HOME, { ...W1_NONE, type: type.slug }) }] : []),
    { name: l.title, path: listingHref(l.id) },
  ];
  return (
    <MkFrame locale={locale} at={at}>
      {product && <JsonLd data={[product, breadcrumbData(trail, locale)]} />}
      <ListingView l={l} cats={cats} locale={locale} t={t} w={w} signedIn={session !== null} companyWa={mkWaDigits(at.site.social.whatsapp)}
        similar={others?.ok ? w1Others(others.data.items, l.id, 8) : []} />
    </MkFrame>
  );
}
