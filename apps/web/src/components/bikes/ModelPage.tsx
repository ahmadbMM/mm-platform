import PageShell, { navFrom } from "@/components/site/PageShell";
import JsonLd from "@/components/site/JsonLd";
import BikeGallery from "./BikeGallery";
import Crumbs from "./Crumbs";
import ModelCard from "./ModelCard";
import type { BikesState } from "./catalog-data";
import { categoryOf, colorsOf, coverOf, modelPath, modelsIn, paragraphs, photosOf, pick, specGroups, subtypeOf, type Catalog, type CatalogModel } from "@/lib/catalog";
import { priceForType } from "@/lib/bikes";
import { fill, fmtNum } from "@/lib/fill";
import { bookingLink } from "@/lib/links";
import { breadcrumbData, productData } from "@/lib/structured-data";
import "@/components/pages/pages.css";
import "./catalog.css";

// One model of the catalogue: its photos and colours, name, tagline, year and ride price, the
// Book button, its description, its specifications by group, its spec sheet and a few of the
// other bikes in its category.
export const modelTitle = (m: CatalogModel) => [m.brand, m.name].map((s) => s.trim()).filter(Boolean).join(" ");

/** What search engines and a shared link read: the tagline, else the start of the description. */
export function modelDescription(m: CatalogModel, locale: string): string {
  const tagline = pick(locale, m.tagline_en, m.tagline_ar);
  if (tagline) return tagline;
  const text = paragraphs(pick(locale, m.description_en, m.description_ar)).join(" ");
  return text.length > 160 ? `${text.slice(0, 157).trimEnd()}…` : text;
}

export default function ModelPage({ locale, model, catalog, s }: { locale: string; model: CatalogModel; catalog: Catalog; s: BikesState }) {
  const { tx, site, c, previewing, hidden } = s;
  const cat = categoryOf(model, catalog.categories);
  const sub = subtypeOf(model, catalog.categories);
  const catName = cat ? pick(locale, cat.name_en, cat.name_ar) : "";
  const title = modelTitle(model);
  const tagline = pick(locale, model.tagline_en, model.tagline_ar);
  const price = model.ride_type ? priceForType(model.ride_type) : null;
  const photos = photosOf(model, catalog.photos).map((p) => ({ url: p.url, alt: pick(locale, p.alt_en, p.alt_ar) || title, colorId: p.color_id }));
  const colors = colorsOf(model, catalog.colors).map((x) => ({ id: x.id, name: pick(locale, x.name_en, x.name_ar), hex: x.hex }));
  const groups = specGroups(model, catalog.fields, locale);
  const desc = paragraphs(pick(locale, model.description_en, model.description_ar));
  const siblings = cat ? modelsIn(catalog, cat).filter((m) => m.id !== model.id).slice(0, 3) : [];
  const crumbs = [{ href: "/bikes", label: c.hero.eyebrow }];
  if (cat) crumbs.push({ href: `/bikes/${cat.slug}`, label: catName });
  if (cat && sub) crumbs.push({ href: `/bikes/${cat.slug}/${sub.slug}`, label: pick(locale, sub.name_en, sub.name_ar) });
  const cover = coverOf(model, catalog.photos);
  return (
    <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>
      <JsonLd data={[
        productData(model, locale, { path: modelPath(model, catalog.categories), image: cover?.url ?? "", category: catName, description: modelDescription(model, locale) }),
        breadcrumbData([...crumbs.map((x) => ({ name: x.label, path: x.href })), { name: title, path: modelPath(model, catalog.categories) }], locale),
      ]} />
      <div className="pg ct">
        <Crumbs items={crumbs} current={title} label={tx("Breadcrumb", "مسار الصفحة")} />
        <div className={photos.length ? "ct-model" : "ct-model ct-model-text"}>
          {photos.length > 0 && <BikeGallery photos={photos} colors={colors} labels={{ all: tx("All", "الكل"), colour: tx("Colour", "اللون"), photo: tx("Photo {n} of {m}", "الصورة {n} من {m}") }} />}
          <div>
            <p className="pg-eyebrow">{[catName, sub ? pick(locale, sub.name_en, sub.name_ar) : ""].filter(Boolean).join(" · ")}</p>
            <h1>{title}</h1>
            {tagline && <p className="pg-lead">{tagline}</p>}
            {(model.model_year || price !== null) && (
              <p className="ct-facts">
                {model.model_year && <span className="mm-lat">{fill(tx("{year} model", "موديل {year}"), { year: model.model_year })}</span>}
                {price !== null && <span className="ct-price">{fill(tx("{n} SAR per ride", "{n} ر.س للجولة"), { n: fmtNum(price, locale) })}</span>}
              </p>
            )}
            {price !== null && <a className="pg-btn" href={bookingLink(navFrom(site).booking, locale)}>{tx("Book a ride", "احجز جولة")}</a>}
          </div>
        </div>
        {desc.length > 0 && <div className="ct-desc">{desc.map((p, i) => <p key={i}>{p}</p>)}</div>}
        {groups.length > 0 && (
          <section className="ct-specs" aria-labelledby="ct-specs-h">
            <h2 id="ct-specs-h">{tx("Specifications", "المواصفات")}</h2>
            {groups.map((g, i) => (
              <div className="ct-spec-group" key={g.group || i}>
                {g.group && <h3>{g.group}</h3>}
                <dl>
                  {g.rows.map((r) => <div key={r.label}><dt>{r.label}</dt><dd>{r.value}</dd></div>)}
                </dl>
              </div>
            ))}
          </section>
        )}
        {model.spec_sheet && <p className="ct-sheet"><a className="pg-btn line" href={model.spec_sheet} target="_blank" rel="noopener noreferrer">{tx("Spec sheet (PDF)", "ورقة المواصفات (PDF)")}</a></p>}
        {siblings.length > 0 && (
          <section className="ct-more">
            <h2>{fill(tx("More {category} bikes", "المزيد من دراجات {category}"), { category: catName })}</h2>
            <div className="ct-grid">
              {siblings.map((m) => <ModelCard key={m.id} model={m} catalog={catalog} locale={locale} />)}
            </div>
          </section>
        )}
      </div>
    </PageShell>
  );
}
