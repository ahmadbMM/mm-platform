import type { ReactNode } from "react";
import { mkCityName, mkPick, type MkShopMine } from "@/lib/market/core";
import { w4MapOk, w4PhoneShown } from "@/lib/market/w4";
import MkIcon from "../MkIcon";
import MkPhoto from "../MkPhoto";
import type { MkWords } from "../Market.text";
import type { W4Words } from "../w4.text";

// A shop's details as its owner sent them: the logo and the trade name, then one row per value that is filled in.
// What the owner typed is shown as typed, in its own direction; numbers are drawn left to right. These are the
// owner's own details on the owner's own page; the public page (the browse builder's) shows the same business
// details without the phone and WhatsApp.
export default function ShopFacts({ shop, locale, t, w }: { shop: MkShopMine; locale: string; t: MkWords; w: W4Words }) {
  const name = mkPick(locale, shop.name_en, shop.name_ar);
  const other = name === shop.name_en ? shop.name_ar : shop.name_en;
  type Row = { k: string; node: ReactNode } | null;
  const text = (k: string, v: string | null | undefined): Row => (v ? { k, node: <span className="mk-user" dir="auto">{v}</span> } : null);
  const ltr = (k: string, v: string | null | undefined): Row => (v ? { k, node: <bdi dir="ltr" className="mk-w4-num">{v}</bdi> } : null);
  const rows: Row[] = [
    text("sells", shop.sells),
    text("about_en", shop.about_en), text("about_ar", shop.about_ar),
    ltr("cr_no", shop.cr_no), text("cr_activity", shop.cr_activity), ltr("vat_no", shop.vat_no),
    text("city", mkCityName(shop.city, locale)), text("address", shop.address),
    shop.map_url && w4MapOk(shop.map_url)
      ? { k: "map_url", node: <a className="mk-link" href={shop.map_url} target="_blank" rel="noopener noreferrer"><MkIcon name="map" size={16} /><bdi dir="ltr" className="mk-w4-url">{shop.map_url.replace(/^https:\/\//, "")}</bdi></a> }
      : null,
    ltr("phone", w4PhoneShown(shop.phone)), ltr("whatsapp", w4PhoneShown(shop.whatsapp)),
    text("returns_en", shop.returns_en), text("returns_ar", shop.returns_ar),
  ];
  const shown = rows.filter((r): r is { k: string; node: ReactNode } => r !== null);
  return (
    <section className="mk-box mk-w4-facts" aria-label={w.shopDetails}>
      <div className="mk-w4-id">
        <span className="mk-w4-id-logo">{shop.logo ? <MkPhoto name={shop.logo} alt={w.logoAlt} small noPhoto={t.noPhoto} /> : <span className="mk-w4-id-mark"><MkIcon name="shop" size={26} /></span>}</span>
        <div className="mk-w4-id-names">
          <h2 className="mk-user" dir="auto">{name}</h2>
          {other && <p className="mk-user" dir="auto">{other}</p>}
        </div>
      </div>
      <dl>
        {shown.map((r) => (
          <div key={r.k}>
            <dt>{w.field[r.k]}</dt>
            <dd>{r.node}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
