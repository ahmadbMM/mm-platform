import { Link } from "@/i18n/navigation";
import { isMkCondition, isMkSellerKind, listingHref, mkCityName, mkPick, type MkCard } from "@/lib/market/core";
import MkAmt from "../MkAmt";
import MkPhoto from "../MkPhoto";
import SellerTag from "../SellerTag";
import type { MkWords } from "../Market.text";
import type { W1Words } from "../w1.text";

// One listing on a grid (the browse page, a shop's page, "Similar items"): its first photo, its title, its price
// (with "Negotiable" when the seller said so), its size when it has one, its condition and its city, who is selling
// (the seller-type tag, and "Checked by our team" when staff marked it) and, on a shop's listing, the shop's trade
// name. Never a private seller's name: a card is not given one (market_browse), and none is drawn. The whole card is
// one link to the listing's page; a reserved listing says so over its photo. It draws the same on the server and in
// the browser (the words are handed in), so "Show more" adds cards that look like the ones the page came with.
//   c        the card as market_browse answered it
//   t, w     the shared words and this builder's, in the page's language
//   eager    one of the first cards of a page: its photo is loaded at once
//   anchor   an id for the link, so the keyboard can be taken to the first card "Show more" added
export default function ListingCard({ c, t, w, locale, eager = false, anchor }: { c: MkCard; t: MkWords; w: W1Words; locale: string; eager?: boolean; anchor?: string }) {
  const kind = isMkSellerKind(c.seller_kind) ? c.seller_kind : "private";
  const shop = kind === "shop" && c.shop ? mkPick(locale, c.shop.name_en, c.shop.name_ar) : "";
  const size = typeof c.size === "string" ? c.size.trim() : "";
  return (
    <article className="mk-card mk-w1-card">
      <Link href={listingHref(c.id)} id={anchor} className="mk-w1-card-a">
        <span className="mk-w1-card-pic">
          <MkPhoto name={c.photo} alt="" small eager={eager} noPhoto={t.noPhoto} />
          {c.status === "reserved" && <span className="mk-status mk-status-reserved mk-w1-card-state">{t.status_reserved}</span>}
        </span>
        <span className="mk-w1-card-body">
          <span className="mk-w1-card-title mk-user" dir="auto">{c.title}</span>
          <span className="mk-w1-card-price">
            <MkAmt n={c.price} word={t.sar} />
            {c.negotiable === true && <span className="mk-w1-neg">{t.negotiable}</span>}
          </span>
          <span className="mk-w1-meta">
            {size && <span>{w.facts.size} <bdi dir="ltr">{size}</bdi></span>}
            {isMkCondition(c.condition) && <span>{t[`cond_${c.condition}`]}</span>}
            {typeof c.city === "string" && c.city && <span>{mkCityName(c.city, locale)}</span>}
          </span>
          <SellerTag kind={kind} t={t} checked={c.checked === true} />
          {shop && <span className="mk-w1-card-shop mk-user" dir="auto">{shop}</span>}
        </span>
      </Link>
    </article>
  );
}
