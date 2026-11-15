import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import RecentRow from "@/components/store/RecentRow";
import StoreGrid from "@/components/store/StoreGrid";
import { BrandBand, CategoryTiles, Showroom } from "@/components/store/StoreExtras";
import { listProps, listStart } from "@/components/store/list-data";
import { openOr404, storeState } from "@/components/store/store-data";
import { T as W } from "@/components/store/w2.text";
import { redirect } from "@/i18n/navigation";
import { categoriesIn, categoryHref } from "@/lib/store";
import { categoryTiles, listQueryText, recentItems } from "@/lib/store-listing";
import { serverL, serverLocalize } from "@/i18n/dicts";
import "@/components/experiences/experiences.css";
import "@/components/store/store.css";

// micromobility.sa/store - the online store, while staff have it open (store.open and pay.enabled; until
// then the address forwards to the Salla shop: proxy.ts). Products come from the staff page's Store
// section (lib/store.ts). The heading and its lead (D01-A), a tile per category leading to that category's page
// (O01-E), then every product under them (F01) with the order and the filters, the certified pre-owned ones apart (F53);
// under the list the brand band (F03), the showroom (F101) and what this browser last looked at (F08).
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const s = await storeState(locale);
  return pageMeta({ path: "/store", locale, title: `${serverL(locale)("Store", "المتجر")} · Micromobility`, description: s.t.lead, closed: s.closed || !s.open });
}

export default async function StorePage({ params, searchParams }: Props) {
  const { locale } = await params;
  const q = await searchParams;
  const s = await storeState(locale);
  openOr404(s);
  const { t, store } = s;
  const w = serverLocalize(W, locale);
  // the list's old address for a category (?cat=bikes) is that category's own page now
  const cat = categoriesIn(store).find((c) => c === q.cat);
  if (cat) {
    const rest = new URLSearchParams(Object.entries(q).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : typeof v === "string" ? [[k, v]] : [])));
    const start = listStart(q);
    redirect({ href: `${categoryHref(cat)}${listQueryText(rest.toString(), start.filters, start.sort)}`, locale });
  }
  const list = listProps(s, locale);
  const contact = s.site.contact;
  const S = (v: unknown) => (typeof v === "string" ? v : "");
  const address = S(contact.address);
  return (
    <PageShell locale={locale} site={s.site} preview={s.previewing} hidden={s.hidden}>
      <div className="st">
        <header className="st-head">
          <h1>{t.store}</h1>
          <p className="st-lead">{t.lead}</p>
        </header>
        <CategoryTiles tiles={categoryTiles(store.products)} t={t} />
        <section className="st-all" aria-labelledby={store.products.length ? "st-all-h" : undefined}>
          {store.products.length > 0 && <h2 id="st-all-h" className="st-h2">{w.allProducts}</h2>}
          <StoreGrid locale={locale} start={listStart(q)} {...list} />
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
