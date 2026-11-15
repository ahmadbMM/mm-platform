"use client";

import { useLocalize } from "@/i18n/TxProvider";
import { pick, sar, variantLabel, type StockState, type StoreProduct, type StoreVariant } from "@/lib/store-core";
import type { Estimate } from "@/lib/store-pdp";
import { T } from "./Store.text";
import { T as W } from "./w3a.text";
import { Amt, Ic, WhatsAppMark } from "./bits";
import { Bidi } from "./pdp-bits";

// The buy box (D10, F25, F35, F83, F32, D14-E): bordered, beside the choices on a desktop (and in view as the page
// scrolls), under them on a phone, where a bike's reads as the summary of its steps. It holds the price, the day it
// can be had by the way picked, the stock, the quantity, the estimated total with that way (one row above Add: "Total
// with Jeddah delivery"), Add to cart - which says Added with a tick for a moment, no pop-up - Buy now straight to
// checkout (with the extras ticked), Apple Pay's own button on a device that has it (it goes to the same checkout and
// pays with Apple Pay there: Moyasar's form takes the delivery choice nowhere else), and "Ask about this bike" on
// WhatsApp as an outline pill. A product sold out offers to be told when it is back instead.
type Line = { variant: string; price: number; product: StoreProduct };

export default function BuyBox({ locale, rtl, bike, name, v, priceText, unit, qty, max, stock, extras, est, whens, canAdd, added, need, applePay, askHref, onQty, onAdd, onBuy, onNotify }: {
  locale: string; rtl: boolean; bike: boolean; name: string; v: StoreVariant | null; priceText: string; unit: number | null; qty: number; max: number; stock: StockState;
  extras: Line[]; est: Estimate; whens: Record<string, string | null>; canAdd: boolean; added: boolean; need: string; applePay: boolean; askHref: string;
  onQty: (q: number) => void; onAdd: () => void; onBuy: () => void; onNotify: () => void;
}) {
  const t = useLocalize(T);
  const w = useLocalize(W);
  const way = est.way;
  const when = way ? whens[way.id] ?? null : null;
  const pickName = (x: StoreProduct) => pick(locale, x.name_en, x.name_ar);
  const Box = bike ? "section" : "div";
  return (
    <Box className="st-buybox" {...(bike ? { "aria-labelledby": "st-buy-h" } : {})}>
      {bike && <h2 id="st-buy-h" className="st-buybox-h">{w.summary}</h2>}
      <p className="st-buybox-price"><Amt>{priceText}</Amt></p>
      {when && way && (
        <p className="st-buybox-when"><Ic name={way.id === "pickup" ? "shop" : "truck"} size={18} />{way.id === "pickup" ? w.ready(when) : t.arrives(when)}</p>
      )}
      <p className={`st-stock ${stock.kind}`}>{stock.kind === "out" ? t.soldOut : stock.kind === "low" ? t.left(stock.left) : t.inStock}</p>

      {bike && unit !== null && (
        <ul className="st-sumlines">
          <li><span><Bidi text={name} rtl={rtl} />{v && variantLabel(v, locale) ? <small> · {variantLabel(v, locale)}</small> : null}{qty > 1 ? <small> · {t.qtyN(qty)}</small> : null}</span><Amt>{sar(unit * qty)}</Amt></li>
          {extras.map((x) => <li key={x.variant}><span><Bidi text={pickName(x.product)} rtl={rtl} /></span><Amt>{sar(x.price)}</Amt></li>)}
          {way && <li><span>{way.id === "pickup" ? w.pickupBuilt : way.id === "jeddah" ? w.jeddahBuilt : t.ksa}</span>{way.fee === 0 ? <span>{t.free}</span> : <Amt>{sar(way.fee)}</Amt>}</li>}
        </ul>
      )}
      {canAdd && est.total !== null && (
        <p className="bk-sum-tot st-total"><span>{way ? w.totalWith[way.id] : t.total}</span><Amt>{sar(est.total)}</Amt></p>
      )}

      <div className="st-cta">
        {canAdd && (
          <div className="st-qty" role="group" aria-label={t.qty}>
            <button type="button" onClick={() => onQty(Math.max(1, qty - 1))} disabled={qty <= 1} aria-label={t.less}><Ic name="minus" size={16} /></button>
            <output aria-live="polite">{qty}</output>
            <button type="button" onClick={() => onQty(Math.min(max, qty + 1))} disabled={qty >= max} aria-label={t.more}><Ic name="plus" size={16} /></button>
          </div>
        )}
        <button type="button" className={`bk-btn grow st-add${added ? " is-added" : ""}`} onClick={onAdd} disabled={!canAdd}>
          {added ? <><Ic name="tick" size={18} />{w.addedBtn}</> : <><Ic name="bag" size={18} />{canAdd ? t.add : t.soldOut}</>}
        </button>
      </div>
      <p className="st-sr" aria-live="polite">{added ? t.added : ""}</p>
      {need === "full" && <p className="st-need" role="alert">{t.cartFull}</p>}
      {need === "most" && <p className="st-need" role="alert">{t.cartHasMost}</p>}
      {canAdd ? (
        <>
          <button type="button" className="bk-btn2 wide st-buynow" onClick={onBuy}>{w.buyNow}</button>
          {applePay && (
            // Apple's own button, drawn by Safari (-apple-pay-button), in the page's language: the official artwork
            <button type="button" className="st-applepay" lang={locale === "ar" ? "ar" : "en"} onClick={onBuy} aria-label={w.applePay} />
          )}
        </>
      ) : (
        <button type="button" className="bk-btn2 wide st-buynow" aria-haspopup="dialog" onClick={onNotify}>{w.notifyAny}</button>
      )}
      {askHref && (
        <a className="st-ask" href={askHref} target="_blank" rel="noopener noreferrer"><WhatsAppMark size={18} />{bike ? w.askBike : w.askItem}</a>
      )}
    </Box>
  );
}
