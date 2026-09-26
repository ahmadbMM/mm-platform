import { coverOf, modelPath, pick, type Catalog, type CatalogModel } from "@/lib/catalog";
import { sized, srcSet } from "@/lib/img";

// One model as the lists show it: its cover, brand and name, and its tagline; `kicker` names its
// category where the list mixes categories (/bikes). A model with no photo keeps the frame, so a
// row of cards lines up whether or not staff have uploaded pictures yet.
export default function ModelCard({ model, catalog, locale, kicker }: { model: CatalogModel; catalog: Catalog; locale: string; kicker?: string }) {
  const cover = coverOf(model, catalog.photos);
  const tagline = pick(locale, model.tagline_en, model.tagline_ar);
  return (
    <a className="ct-card" href={modelPath(model, catalog.categories)}>
      <div className="ct-card-img">
        {cover && <img src={sized(cover.url, 640)} srcSet={srcSet(cover.url)} sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 33vw" alt={pick(locale, cover.alt_en, cover.alt_ar)} loading="lazy" />}
      </div>
      {kicker && <span className="ct-card-kicker">{kicker}</span>}
      <strong>{[model.brand, model.name].map((s) => s.trim()).filter(Boolean).join(" ")}</strong>
      {tagline && <p>{tagline}</p>}
    </a>
  );
}
