import { Link } from "@/i18n/navigation";
import { photoAlt, pick, productHref, productStock, sar, wasPriceAt, type StoreProduct } from "@/lib/store-core";
import { cardColours, cardPrice, quickVariant, warrantyText, type CardWhens, whenFor } from "@/lib/store-listing";
import type { StoreText } from "./Store.text";
import type { W2Text } from "./w2.text";
import { Amt, Ic } from "./bits";
import { CardStrip, QuickAdd, SaveHeart } from "./CardParts";
import BidiText from "./BidiText";
import { StIcon } from "./icons";
import { brandOnce, cardSizes, isWideCard } from "@/lib/sx-B1-list";
import type { SpmText } from "./spm.text";
import { PreorderLine, ProductMarks } from "./spm-parts";
import "./sx-B1.css";

// One product as the lists show it (D02-A to D08-A as staging has them, store build 2026-11-15): a white card with a
// 1px border (green on hover), its photos in a fixed square on white, never cropped, in a strip that swipes (D06-C), a
// heart to save it (F07); then the brand, the name (two lines at most), a dot for every colour (F04), the delivery chip
// (F05), "Only N left" from the live stock alone (L11), and the price on its own line at the bottom, so the prices of a
// row line up (A02-A), with the quick-add bag at its end for one-size gear (F06). Sold out is the only flag. A
// certified pre-owned product says its warranty (F53). A former price shows only beside a discount licence, between the
// licence's dates (F107).
//   On every screen (the user, 2026-11-18: "do all", SM03-B, SM04-B, P17, P22): a bike's card is wider (a whole row on a
// phone, with its price beside its name so it shows in the first screen; half a row on a tablet; two of four columns on a
// computer) and its photo box wider in step, so a row's photos stand as tall; every card keeps the same slots in the
// same places, empty or not (the brand, the name on two lines, the colour dots, one status line: a certified bike's
// warranty or "Only N left", then the delivery chip on one line saying what the product page's first way promises), so
// the lines of a row line up; the name leaves out the brand the brand line already says.
//   The product-management build (2026-11-19): staff's mark (or the automatic New) and, on the staging site, Preview sit
// over the photo with Sold out; a pre-order says so on the status line (never Sold out); quick add stops at the
// product's limit per order, and a pre-order or a Preview opens its page instead.
export default function ProductCard({ p, locale, t, w, x, licence, today, whens, eager }: {
  p: StoreProduct; locale: string; t: StoreText; w: W2Text; x: SpmText; licence: boolean; today: string; whens: CardWhens; eager?: boolean;
}) {
  const name = pick(locale, p.name_en, p.name_ar);
  const href = productHref(p);
  const { lo, from } = cardPrice(p);
  const stock = productStock(p);
  const colours = cardColours(p);
  const was = wasPriceAt(p, licence, today, from ? null : lo);
  const when = whenFor(p, whens);
  const quick = quickVariant(p);
  const wide = isWideCard(p);
  // one status line: a certified pre-owned bike's warranty (one of a kind, so always "Only 1 left"), else the live stock
  const status = p.preorder ? <PreorderLine ships={null} x={x} className="st-card-pre" />
    : p.condition === "certified"
    ? <span className="st-card-warranty"><StIcon name="shield" size={16} />{warrantyText(p, w)}</span>
    : stock.kind === "low" ? <span className="st-low">{t.left(stock.left)}</span> : null;
  return (
    <div className={`st-card${wide ? " is-wide" : ""}${stock.kind === "out" ? " is-out" : ""}`}>
      <div className="st-card-img">
        <CardStrip photos={p.images} alts={p.images.map((src) => photoAlt(p, src, locale))} href={href} eager={eager} sizes={cardSizes(wide)} prev={w.prevPhoto} next={w.nextPhoto} />
        {(stock.kind === "out" || p.badge || p.preview) && (
          <span className="st-flags">
            {stock.kind === "out" && <span className="st-flag">{t.soldOut}</span>}
            <ProductMarks p={p} locale={locale} x={x} />
          </span>
        )}
        <SaveHeart slug={p.slug} label={w.save(name)} />
      </div>
      <div className={`st-card-body${quick ? " has-quick" : ""}`}>
        <span className="st-brand" aria-hidden={p.brand ? undefined : true}>{p.brand}</span>
        <Link href={href} className="st-card-name" aria-label={name === brandOnce(name, p.brand) ? undefined : name}><BidiText text={brandOnce(name, p.brand)} locale={locale} /></Link>
        {colours.length > 0 ? (
          <span className="st-dots" role="img" aria-label={w.coloursOf(colours.map((c) => pick(locale, c.en, c.ar)).join(", "))}>
            {colours.map((c) => <i key={c.key} className={c.hex ? undefined : "st-dot-none"} style={c.hex ? { background: c.hex } : undefined} title={pick(locale, c.en, c.ar)} />)}
          </span>
        ) : <span className="st-dots" aria-hidden="true" />}
        <span className="st-card-status">{status}</span>
        {when
          ? <span className={`st-when is-${when.way}`} title={when.text}><Ic name={when.way === "pickup" ? "shop" : "truck"} size={15} /><span>{when.text}</span></span>
          : <span className="st-when" aria-hidden="true" />}
        <span className="st-card-price">
          <Amt>{from ? t.from(sar(lo)) : sar(lo)}</Amt>
          {was !== null && <s className="st-was"><Amt>{sar(was)}</Amt></s>}
        </span>
        {quick && <QuickAdd variant={quick.id} stock={quick.stock} limit={p.max_per_order} label={w.quickAdd(name)} added={w.added} cant={w.cantAdd} />}
      </div>
    </div>
  );
}
