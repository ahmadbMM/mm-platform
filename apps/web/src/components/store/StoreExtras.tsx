import { Link } from "@/i18n/navigation";
import { sized, srcSet } from "@/lib/img";
import { categoryHref, type StoreCategory } from "@/lib/store-core";
import type { StoreText } from "./Store.text";
import type { W2Text } from "./w2.text";
import { NoPhoto } from "./bits";
import { StIcon } from "./icons";
import { MapThumb } from "./w2-icons";
import "./sx-B1.css";

// The store page's pieces around the list (chain w2), drawn by the server: the category tiles that lead to each
// category's page (O01-E), the category chips of a category's page (F02), the brand band under the list (F03) and the
// showroom (F101).

/** The store page's categories (O01-E, SM02-B): All (this page, filled) and each category with a product, leading to its
 *  page. On a phone and a tablet a row of chips like a category page's, so the first products show in the first screen;
 *  on a computer a row of short panels, each with its first product's photo on the soft panel and the category's name
 *  (All is the heading there). */
export function CategoryTiles({ tiles, t }: { tiles: { cat: StoreCategory; image: string | null }[]; t: StoreText }) {
  if (tiles.length < 2) return null;
  return (
    <nav className="st-tiles" aria-label={t.catsLabel}>
      <ul>
        <li className="st-tile-all"><Link href="/store" className="st-tile" aria-current="page"><span className="st-tile-name">{t.cats.all}</span></Link></li>
        {tiles.map(({ cat, image }) => (
          <li key={cat}>
            <Link href={categoryHref(cat)} className="st-tile">
              <span className="st-tile-img" aria-hidden="true">
                {image ? <img src={sized(image, 640)} srcSet={srcSet(image)} sizes="(max-width: 999px) 1px, 160px" alt="" loading="lazy" decoding="async" /> : <NoPhoto />}
              </span>
              <span className="st-tile-name">{t.cats[cat] ?? cat}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** A category page's chips (F02): All (the store page) and each category with a product, this one filled. */
export function CategoryChips({ cats, at, t }: { cats: StoreCategory[]; at: StoreCategory; t: StoreText }) {
  return (
    <nav className="st-chips st-chips-nav" aria-label={t.catsLabel}>
      <Link href="/store">{t.cats.all}</Link>
      {cats.map((c) => <Link key={c} href={categoryHref(c)} aria-current={c === at ? "page" : undefined}>{t.cats[c] ?? c}</Link>)}
    </nav>
  );
}

/** Three drawn marks with their titles alone (F03; R4: no line under them): the official distributor, every bike built
 *  in the Jeddah workshop, and the showroom, which leads to the showroom's block below when the page has one. */
export function BrandBand({ w, showroom }: { w: W2Text; showroom: boolean }) {
  const visit = <><StIcon name="mapPin" size={26} /><b>{w.visitShowroom}</b></>;
  return (
    <ul className="st-band">
      <li><span><StIcon name="award" size={26} /><b>{w.distributor}</b></span></li>
      <li><span><StIcon name="spanner" size={26} /><b>{w.builtJeddah}</b></span></li>
      <li>{showroom ? <a href="#st-showroom">{visit}</a> : <span>{visit}</span>}</li>
    </ul>
  );
}

/** The showroom (F101), from the site's contact settings: a drawn map that opens the directions, the address, the
 *  opening hours and Directions. Nothing is drawn without an address. */
export function Showroom({ address, hours, href, w }: { address: string; hours: string; href: string; w: W2Text }) {
  if (!address.trim()) return null;
  const maps = /^https:\/\//i.test(href) ? href : "";
  return (
    <section id="st-showroom" className="st-showroom" aria-labelledby="st-showroom-h">
      {maps
        ? <a href={maps} target="_blank" rel="noopener noreferrer" className="st-map" tabIndex={-1} aria-hidden="true"><MapThumb /></a>
        : <span className="st-map"><MapThumb /></span>}
      <div className="st-showroom-body">
        <h2 id="st-showroom-h" className="st-h2">{w.showroom}</h2>
        <p><StIcon name="mapPin" size={18} /><span>{address}</span></p>
        {hours.trim() && <p><StIcon name="clock" size={18} /><span>{hours}</span></p>}
        {maps && (
          <a href={maps} target="_blank" rel="noopener noreferrer" className="bk-btn2">
            <StIcon name="mapPin" size={18} />{w.directions}
          </a>
        )}
      </div>
    </section>
  );
}
