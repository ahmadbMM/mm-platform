import { coverOf, modelPath, pick, type Catalog, type CatalogModel } from "@/lib/catalog";
import { sized, srcSet } from "@/lib/img";
import { ArrowIcon } from "@/components/site/Icons";
import { T as W1 } from "@/components/store/w1.text";
import { serverLocalize } from "@/i18n/dicts";

// One model as the lists show it: its cover, brand and name, and its tagline; `kicker` names its
// category where the list mixes categories (/bikes). A model with no photo keeps the frame, so a
// row of cards lines up whether or not staff have uploaded pictures yet.
// `shop`: the store page of the product that sells this model (the store build, 2026-11-15, F12): a second button, "See
// it in the store", under the card's own link (a link cannot hold another, so the card is then a frame around the two).
export default function ModelCard({ model, catalog, locale, kicker, shop }: { model: CatalogModel; catalog: Catalog; locale: string; kicker?: string; shop?: string }) {
  const cover = coverOf(model, catalog.photos);
  const tagline = pick(locale, model.tagline_en, model.tagline_ar);
  const body = (
    <>
      <div className="ct-card-img">
        {cover && <img src={sized(cover.url, 640)} srcSet={srcSet(cover.url)} sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 33vw" alt={pick(locale, cover.alt_en, cover.alt_ar)} loading="lazy" />}
      </div>
      {kicker && <span className="ct-card-kicker">{kicker}</span>}
      <strong>{[model.brand, model.name].map((s) => s.trim()).filter(Boolean).join(" ")}</strong>
      {tagline && <p>{tagline}</p>}
    </>
  );
  if (!shop) return <a className="ct-card" href={modelPath(model, catalog.categories)}>{body}</a>;
  return (
    <div className="ct-card ct-card-two">
      <a className="ct-card-main" href={modelPath(model, catalog.categories)}>{body}</a>
      <a className="ct-card-shop" href={shop}>{serverLocalize(W1, locale).seeInStore}<ArrowIcon size={16} /></a>
    </div>
  );
}
