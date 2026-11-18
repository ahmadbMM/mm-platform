import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import RecentRow from "@/components/store/RecentRow";
import StoreGrid from "@/components/store/StoreGrid";
import { listProps, listStart } from "@/components/store/list-data";
import { collCtx, openOr404, storeState, type StoreState } from "@/components/store/store-data";
import { StoreBannerLine } from "@/components/store/spm-parts";
import { T as SPM } from "@/components/store/spm.text";
import { serverLocalize } from "@/i18n/dicts";
import { Link } from "@/i18n/navigation";
import { collectionHref, pick } from "@/lib/store";
import { collOpen, collProducts, inCollOrder, type StoreColl } from "@/lib/store-colls";
import { recentItems } from "@/lib/store-listing";
import { seoText } from "@/lib/store-rules";
import "@/components/experiences/experiences.css";
import "@/components/store/store.css";

// micromobility.sa/store/collection/<collection> (the product-management build 2026-11-19, lib/store-colls.ts): one of
// staff's collections, as a category's page is drawn - its name and staff's line about it, then its products with the
// order and the filters, "Featured" being the collection's own order (staff's for a manual one, newest first, best
// first). Staff's title and description for search engines, else its name. Not found while it is hidden or outside its
// dates (row security shows the public no other; the dates are checked again on the Riyadh day).
type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const collOf = (s: StoreState, slug: string): StoreColl | null => s.colls.find((c) => c.slug === slug && collOpen(c, s.today)) ?? null;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const s = await storeState(locale);
  const c = collOf(s, slug);
  if (!c) return { robots: { index: false, follow: false } };
  const name = pick(locale, c.name_en, c.name_ar);
  const seo = seoText(locale, c.seo, `${name} · ${s.t.store} · Micromobility`, pick(locale, c.blurb_en, c.blurb_ar) || s.t.lead);
  return pageMeta({ path: collectionHref(c.slug), locale, title: seo.title, description: seo.description, image: c.image ?? undefined, closed: s.closed || !s.open });
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  const q = await searchParams;
  const s = await storeState(locale);
  openOr404(s);
  const c = collOf(s, slug);
  if (!c) notFound();
  const { t, store } = s;
  const x = serverLocalize(SPM, locale);
  const products = inCollOrder(collProducts(c, store.products, await collCtx(s)));
  const blurb = pick(locale, c.blurb_en, c.blurb_ar);
  const list = listProps(s, locale, products);
  return (
    <PageShell locale={locale} site={s.site} preview={s.previewing} hidden={s.hidden}>
      <div className="st">
        <StoreBannerLine banner={s.banner} locale={locale} />
        <nav className="st-crumbs" aria-label={t.store}>
          <ol>
            <li><Link href="/store">{t.store}</Link></li>
            <li aria-current="page"><bdi>{pick(locale, c.name_en, c.name_ar)}</bdi></li>
          </ol>
        </nav>
        <header className="st-head">
          <h1><bdi>{pick(locale, c.name_en, c.name_ar)}</bdi></h1>
          {blurb && <p className="st-lead" dir="auto">{blurb}</p>}
        </header>
        {products.length
          ? <StoreGrid locale={locale} start={listStart(q, "featured")} {...list} dflt="featured" />
          : <div className="st-empty"><p>{x.collEmpty}</p><Link href="/store" className="bk-btn">{t.browse}</Link></div>}
        <RecentRow items={recentItems(store.products, locale)} locale={locale} />
      </div>
    </PageShell>
  );
}
