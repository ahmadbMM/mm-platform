import { Link } from "@/i18n/navigation";
import { MK_HOME, mkCatName, mkCityName, mkErrorKey, mkPick, shopHref, type MkBrowse, type MkCategory, type MkShop } from "@/lib/market/core";
import { W1_NONE, w1Href, w1Key, w1MapUrl, w1SportChips, type W1Filters } from "@/lib/market/w1";
import MkIcon from "../MkIcon";
import MkPhoto from "../MkPhoto";
import SellLink from "../SellLink";
import ShopContact from "../ShopContact";
import { mkErrorText, type MkWords } from "../Market.text";
import type { W1Words } from "../w1.text";
import Crumbs from "./Crumbs";
import Results from "./Results";

// An approved shop's page, as market_shop_get answered it: the shop's logo, trade name and city, the contact buttons
// (components/market/ShopContact.tsx: the phone and WhatsApp are asked for on a tap by a signed-in visitor; the map
// link, which anyone may open, is one of them), what the shop says about itself, its details as a business - the
// commercial registration number and activity, the VAT number, the address, what it sells - its return terms, and
// what it has on sale, with a chip per sport when it sells in more than one and more by the "Show more" button.
// Everything the shop wrote is shown as written, escaped, in its own direction; numbers read left to right.
//   list   the first page of its listings (market_browse with `shop`); null when it could not be read
export default function ShopView({ shop, cats, filters, list, fail, locale, t, w, signedIn }: {
  shop: MkShop; cats: MkCategory[]; filters: W1Filters; list: MkBrowse | null; fail: { error: string; detail: string } | null;
  locale: string; t: MkWords; w: W1Words; signedIn: boolean;
}) {
  const base = shopHref(shop.slug);
  const name = mkPick(locale, shop.name_en, shop.name_ar);
  const about = mkPick(locale, shop.about_en, shop.about_ar);
  const returns = mkPick(locale, shop.returns_en, shop.returns_ar);
  const sports = w1SportChips(cats, list?.sports ?? [], filters.sport);
  const items = list?.items ?? [];
  return (
    <div className="mk-w1-shop">
      <Crumbs items={[{ href: MK_HOME, label: t.name }]} current={name} label={w.crumbs} />

      <header className="mk-box mk-w1-shop-head">
        {shop.logo
          ? <MkPhoto name={shop.logo} alt="" small eager className="mk-w1-shop-logo" />
          : <span className="mk-w1-shop-logo mk-w1-nologo"><MkIcon name="shop" size={34} /></span>}
        <div className="mk-w1-shop-id">
          <h1 className="mk-user" dir="auto">{name}</h1>
          {shop.city && <p className="mk-w1-meta"><span><MkIcon name="pin" size={14} /> {mkCityName(shop.city, locale)}</span></p>}
        </div>
        <div className="mk-w1-shop-contact">
          <ShopContact slug={shop.slug} name={name} signedIn={signedIn} mapUrl={w1MapUrl(shop.map_url)} />
        </div>
      </header>

      <div className="mk-w1-shop-cols">
        {(about || returns) && (
          <div className="mk-w1-shop-text">
            {about && (
              <section className="mk-w1-sec">
                <h2>{w.aboutShop}</h2>
                <p className="mk-user mk-w1-desc" dir="auto">{about}</p>
              </section>
            )}
            {returns && (
              <section className="mk-w1-sec">
                <h2>{w.returns}</h2>
                <p className="mk-user mk-w1-desc" dir="auto">{returns}</p>
              </section>
            )}
          </div>
        )}
        <section className="mk-box mk-w1-shop-facts">
          <h2>{w.shopDetails}</h2>
          <dl className="mk-w1-facts">
            <div><dt>{w.cr}</dt><dd><bdi dir="ltr">{shop.cr_no}</bdi></dd></div>
            {shop.cr_activity && <div><dt>{w.activity}</dt><dd className="mk-user" dir="auto">{shop.cr_activity}</dd></div>}
            {shop.vat_no && <div><dt>{w.vat}</dt><dd><bdi dir="ltr">{shop.vat_no}</bdi></dd></div>}
            {shop.city && <div><dt>{w.city}</dt><dd>{mkCityName(shop.city, locale)}</dd></div>}
            {shop.address && <div><dt>{w.address}</dt><dd className="mk-user" dir="auto">{shop.address}</dd></div>}
            {shop.sells && <div><dt>{w.sells}</dt><dd className="mk-user" dir="auto">{shop.sells}</dd></div>}
          </dl>
        </section>
      </div>

      <section className="mk-w1-shop-items" aria-label={w.shopItems}>
        <div className="mk-head">
          <h2>{w.shopItems}</h2>
          <SellLink t={t} variant="link" />
        </div>
        {sports.length > 1 && (
          <nav className="mk-chips mk-w1-sports" aria-label={w.sports}>
            <Link href={base} scroll={false} className="mk-chip" aria-current={!filters.sport ? "true" : undefined}>{w.all}</Link>
            {sports.map((s) => (
              <Link key={s.slug} href={w1Href(base, { ...W1_NONE, sport: s.slug })} scroll={false} className="mk-chip" aria-current={filters.sport === s.slug ? "true" : undefined}>{mkCatName(s, locale)}</Link>
            ))}
          </nav>
        )}
        {!list ? (
          <div className="mk-empty" role="alert">
            <p>{fail && (fail.error === "absent" || fail.error === "busy") ? mkErrorText(t, mkErrorKey(fail.error, fail.detail)) : w.loadError}</p>
            <a className="mk-btn2" href={w1Href(base, filters)}>{t.retry}</a>
          </div>
        ) : items.length > 0 ? (
          <Results key={w1Key(filters)} items={items} next={list.next} filters={filters} shop={shop.slug} locale={locale} />
        ) : (
          <div className="mk-empty">
            <p>{filters.sport ? w.none : w.shopEmpty}</p>
            {filters.sport && <Link className="mk-btn2" href={base} scroll={false}>{w.allListings}</Link>}
          </div>
        )}
      </section>
    </div>
  );
}
