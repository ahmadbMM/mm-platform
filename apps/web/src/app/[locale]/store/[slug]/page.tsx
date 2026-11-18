import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import ProductTop from "@/components/store/ProductTop";
import RecordView from "@/components/store/RecordView";
import { topProps } from "@/components/store/pdp-top";
import { openOr404, storeState } from "@/components/store/store-data";
import { StoreBannerLine } from "@/components/store/spm-parts";
import { Link } from "@/i18n/navigation";
import { categoryHref, findProduct, paragraphs, pick, priceRange, productHref } from "@/lib/store";
import { catName, catPath } from "@/lib/store-cats";
import { seoText } from "@/lib/store-rules";
import { previewText } from "@/lib/sx-B2";
import { b2Top } from "@/components/store/sx-B2-top";
import { StIcon } from "@/components/store/icons";
import { specTable } from "@/lib/store-sections";
import { CompareBikes, CompleteRide, FitPanel, InTheBox, ProductFaq, ProductJsonLd, ProductReviews, SpecTable, StarterBundle, TradeIn } from "@/components/store/pdp";
import "@/components/experiences/experiences.css";
import "@/components/store/store.css";
import "@/components/store/sx-B2.css";

// micromobility.sa/store/<product>: its photos, the choices and Add to cart, delivery and returns before
// the cart (components/store/ProductTop.tsx: three columns on a desktop, steps on a phone), then its description and
// specifications. A gift card's page is the gift card page (/store/gift-card).
//   The product-management build (2026-11-19): the store's banner on top, the trail through staff's category (and the one
// above it), and staff's own title and description for search engines when they wrote them.
type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const s = await storeState(locale);
  const p = findProduct(s.store, slug);
  if (!p) return { robots: { index: false, follow: false } };
  // a shared link's preview (N01): the product's first photo, its name, and its price with VAT before the tagline
  const { lo, hi } = priceRange(p);
  const tagline = pick(locale, p.tagline_en, p.tagline_ar) || pick(locale, p.description_en, p.description_ar).slice(0, 120);
  const seo = seoText(locale, p.seo, `${pick(locale, p.name_en, p.name_ar)} · Micromobility`, previewText(locale, lo, lo !== hi, tagline));
  // a Preview (the staging site only) is never indexed
  const meta = pageMeta({ path: `/store/${p.slug}`, locale, title: seo.title, description: seo.description, image: p.images[0], closed: s.closed || !s.open || p.preview });
  return { ...meta, other: { "product:price:amount": String(lo), "product:price:currency": "SAR" } };
}

export default async function ProductPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  const q = await searchParams;
  const s = await storeState(locale);
  openOr404(s);
  const p = findProduct(s.store, slug);
  if (!p) notFound();
  // a gift card's page is the gift card page; a card whose own slug is that page's (gift-card) reaches here only while
  // that page is missing, and is not found then, never sent round to itself again
  if (p.kind === "gift_card") { if (productHref(p) === `/store/${p.slug}`) notFound(); redirect(productHref(p)); }
  const { t } = s;
  const name = pick(locale, p.name_en, p.name_ar);
  const trail = catPath(s.cats, p.category);
  const catOfP = (slug: string) => catName(s.cats, slug, locale, t.cats);
  const desc = paragraphs(pick(locale, p.description_en, p.description_ar));
  const specs = specTable(p, locale);
  return (
    <PageShell locale={locale} site={s.site} preview={s.previewing} hidden={s.hidden}>
      <div className="st st-b2-pdp">
        {/* on a phone one line back to the category (SM05-B); the full trail from a tablet up */}
        <StoreBannerLine banner={s.banner} locale={locale} />
        <Link href={categoryHref(p.category)} className="st-b2-back"><StIcon name="prev" flip size={18} /><bdi>{catOfP(p.category)}</bdi></Link>
        <nav className="st-crumbs st-b2-crumbs" aria-label={t.store}>
          <ol>
            <li><Link href="/store">{t.store}</Link></li>
            {trail.map((c) => <li key={c.slug}><Link href={categoryHref(c.slug)}><bdi>{catOfP(c.slug)}</bdi></Link></li>)}
            <li aria-current="page"><bdi>{name}</bdi></li>
          </ol>
        </nav>
        <ProductTop {...topProps(s, p, locale)} b2={b2Top(s, p, locale, q)} />
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
