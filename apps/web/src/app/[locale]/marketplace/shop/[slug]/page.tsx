import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import MkFrame, { marketSite } from "@/components/market/MkFrame";
import { T } from "@/components/market/Market.text";
import ShopView from "@/components/market/w1/ShopView";
import { T as W } from "@/components/market/w1.text";
import "@/components/market/w1.css";
import JsonLd from "@/components/site/JsonLd";
import { serverLocalize } from "@/i18n/dicts";
import { MK_HOME, mkPhotoSrc, mkPick, shopHref } from "@/lib/market/core";
import { loadMarketCategories, mkSession, mkShopGet } from "@/lib/market/server";
import { w1Cut, w1QueryOf, w1ShopFiltersOf, type W1Search } from "@/lib/market/w1";
import { w1ShopData } from "@/lib/market/w1-seo";
import { browseKept } from "@/lib/market/w1-server";
import { pageMeta } from "@/lib/seo";
import { isComingSoon, loadSiteContent, marketplaceOn, siteCanOpen } from "@/lib/site";
import { breadcrumbData } from "@/lib/structured-data";

// micromobility.sa/marketplace/shop/<slug>: an approved shop's own page - its logo and trade name, what it says about
// itself, its city and address, its commercial registration and VAT numbers and its return terms (a business's
// identifiers, which its owner submitted to be shown), and what it has on sale, by sport. Its phone and WhatsApp are
// not in the page: the contact buttons ask for them when a signed-in visitor taps. Any other slug - a shop waiting,
// rejected or suspended, or none at all - is not found. The page is the same for everyone and is kept at the edge
// like any page; while the launch switch is off it is kept out of search engines.
type Params = Promise<{ locale: string; slug: string }>;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const read = cache(async (slug: string) => mkShopGet(slug));

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = serverLocalize(T, locale);
  const none: Metadata = { title: `${t.name} · MicroMobility`, robots: { index: false, follow: false } };
  if (slug.length > 40 || !SLUG.test(slug)) return none;
  const [r, content] = await Promise.all([read(slug), loadSiteContent()]);
  if (!r.ok || r.data === null) return none;
  const s = r.data;
  const closed = siteCanOpen() ? isComingSoon(content) : true;
  return pageMeta({
    path: shopHref(s.slug), locale, title: `${mkPick(locale, s.name_en, s.name_ar)} · ${t.name} · MicroMobility`,
    description: w1Cut(mkPick(locale, s.about_en, s.about_ar) || s.sells), closed, image: mkPhotoSrc(s.logo) ?? undefined, noindex: !marketplaceOn(content),
  });
}

export default async function ShopPage({ params, searchParams }: { params: Params; searchParams: Promise<W1Search> }) {
  const { locale, slug } = await params;
  if (slug.length > 40 || !SLUG.test(slug)) notFound();
  const [r, sp, at, cats, session] = await Promise.all([read(slug), searchParams, marketSite(locale), loadMarketCategories(), mkSession()]);
  if (!r.ok) {
    if (r.error === "absent") notFound();
    throw new Error(`market_shop_get failed (${r.error})`);
  }
  const shop = r.data;
  if (shop === null) notFound();
  const t = serverLocalize(T, locale), w = serverLocalize(W, locale);
  const filters = w1ShopFiltersOf(sp, cats);
  const list = await browseKept(w1QueryOf(filters, { shop: shop.slug }));
  const name = mkPick(locale, shop.name_en, shop.name_ar);
  return (
    <MkFrame locale={locale} at={at}>
      {at.on && <JsonLd data={[w1ShopData(shop, locale), breadcrumbData([{ name: t.name, path: MK_HOME }, { name, path: shopHref(shop.slug) }], locale)]} />}
      <ShopView shop={shop} cats={cats} filters={filters} list={list.ok ? list.data : null} fail={list.ok ? null : { error: list.error, detail: list.detail }}
        locale={locale} t={t} w={w} signedIn={session !== null} />
    </MkFrame>
  );
}
