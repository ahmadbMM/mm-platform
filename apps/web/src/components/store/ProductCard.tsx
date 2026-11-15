import { Link } from "@/i18n/navigation";
import { photoAlt, pick, productHref, productStock, sar, wasPrice, type StoreProduct } from "@/lib/store-core";
import { cardColours, cardPrice, quickVariant, warrantyText, type CardWhens, whenFor } from "@/lib/store-listing";
import type { StoreText } from "./Store.text";
import type { W2Text } from "./w2.text";
import { Amt, Ic } from "./bits";
import { CardStrip, QuickAdd, SaveHeart } from "./CardParts";
import BidiText from "./BidiText";
import { StIcon } from "./icons";

// One product as the lists show it (D02-A to D08-A as staging has them, store build 2026-11-15): a white card with a
// 1px border (green on hover), its photos in a fixed square on white, never cropped, in a strip that swipes (D06-C), a
// heart to save it (F07); then the brand, the name (two lines at most), a dot for every colour (F04), the delivery chip
// (F05), "Only N left" from the live stock alone (L11), and the price on its own line at the bottom, so the prices of a
// row line up (A02-A), with the quick-add bag at its end for one-size gear (F06). Sold out is the only flag. A
// certified pre-owned product says its warranty (F53). A former price shows only beside a discount licence, between the
// licence's dates (F107).
export default function ProductCard({ p, locale, t, w, licence, today, whens, eager }: {
  p: StoreProduct; locale: string; t: StoreText; w: W2Text; licence: boolean; today: string; whens: CardWhens; eager?: boolean;
}) {
  const name = pick(locale, p.name_en, p.name_ar);
  const href = productHref(p);
  const { lo, from } = cardPrice(p);
  const stock = productStock(p);
  const colours = cardColours(p);
  const was = from ? null : wasPrice(p, licence, today);
  const when = whenFor(p, whens);
  const quick = quickVariant(p);
  return (
    <div className={`st-card${stock.kind === "out" ? " is-out" : ""}`}>
      <div className="st-card-img">
        <CardStrip photos={p.images} alts={p.images.map((src) => photoAlt(p, src, locale))} href={href} eager={eager} prev={w.prevPhoto} next={w.nextPhoto} />
        {stock.kind === "out" && <span className="st-flag">{t.soldOut}</span>}
        <SaveHeart slug={p.slug} label={w.save(name)} />
      </div>
      <div className={`st-card-body${quick ? " has-quick" : ""}`}>
        {p.brand && <span className="st-brand">{p.brand}</span>}
        <Link href={href} className="st-card-name"><BidiText text={name} locale={locale} /></Link>
        {colours.length > 0 && (
          <span className="st-dots" role="img" aria-label={w.coloursOf(colours.map((c) => pick(locale, c.en, c.ar)).join(", "))}>
            {colours.map((c) => <i key={c.key} className={c.hex ? undefined : "st-dot-none"} style={c.hex ? { background: c.hex } : undefined} title={pick(locale, c.en, c.ar)} />)}
          </span>
        )}
        {p.condition === "certified" && <span className="st-card-warranty"><StIcon name="shield" size={16} />{warrantyText(p, w)}</span>}
        {when && <span className={`st-when is-${when.way}`}><Ic name={when.way === "pickup" ? "shop" : "truck"} size={15} />{when.text}</span>}
        {stock.kind === "low" && <span className="st-low">{t.left(stock.left)}</span>}
        <span className="st-card-price">
          <Amt>{from ? t.from(sar(lo)) : sar(lo)}</Amt>
          {was !== null && <s className="st-was"><Amt>{sar(was)}</Amt></s>}
        </span>
        {quick && <QuickAdd variant={quick.id} stock={quick.stock} label={w.quickAdd(name)} added={w.added} cant={w.cantAdd} />}
      </div>
    </div>
  );
}
