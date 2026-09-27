import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import ModelCard from "@/components/bikes/ModelCard";
import { bikesState, catalogOrThrow } from "@/components/bikes/catalog-data";
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
  return pageMeta({ path: "/bikes", locale, title: `${c.hero.eyebrow} · Micromobility`, description: c.hero.text, closed });
}

export default async function BikesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const s = await bikesState(locale);
  const { tx, site, c, previewing, hidden } = s;
  const catalog = catalogOrThrow(s);
  const models = catalog.models;
  // A category with nothing in it yet is not offered; its page still answers (with the same sentence).
  const cats = topCategories(catalog).filter((x) => modelsIn(catalog, x).length > 0);
  const ctaHref = c.cta.href;
  return (
    <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>
      <div className="pg ct">
        <p className="pg-eyebrow">{c.hero.eyebrow}</p>
        <h1>{c.hero.title}</h1>
        {c.hero.text && <p className="pg-lead">{c.hero.text}</p>}
        {cats.length > 0 && (
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
        {models.length > 0 ? (
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
        {c.cta.title && (
          <div className="pg-cta ct-section">
            <div><h2>{c.cta.title}</h2>{c.cta.text && <p>{c.cta.text}</p>}</div>
            {ctaHref && c.cta.button && !hidden.includes(ctaHref.replace(/^\/(?:en\/|ar\/)?/, "").split(/[/?#]/)[0]) && <a className="pg-btn" href={localHref(ctaHref, locale)}>{c.cta.button}</a>}
          </div>
        )}
      </div>
    </PageShell>
  );
}
