import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import ModelCard from "@/components/bikes/ModelCard";
import { S, bikesState } from "@/components/bikes/catalog-data";
import { emptyText, modelCount } from "@/components/bikes/CategoryPage";
import "@/components/pages/pages.css";
import "@/components/bikes/catalog.css";
import { bikesSchema } from "@/content/pages/bikes";
import { categoryOf, modelsIn, pick, topCategories } from "@/lib/catalog";
import { asLocale, resolvePage } from "@/lib/content";
import { bg } from "@/lib/img";
import { localHref } from "@/lib/links";
import { pageState } from "@/lib/page-state";

// micromobility.sa/bikes - the bike catalogue: the categories as tiles, then every published
// model. Staff fill the catalogue from the booking app's staff page (lib/catalog.ts); the words
// at the top and bottom are this page's own (content/pages/bikes.ts).
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const { content, closed } = await pageState("bikes");
  const c = resolvePage(bikesSchema, content, asLocale(locale));
  return pageMeta({ path: "/bikes", locale, title: `${S(c.hero.eyebrow)} · Micromobility`, description: S(c.hero.text), closed });
}

export default async function BikesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const s = await bikesState(locale);
  const { tx, site, c, catalog, previewing, hidden } = s;
  const models = catalog?.models ?? [];
  // A category with nothing in it yet is not offered; its page still answers (with the same sentence).
  const cats = catalog ? topCategories(catalog).filter((x) => modelsIn(catalog, x).length > 0) : [];
  const ctaHref = S(c.cta.href);
  return (
    <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>
      <div className="pg ct">
        <p className="pg-eyebrow">{S(c.hero.eyebrow)}</p>
        <h1>{S(c.hero.title)}</h1>
        {S(c.hero.text) && <p className="pg-lead">{S(c.hero.text)}</p>}
        {catalog && cats.length > 0 && (
          <div className="ct-tiles">
            {cats.map((x) => (
              <a key={x.id} className="ct-tile" href={`/bikes/${x.slug}`} style={x.cover ? { backgroundImage: `url('${bg(x.cover)}')` } : undefined}>
                <strong>{pick(locale, x.name_en, x.name_ar)}</strong>
                {pick(locale, x.blurb_en, x.blurb_ar) && <p>{pick(locale, x.blurb_en, x.blurb_ar)}</p>}
                <em>{modelCount(modelsIn(catalog, x).length, locale, tx)}</em>
              </a>
            ))}
          </div>
        )}
        {catalog && models.length > 0 ? (
          <section className="ct-section" aria-labelledby="ct-all-h">
            <h2 id="ct-all-h">{tx("All bikes", "كل الدراجات")}</h2>
            <div className="ct-grid">
              {models.map((m) => {
                const cat = categoryOf(m, catalog.categories);
                return <ModelCard key={m.id} model={m} catalog={catalog} locale={locale} kicker={cat ? pick(locale, cat.name_en, cat.name_ar) : undefined} />;
              })}
            </div>
          </section>
        ) : (
          <p className="pg-empty">{emptyText(tx)}</p>
        )}
        {S(c.cta.title) && (
          <div className="pg-cta ct-section">
            <div><h2>{S(c.cta.title)}</h2>{S(c.cta.text) && <p>{S(c.cta.text)}</p>}</div>
            {ctaHref && S(c.cta.button) && !hidden.includes(ctaHref.replace(/^\/(?:en\/|ar\/)?/, "").split(/[/?#]/)[0]) && <a className="pg-btn" href={localHref(ctaHref, locale)}>{S(c.cta.button)}</a>}
          </div>
        )}
      </div>
    </PageShell>
  );
}
