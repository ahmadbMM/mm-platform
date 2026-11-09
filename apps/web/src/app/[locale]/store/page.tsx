import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import StoreGrid from "@/components/store/StoreGrid";
import { openOr404, storeState } from "@/components/store/store-data";
import { categoriesIn, STORE_SORTS, type StoreSort } from "@/lib/store";
import { serverL } from "@/i18n/dicts";
import "@/components/experiences/experiences.css";
import "@/components/store/store.css";

// micromobility.sa/store - the online store, while staff have it open (store.open and pay.enabled; until
// then the address forwards to the Salla shop: proxy.ts). Products come from the staff page's Store
// section (lib/store.ts).
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
  const { t, store, licence } = s;
  const cats = categoriesIn(store);
  const one = (v: unknown) => (typeof v === "string" ? v : "");
  const cat = cats.includes(one(q.cat) as never) ? one(q.cat) : "all";
  const sort = (STORE_SORTS as readonly string[]).includes(one(q.sort)) ? (one(q.sort) as StoreSort) : "featured";
  // the list needs no descriptions or specifications: the product pages have them
  const products = store.products.map((p) => ({ ...p, description_en: null, description_ar: null, specs: [] }));
  return (
    <PageShell locale={locale} site={s.site} preview={s.previewing} hidden={s.hidden}>
      <div className="st">
        <header className="st-head">
          <h1>{t.store}</h1>
          <p className="st-lead">{t.lead}</p>
          {licence && store.products.some((p) => p.compare_at) && <p className="st-licence">{t.licence(licence)}</p>}
        </header>
        <StoreGrid locale={locale} products={products} cats={cats} start={{ cat, sort }} licence={!!licence} />
      </div>
    </PageShell>
  );
}
