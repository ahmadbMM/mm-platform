import { Link } from "@/i18n/navigation";
import { mkCityName, mkPick, shopHref, type MkShopRow } from "@/lib/market/core";
import MkIcon from "../MkIcon";
import MkPhoto from "../MkPhoto";

// The approved shops (market_shops, by name), under the grid of the plain browse page: each one's logo, trade name and
// city, a link to its page. The heading is the seller chip's own word ("Shops"); nothing else is said about a shop
// here (no counts, no dates).
export default function ShopsStrip({ shops, locale, heading }: { shops: MkShopRow[]; locale: string; heading: string }) {
  if (!shops.length) return null;
  return (
    <section className="mk-w1-shops" aria-labelledby="mk-w1-shops-h">
      <h2 id="mk-w1-shops-h">{heading}</h2>
      <ul className="mk-w1-shops-list" role="list">
        {shops.map((s) => (
          <li key={s.slug}>
            <Link href={shopHref(s.slug)} className="mk-box mk-w1-shops-a">
              {s.logo
                ? <MkPhoto name={s.logo} alt="" small className="mk-w1-logo" />
                : <span className="mk-w1-logo mk-w1-nologo"><MkIcon name="shop" size={24} /></span>}
              <span className="mk-w1-shops-id">
                <span className="mk-user mk-w1-shops-name" dir="auto">{mkPick(locale, s.name_en, s.name_ar)}</span>
                {s.city && <span className="mk-w1-shops-city">{mkCityName(s.city, locale)}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
