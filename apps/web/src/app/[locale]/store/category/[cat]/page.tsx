import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import RecentRow from "@/components/store/RecentRow";
import StoreGrid from "@/components/store/StoreGrid";
import { CategoryChips } from "@/components/store/StoreExtras";
import { listProps, listStart } from "@/components/store/list-data";
import { openOr404, storeState, type StoreState } from "@/components/store/store-data";
import { Link } from "@/i18n/navigation";
import { categoriesIn, categoryHref, isStoreCategory, type StoreCategory } from "@/lib/store";
import { recentItems } from "@/lib/store-listing";
import "@/components/experiences/experiences.css";
import "@/components/store/store.css";

// micromobility.sa/store/category/<category> (O01-E): one category's products, reached from its tile on the store page.
// The chips go to the other categories (F02, this one filled), then the order, the filters and the cards as on the
// store page, and what this browser last looked at (F08). A category with no product is not found.
type Props = { params: Promise<{ locale: string; cat: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const categoryOf = (s: StoreState, cat: string): StoreCategory | null =>
  isStoreCategory(cat) && categoriesIn(s.store).includes(cat) ? cat : null;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, cat } = await params;
  const s = await storeState(locale);
  const c = categoryOf(s, cat);
  if (!c) return { robots: { index: false, follow: false } };
  return pageMeta({ path: categoryHref(c), locale, title: `${s.t.cats[c]} · ${s.t.store} · Micromobility`, description: s.t.lead, closed: s.closed || !s.open });
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { locale, cat } = await params;
  const q = await searchParams;
  const s = await storeState(locale);
  openOr404(s);
  const c = categoryOf(s, cat);
  if (!c) notFound();
  const { t, store } = s;
  const list = listProps(s, locale, store.products.filter((p) => p.category === c));
  return (
    <PageShell locale={locale} site={s.site} preview={s.previewing} hidden={s.hidden}>
      <div className="st">
        <nav className="st-crumbs" aria-label={t.store}>
          <ol>
            <li><Link href="/store">{t.store}</Link></li>
            <li aria-current="page">{t.cats[c]}</li>
          </ol>
        </nav>
        <header className="st-head">
          <h1>{t.cats[c]}</h1>
        </header>
        <CategoryChips cats={categoriesIn(store)} at={c} t={t} />
        <StoreGrid locale={locale} start={listStart(q)} {...list} />
        <RecentRow items={recentItems(store.products, locale)} locale={locale} />
      </div>
    </PageShell>
  );
}
