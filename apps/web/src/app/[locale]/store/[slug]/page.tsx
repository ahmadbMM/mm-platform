import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import BuyBox from "@/components/store/BuyBox";
import DeliveryInfo from "@/components/store/DeliveryInfo";
import ProductGallery from "@/components/store/ProductGallery";
import { openOr404, shownOptions, storeState } from "@/components/store/store-data";
import { Link } from "@/i18n/navigation";
import { findProduct, paragraphs, pick, priceRange, specRows } from "@/lib/store";
import "@/components/experiences/experiences.css";
import "@/components/store/store.css";

// micromobility.sa/store/<product>: its photos, the choices and Add to cart, delivery and returns before
// the cart, then its description and specifications.
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
  const { t } = s;
  const name = pick(locale, p.name_en, p.name_ar);
  const tagline = pick(locale, p.tagline_en, p.tagline_ar);
  const desc = paragraphs(pick(locale, p.description_en, p.description_ar));
  const specs = specRows(p, locale);
  const options = shownOptions(s, locale, { subtotal: priceRange(p).lo, shipKsa: p.ship_ksa });
  const helpOn = !s.hidden.includes("help");
  return (
    <PageShell locale={locale} site={s.site} preview={s.previewing} hidden={s.hidden}>
      <div className="st">
        <nav className="st-crumbs" aria-label={t.store}>
          <ol>
            <li><Link href="/store">{t.store}</Link></li>
            <li><Link href={`/store?cat=${p.category}`}>{t.cats[p.category]}</Link></li>
            <li aria-current="page">{name}</li>
          </ol>
        </nav>
        <article className="st-pdp">
          <ProductGallery images={p.images} alt={name} />
          <div className="st-pdp-info">
            {p.brand && <p className="st-brand">{p.brand}</p>}
            <h1>{name}</h1>
            {tagline && <p className="st-tagline">{tagline}</p>}
            <BuyBox p={p} locale={locale} licence={s.licence} />
            <DeliveryInfo t={t} options={options} freeOver={s.settings.delivery.freeOver} bike={!p.ship_ksa} showroom={String(s.site.contact.address ?? "")}
              returnsHref={helpOn ? "/help#returns" : null} />
          </div>
        </article>
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
                <dl className="st-specs">
                  {specs.map(([k, v], i) => <div key={i}><dt>{k}</dt><dd>{v}</dd></div>)}
                </dl>
              </section>
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}
