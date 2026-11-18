import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import RecentRow from "@/components/store/RecentRow";
import StoreGrid from "@/components/store/StoreGrid";
import { BrandBand, CategoryTiles, Showroom } from "@/components/store/StoreExtras";
import { listProps, listStart } from "@/components/store/list-data";
import { collCtx, openOr404, storeState } from "@/components/store/store-data";
import { T as W } from "@/components/store/w2.text";
import { T as B1 } from "@/components/store/sx-B1.text";
import { T as SPM } from "@/components/store/spm.text";
import { StoreBannerLine } from "@/components/store/spm-parts";
import { CollSections } from "@/components/store/spm-sections";
import { redirect } from "@/i18n/navigation";
import { categoryHref } from "@/lib/store";
import { catsWithProducts, catTiles } from "@/lib/store-cats";
import { storeSections } from "@/lib/store-colls";
import { listQueryText, recentItems } from "@/lib/store-listing";
import { seoText, staffText, storeHeading, storeSeo } from "@/lib/store-rules";
import { serverL, serverLocalize } from "@/i18n/dicts";
import "@/components/experiences/experiences.css";
import "@/components/store/store.css";

// micromobility.sa/store - the online store, while staff have it open (store.open and pay.enabled; until
// then the address forwards to the Salla shop: proxy.ts). Products come from the staff page's Store
// section (lib/store.ts). The heading and its lead on one line (D01-A, SM02-B), the categories leading to each one's page
// (O01-E: a row of chips on a phone and a tablet, All filled; short photo panels on a computer, SM02-B), then every
// product under them (F01, no heading of its own) with the order and the filters, the certified pre-owned ones apart
// (F53); under the list the brand band (F03), the showroom (F101) and what this browser last looked at (F08).
//   The product-management build (2026-11-19): the store's banner on top (store.banner), staff's heading and intro
// (store.heading) and search-engine texts (store.seo), staff's categories as the tiles, the collections staff put on the
// store page as rows under them (lib/store-colls.ts), and the list in the store's own order (store.sort).
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const s = await storeState(locale);
  const seo = seoText(locale, storeSeo(s.content), `${serverL(locale)("Store", "المتجر")} · Micromobility`, s.t.lead);
  return pageMeta({ path: "/store", locale, title: seo.title, description: seo.description, closed: s.closed || !s.open });
}

export default async function StorePage({ params, searchParams }: Props) {
  const { locale } = await params;
  const q = await searchParams;
  const s = await storeState(locale);
  openOr404(s);
  const { t, store } = s;
  const w = serverLocalize(W, locale);
  const b1 = serverLocalize(B1, locale);
  const x = serverLocalize(SPM, locale);
  const dflt = s.rules.sort;
  // the list's old address for a category (?cat=bikes) is that category's own page now
  const cat = catsWithProducts(s.cats, store.products).find((c) => c.slug === q.cat)?.slug;
  if (cat) {
    const rest = new URLSearchParams(Object.entries(q).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : typeof v === "string" ? [[k, v]] : [])));
    const start = listStart(q, dflt);
    redirect({ href: `${categoryHref(cat)}${listQueryText(rest.toString(), start.filters, start.sort, dflt)}`, locale });
  }
  const list = listProps(s, locale);
  const sections = storeSections(s.colls, store.products, await collCtx(s));
  const heading = storeHeading(s.content);
  const contact = s.site.contact;
  const S = (v: unknown) => (typeof v === "string" ? v : "");
  const address = S(contact.address);
  return (
    <PageShell locale={locale} site={s.site} preview={s.previewing} hidden={s.hidden}>
      <div className="st">
        <StoreBannerLine banner={s.banner} locale={locale} />
        <header className="st-head">
          <h1><bdi>{staffText(locale, heading.title_en, heading.title_ar, t.store)}</bdi></h1>
          <p className="st-lead">{staffText(locale, heading.intro_en, heading.intro_ar, b1.lead)}</p>
        </header>
        <CategoryTiles tiles={catTiles(s.cats, store.products, locale, t.cats)} t={t} />
        <CollSections sections={sections} locale={locale} list={list} t={t} w={w} x={x} />
        <section className="st-all" aria-label={store.products.length ? w.allProducts : undefined}>
          {sections.length > 0 && store.products.length > 0 && <h2 className="st-h2 st-all-h">{w.allProducts}</h2>}
          <StoreGrid locale={locale} start={listStart(q, dflt)} {...list} />
        </section>
        {store.products.length > 0 && (
          <>
            <BrandBand w={w} showroom={!!address.trim()} />
            <Showroom address={address} hours={S(contact.hoursText)} href={S(contact.mapsHref)} w={w} />
          </>
        )}
        <RecentRow items={recentItems(store.products, locale)} locale={locale} />
      </div>
    </PageShell>
  );
}
