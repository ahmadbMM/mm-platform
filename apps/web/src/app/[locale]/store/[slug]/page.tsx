import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import ProductTop from "@/components/store/ProductTop";
import RecordView from "@/components/store/RecordView";
import { topProps } from "@/components/store/pdp-top";
import { openOr404, storeState } from "@/components/store/store-data";
import { Link } from "@/i18n/navigation";
import { categoryHref, findProduct, paragraphs, pick, productHref } from "@/lib/store";
import { specTable } from "@/lib/store-sections";
import { CompareBikes, CompleteRide, FitPanel, InTheBox, ProductFaq, ProductJsonLd, ProductReviews, SpecTable, StarterBundle, TradeIn } from "@/components/store/pdp";
import "@/components/experiences/experiences.css";
import "@/components/store/store.css";

// micromobility.sa/store/<product>: its photos, the choices and Add to cart, delivery and returns before
// the cart (components/store/ProductTop.tsx: three columns on a desktop, steps on a phone), then its description and
// specifications. A gift card's page is the gift card page (/store/gift-card).
type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const s = await storeState(locale);
  const p = findProduct(s.store, slug);
  if (!p) return { robots: { index: false, follow: false } };
  return pageMeta({ path: `/store/${p.slug}`, locale, title: `${pick(locale, p.name_en, p.name_ar)} · Micromobility`,
    description: pick(locale, p.tagline_en, p.tagline_ar) || pick(locale, p.description_en, p.description_ar).slice(0, 160), image: p.images[0], closed: s.closed || !s.open });
}

export default async function ProductPage({ params }: Props) {
  const { locale, slug } = await params;
  const s = await storeState(locale);
  openOr404(s);
  const p = findProduct(s.store, slug);
  if (!p) notFound();
  // a gift card's page is the gift card page; a card whose own slug is that page's (gift-card) reaches here only while
  // that page is missing, and is not found then, never sent round to itself again
  if (p.kind === "gift_card") { if (productHref(p) === `/store/${p.slug}`) notFound(); redirect(productHref(p)); }
  const { t } = s;
  const name = pick(locale, p.name_en, p.name_ar);
  const desc = paragraphs(pick(locale, p.description_en, p.description_ar));
  const specs = specTable(p, locale);
  return (
    <PageShell locale={locale} site={s.site} preview={s.previewing} hidden={s.hidden}>
      <div className="st">
        <nav className="st-crumbs" aria-label={t.store}>
          <ol>
            <li><Link href="/store">{t.store}</Link></li>
            <li><Link href={categoryHref(p.category)}>{t.cats[p.category]}</Link></li>
            <li aria-current="page"><bdi>{name}</bdi></li>
          </ol>
        </nav>
        <ProductTop {...topProps(s, p, locale)} />
        <RecordView slug={p.slug} />
        {(desc.length > 0 || specs.length > 0) && (
          <div className="st-more">
            {desc.length > 0 && (
              <section aria-labelledby="st-desc-h">
                <h2 id="st-desc-h">{t.details}</h2>
                {desc.map((d, i) => <p key={i}>{d}</p>)}
              </section>
            )}
            {specs.length > 0 && (
              <section aria-labelledby="st-spec-h">
                <h2 id="st-spec-h">{t.specs}</h2>
                <SpecTable groups={specs} locale={locale} />
              </section>
            )}
          </div>
        )}
        {/* w3b sections */}
        <div className="st-pd-pair">
          <FitPanel p={p} locale={locale} />
          <InTheBox p={p} locale={locale} />
        </div>
        <CompleteRide store={s.store} p={p} locale={locale} />
        <StarterBundle store={s.store} p={p} locale={locale} licence={s.licence} />
        <CompareBikes store={s.store} p={p} locale={locale} />
        <TradeIn p={p} locale={locale} site={s.site} />
        <ProductReviews p={p} locale={locale} />
        <ProductFaq p={p} locale={locale} />
        <ProductJsonLd p={p} locale={locale} />
        {/* end w3b */}
      </div>
    </PageShell>
  );
}
