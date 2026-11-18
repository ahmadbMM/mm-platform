import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import RecentRow from "@/components/store/RecentRow";
import StoreGrid from "@/components/store/StoreGrid";
import { CategoryChips } from "@/components/store/StoreExtras";
import { listProps, listStart } from "@/components/store/list-data";
import { openOr404, storeState, type StoreState } from "@/components/store/store-data";
import { StoreBannerLine } from "@/components/store/spm-parts";
import { Link } from "@/i18n/navigation";
import { categoryHref } from "@/lib/store";
import { catBlurb, catChips, catName, catOf, catPath, catProducts, subsWithProducts, topOf, topsWithProducts, type StoreCat } from "@/lib/store-cats";
import { recentItems } from "@/lib/store-listing";
import { seoText } from "@/lib/store-rules";
import "@/components/experiences/experiences.css";
import "@/components/store/store.css";

// micromobility.sa/store/category/<category> (O01-E): one category's products, reached from its tile on the store page.
// The chips go to the other categories (F02, this one filled), then the order, the filters and the cards as on the
// store page, and what this browser last looked at (F08). A category with no product is not found.
//   The product-management build (2026-11-19, lib/store-cats.ts): the categories are staff's, on two levels. A category's
// page lists its sub-categories' products too, with a second row of chips for them (All of it filled); a sub-category's
// page has the trail through its category and that row with itself filled. The name and the line under it are staff's,
// so are the title and description search engines read (else as before), and the filter groups (staff's pick).
type Props = { params: Promise<{ locale: string; cat: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const categoryOf = (s: StoreState, cat: string): StoreCat | null => {
  const c = catOf(s.cats, cat);
  return c && catProducts(s.cats, s.store.products, c.slug).length ? c : null;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, cat } = await params;
  const s = await storeState(locale);
  const c = categoryOf(s, cat);
  if (!c) return { robots: { index: false, follow: false } };
  const name = catName(s.cats, c.slug, locale, s.t.cats);
  const seo = seoText(locale, c.seo, `${name} · ${s.t.store} · Micromobility`, s.t.lead);
  return pageMeta({ path: categoryHref(c.slug), locale, title: seo.title, description: seo.description, image: c.image ?? undefined, closed: s.closed || !s.open });
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { locale, cat } = await params;
  const q = await searchParams;
  const s = await storeState(locale);
  openOr404(s);
  const c = categoryOf(s, cat);
  if (!c) notFound();
  const { t, store, cats } = s;
  const name = (slug: string) => catName(cats, slug, locale, t.cats);
  const top = topOf(cats, c.slug);
  const subs = subsWithProducts(cats, store.products, top);
  const blurb = catBlurb(c, locale);
  const list = listProps(s, locale, catProducts(cats, store.products, c.slug), c);
  return (
    <PageShell locale={locale} site={s.site} preview={s.previewing} hidden={s.hidden}>
      <div className="st">
        <StoreBannerLine banner={s.banner} locale={locale} />
        <nav className="st-crumbs" aria-label={t.store}>
          <ol>
            <li><Link href="/store">{t.store}</Link></li>
            {catPath(cats, c.slug).map((x) => x.slug === c.slug
              ? <li key={x.slug} aria-current="page"><bdi>{name(x.slug)}</bdi></li>
              : <li key={x.slug}><Link href={categoryHref(x.slug)}><bdi>{name(x.slug)}</bdi></Link></li>)}
          </ol>
        </nav>
        <header className="st-head">
          <h1><bdi>{name(c.slug)}</bdi></h1>
          {blurb && <p className="st-lead" dir="auto">{blurb}</p>}
        </header>
        <CategoryChips cats={catChips(cats, topsWithProducts(cats, store.products), locale, t.cats)} at={top} t={t} />
        {subs.length > 0 && (
          <CategoryChips cats={catChips(cats, subs, locale, t.cats)} at={c.slug === top ? null : c.slug} t={t} all={categoryHref(top)} label={name(top)} sub />
        )}
        <StoreGrid locale={locale} start={listStart(q, s.rules.sort)} {...list} />
        <RecentRow items={recentItems(store.products, locale)} locale={locale} />
      </div>
    </PageShell>
  );
}
