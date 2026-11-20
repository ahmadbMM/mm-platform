import { Link } from "@/i18n/navigation";
import {
  MK_DECLARATIONS, MK_FOR_WHOM, MK_HOME, MK_MINE, isMkCondition, isMkSellerKind, listingHref, mkCatName, mkCategoryOf, mkCityName, mkPick,
  sellHref, shopHref, statusKey, type MkCard, type MkCategory, type MkListing,
} from "@/lib/market/core";
import { W1_NONE, w1Date, w1Facts, w1Href, w1Stage } from "@/lib/market/w1";
import ContactButton from "../ContactButton";
import MkAmt from "../MkAmt";
import MkIcon from "../MkIcon";
import MkPhoto from "../MkPhoto";
import ReportButton from "../ReportButton";
import SellerTag from "../SellerTag";
import type { MkWords } from "../Market.text";
import type { W1Words } from "../w1.text";
import Crumbs from "./Crumbs";
import Gallery from "./Gallery";
import ListingCard from "./ListingCard";
import ShareButton from "./ShareButton";

// A listing's page (micromobility.sa/marketplace/<number>), as market_listing_get answered it for this reader.
//   On a phone, top to bottom: where the page sits, the photos, the title and price ("Negotiable" when the seller said
// so), the way to reach the seller, who is selling, the item's state and details, what the seller wrote, and the way
// to reach the seller once more at the end of the page - in the page, never pinned to the screen's edge. From 900px
// the photos and the details stand on the reading side and the title, price, button and seller beside them.
//   Who is selling is said by the seller-type label and, for a private seller, the name they chose for this listing
// (first name and last initial) or no name at all; for a shop its trade name, which opens the shop's page; and
// "Checked by our team" with its date when staff marked the listing. Nothing else about a person is drawn, because
// nothing else is answered. A frame or serial number shows its last three characters only.
//   States: a reserved listing says Reserved and can still be asked about; a sold one says Sold, with no way to reach
// the seller, for the days the database still answers it; being checked, removed by staff and expired are shown to the
// seller alone (the database answers nobody else), with the state, staff's reason and the way to their own listings.
// What the seller wrote is shown as written, escaped, in its own direction; prices and sizes read left to right.
export default function ListingView({ l, cats, locale, t, w, signedIn, companyWa, similar }: {
  l: MkListing; cats: MkCategory[]; locale: string; t: MkWords; w: W1Words; signedIn: boolean; companyWa: string | null; similar: MkCard[];
}) {
  const stage = w1Stage(l.status);
  const onSale = stage === "sale" || stage === "reserved";
  const kind = isMkSellerKind(l.seller?.kind) ? l.seller.kind : "private";
  const shop = kind === "shop" ? l.seller.shop : null;
  const type = mkCategoryOf(cats, l.category), sport = mkCategoryOf(cats, l.sport);
  const condition = isMkCondition(l.condition) ? t[`cond_${l.condition}`] : "";
  const city = l.city ? mkCityName(l.city, locale) : "";
  const facts = w1Facts(l.facts);
  const declared = MK_DECLARATIONS.filter((d) => l.declarations?.[d] === true);
  const checkedOn = w1Date(l.checked_at, locale);
  const own = l.mine ? l.own : null;
  const until = own && onSale ? w1Date(own.expires_at, locale) : null;
  const canEdit = own !== null && (l.status === "live" || l.status === "reserved" || l.status === "expired");
  const contact = (cls: string) => onSale && (
    <ContactButton listingId={l.id} title={l.title} kind={kind} city={l.city} signedIn={signedIn} threadId={l.thread_id ?? null}
      canMessage={l.can_message === true} companyWa={companyWa} className={cls} />
  );
  const crumbs = [
    { href: MK_HOME, label: t.name },
    ...(sport ? [{ href: w1Href(MK_HOME, { ...W1_NONE, sport: sport.slug }), label: mkCatName(sport, locale) }] : []),
    ...(type ? [{ href: w1Href(MK_HOME, { ...W1_NONE, sport: type.parent, type: type.slug }), label: mkCatName(type, locale) }] : []),
  ];
  const factValue = (key: string, value: string) => {
    if (key === "for_whom") return (MK_FOR_WHOM as readonly string[]).includes(value) ? w.who[value] : value;
    if (key === "wheel_size" && value === "other") return w.other;
    return key === "brand" || key === "model" ? <span className="mk-user" dir="auto">{value}</span> : <bdi dir="ltr">{value}</bdi>;
  };

  return (
    <div className="mk-w1-item">
      <Crumbs items={crumbs} current={l.title} label={w.crumbs} />

      {own && (
        <div className="mk-w1-own">
          <p className="mk-w1-own-head">
            <strong>{w.yours}</strong>
            <span className={`mk-status mk-status-${l.status}`}>{t[statusKey(l.status)]}</span>
            {until && <span className="mk-w1-own-until">{w.until(until)}</span>}
          </p>
          {l.status === "hidden" && own.hidden_reason && (
            <p className="mk-w1-own-why"><strong>{w.reason}</strong> <span className="mk-user" dir="auto">{own.hidden_reason}</span></p>
          )}
          <p className="mk-w1-own-acts">
            {canEdit && <Link className="mk-link" href={sellHref(l.id)}><MkIcon name="edit" size={16} />{w.edit}</Link>}
            <Link className="mk-link" href={MK_MINE}><MkIcon name="tag" size={16} />{t.myListings}</Link>
          </p>
        </div>
      )}

      <div className="mk-w1-cols">
        <div className="mk-w1-pics"><Gallery photos={Array.isArray(l.photos) ? l.photos : []} title={l.title} /></div>

        <div className="mk-w1-aside">
          <div className="mk-w1-aside-in">
            <div className="mk-w1-sum">
              {stage !== "sale" && !own && <p className="mk-w1-state"><span className={`mk-status mk-status-${l.status}`}>{t[statusKey(l.status)]}</span></p>}
              <h1 className="mk-user" dir="auto">{l.title}</h1>
              <p className="mk-w1-price">
                <MkAmt n={l.price} word={t.sar} />
                {l.negotiable === true && <span className="mk-w1-neg">{t.negotiable}</span>}
              </p>
              {(condition || city) && (
                <p className="mk-w1-meta">
                  {condition && <span>{condition}</span>}
                  {city && <span><MkIcon name="pin" size={14} /> {city}</span>}
                </p>
              )}
              {contact("mk-btn-wide")}
              <p className="mk-w1-acts">
                <ShareButton path={listingHref(l.id)} title={l.title} />
                {!l.mine && stage !== "private" && <ReportButton target="listing" refId={l.id} signedIn={signedIn} reported={l.reported === true} />}
              </p>
            </div>

            <section className="mk-box mk-w1-seller" aria-label={w.seller}>
              <h2>{w.seller}</h2>
              {shop ? (
                <Link href={shopHref(shop.slug)} className="mk-w1-seller-shop">
                  {shop.logo ? <MkPhoto name={shop.logo} alt="" small className="mk-w1-logo" /> : <span className="mk-w1-logo mk-w1-nologo"><MkIcon name="shop" size={22} /></span>}
                  <span className="mk-user" dir="auto">{mkPick(locale, shop.name_en, shop.name_ar)}</span>
                  <MkIcon name="next" flip size={16} />
                </Link>
              ) : kind === "private" && l.seller?.name ? (
                <p className="mk-w1-seller-name mk-user" dir="auto">{l.seller.name}</p>
              ) : null}
              <SellerTag kind={kind} t={t} checked={!!l.checked_at} checkedOn={checkedOn} />
            </section>
          </div>
        </div>

        <div className="mk-w1-main">
          {l.faults && (
            <section className="mk-w1-sec mk-w1-faults">
              <h2>{w.faults}</h2>
              <p className="mk-user" dir="auto">{l.faults}</p>
            </section>
          )}

          <section className="mk-w1-sec">
            <h2>{w.details}</h2>
            <dl className="mk-w1-facts">
              {(sport || type) && (
                <div><dt>{w.facts.category}</dt><dd>{[sport, type].filter((c): c is MkCategory => c !== null).map((c) => mkCatName(c, locale)).join(" · ")}</dd></div>
              )}
              {condition && <div><dt>{w.facts.condition}</dt><dd>{condition}</dd></div>}
              {facts.map((f) => <div key={f.key}><dt>{w.facts[f.key]}</dt><dd>{factValue(f.key, f.value)}</dd></div>)}
              {city && <div><dt>{w.facts.city}</dt><dd>{city}</dd></div>}
              {l.serial_masked && <div><dt>{w.facts.serial}</dt><dd><bdi dir="ltr" className="mk-w1-serial">{l.serial_masked}</bdi></dd></div>}
            </dl>
            {declared.length > 0 && (
              <div className="mk-w1-decl">
                <h3>{w.declared}</h3>
                <ul>{declared.map((d) => <li key={d}><MkIcon name="tick" size={16} />{w.declarations[d]}</li>)}</ul>
              </div>
            )}
          </section>

          {l.description && (
            <section className="mk-w1-sec">
              <h2>{w.description}</h2>
              <p className="mk-user mk-w1-desc" dir="auto">{l.description}</p>
            </section>
          )}

          {onSale && <div className="mk-w1-again">{contact("")}</div>}
        </div>
      </div>

      {similar.length > 0 && (
        <section className="mk-w1-also">
          <h2>{w.similar}</h2>
          <ul className="mk-w1-grid" role="list">
            {similar.map((c) => <li key={c.id}><ListingCard c={c} t={t} w={w} locale={locale} /></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
