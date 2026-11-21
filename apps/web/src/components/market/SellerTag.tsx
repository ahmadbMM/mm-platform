import { sellerLabelKey, type MkSellerKind } from "@/lib/market/core";
import MkIcon from "./MkIcon";
import type { MkWords } from "./Market.text";

// Who is selling, as every card and listing says it: "Private seller", "Sold by a shop" or "Sold by MicroMobility",
// and, when staff marked the listing, "Checked by our team" (with its date where `checkedOn` gives one). These are the
// only marks a buyer is shown about a seller: no "customer since", no membership, no counts.
//   kind        the listing's seller_kind
//   t           the shared words in the page's language (useLocalize(T) in the browser, serverLocalize(T, locale) on
//               the server; Market.text.ts)
//   checked     staff marked this listing as checked (a card's `checked`, a listing's `checked_at` not null)
//   checkedOn   the day it was checked, already written in the page's language ("20 Nov 2026"); without it the mark
//               says "Checked by our team" alone
const ICON = { private: "user", shop: "shop", company: "shield" } as const;

export default function SellerTag({ kind, t, checked = false, checkedOn, className = "" }: { kind: MkSellerKind; t: MkWords; checked?: boolean; checkedOn?: string | null; className?: string }) {
  return (
    <span className={`mk-tags${className ? ` ${className}` : ""}`}>
      <span className={`mk-tag mk-tag-${kind}`}><MkIcon name={ICON[kind]} size={14} />{t[sellerLabelKey(kind)]}</span>
      {checked && <span className="mk-tag mk-tag-checked"><MkIcon name="tick" size={14} />{checkedOn ? t.checkedOn(checkedOn) : t.checked}</span>}
    </span>
  );
}
