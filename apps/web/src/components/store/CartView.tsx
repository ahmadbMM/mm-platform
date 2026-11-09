"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useLocalize } from "@/i18n/TxProvider";
import { cartLines, MAX_QTY, shipsKsa, subtotalOf } from "@/lib/cart";
import { sized } from "@/lib/img";
import type { PaySettings } from "@/lib/pay/settings";
import { pick, sar, variantLabel, vatIn, type StoreProduct } from "@/lib/store-core";
import { deliveryOptions, freeProgress, type Fulfil } from "@/lib/store-delivery";
import { T, type StoreText } from "./Store.text";
import { Amt, Ic, NoPhoto } from "./bits";
import { cartRemove, cartSetQty, savedFulfil, saveFulfil, useCart, useHydrated } from "./useCart";

// micromobility.sa/store/cart: each line with its photo, choice, price and quantity; a line that cannot be
// ordered as it is (gone, sold out, fewer left) is marked and holds checkout until it is fixed. Beside them,
// the subtotal, the delivery ways with their fees and dates, how far free delivery is, and the total.
export type Whens = Record<string, string | null>;

export default function CartView({ locale, products, settings, whens }: { locale: string; products: StoreProduct[]; settings: PaySettings; whens: Whens }) {
  const t = useLocalize(T);
  const cart = useCart();
  const ready = useHydrated();
  const [picked, setPicked] = useState<Fulfil | null>(() => null);
  if (!ready) return <div className="st-cart-wait" aria-busy="true" />;
  const lines = cartLines(cart, { products });
  if (!lines.length) {
    return (
      <div className="st-empty">
        <p>{t.cartEmpty}</p>
        <Link href="/store" className="bk-btn">{t.browse}</Link>
      </div>
    );
  }
  const subtotal = subtotalOf(lines);
  const options = deliveryOptions(settings, { subtotal, shipKsa: shipsKsa(lines) });
  const kept = (picked ?? savedFulfil()) as Fulfil | null;
  const way = options.find((o) => o.id === kept) ?? options[0];
  const fee = way?.fee ?? 0;
  const total = Math.round((subtotal + fee) * 100) / 100;
  const free = freeProgress(settings, subtotal);
  const blocked = lines.some((l) => l.issue);
  const pickWay = (id: Fulfil) => { setPicked(id); saveFulfil(id); };

  return (
    <div className="st-cart">
      <ul className="st-lines">
        {lines.map((l) => <Line key={l.item.variant} l={l} t={t} locale={locale} />)}
      </ul>
      <aside className="st-sum" aria-labelledby="st-sum-h">
        <h2 id="st-sum-h" className="st-sum-h">{t.summary}</h2>
        <p className="bk-sum-row"><span>{t.subtotal}</span><Amt>{sar(subtotal)}</Amt></p>
        {options.length > 0 && (
          <fieldset className="st-ways-pick">
            <legend>{t.deliveryTo}</legend>
            {options.map((o) => (
              <label key={o.id} className={way?.id === o.id ? "on" : undefined}>
                <input type="radio" name="st-way" value={o.id} checked={way?.id === o.id} onChange={() => pickWay(o.id)} />
                <span>
                  <b>{o.id === "pickup" ? t.pickup : o.id === "jeddah" ? t.jeddah : t.ksa}</b>
                  {o.id !== "pickup" && whens[o.id] && <small>{t.arrives(whens[o.id] as string)}</small>}
                </span>
                <em>{o.fee === 0 ? t.free : <Amt>{sar(o.fee)}</Amt>}</em>
              </label>
            ))}
          </fieldset>
        )}
        {free && way?.id !== "pickup" && (
          <div className="st-free">
            <p>{free.left > 0 ? t.toFree(sar(free.left)) : t.gotFree}</p>
            <span className="st-free-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={free.pct} aria-label={t.freeOver(sar(free.over))}><i style={{ width: `${free.pct}%` }} /></span>
          </div>
        )}
        <p className="bk-sum-tot sep"><span>{t.total}</span><Amt>{sar(total)}</Amt></p>
        <p className="st-vatline">{t.vatOf(sar(vatIn(total)))}</p>
        {blocked && <p className="bk-err" role="alert">{t.fixCart}</p>}
        {blocked
          ? <button type="button" className="bk-btn wide" disabled>{t.checkout}</button>
          : <Link href="/store/checkout" className="bk-btn wide"><Ic name="lock" size={17} />{t.checkout}</Link>}
        <Link href="/store" className="st-link">{t.keepShopping}</Link>
      </aside>
    </div>
  );
}

function Line({ l, t, locale }: { l: ReturnType<typeof cartLines>[number]; t: StoreText; locale: string }) {
  const p = l.product, v = l.variant;
  const name = p ? pick(locale, p.name_en, p.name_ar) : "";
  const max = Math.max(1, Math.min(MAX_QTY, v?.stock ?? 1));
  const issue = l.issue === "gone" ? t.gone : l.issue === "out" ? t.out : l.issue === "short" ? t.short(v?.stock ?? 0) : "";
  return (
    <li className={`st-line${l.issue ? " bad" : ""}`}>
      <span className="st-line-img">{p?.images[0] ? <img src={sized(p.images[0], 640)} alt="" loading="lazy" /> : <NoPhoto />}</span>
      <div className="st-line-mid">
        {p ? <Link href={`/store/${p.slug}`} className="st-line-name">{name}</Link> : <span className="st-line-name">{t.unavailable}</span>}
        {v && variantLabel(v, locale) && <small>{variantLabel(v, locale)}</small>}
        {p && <small><Amt>{t.each(sar(l.unit))}</Amt></small>}
        {issue && <p className="st-line-issue" role="status">{issue}</p>}
        <div className="st-line-acts">
          {p && v && v.stock > 0 && (
            <div className="st-qty sm" role="group" aria-label={`${t.qty}: ${name}`}>
              <button type="button" onClick={() => cartSetQty(l.item.variant, l.item.qty - 1)} disabled={l.item.qty <= 1} aria-label={t.less}><Ic name="minus" size={15} /></button>
              <output>{l.item.qty}</output>
              <button type="button" onClick={() => cartSetQty(l.item.variant, Math.min(max, l.item.qty + 1))} disabled={l.item.qty >= max} aria-label={t.more}><Ic name="plus" size={15} /></button>
            </div>
          )}
          <button type="button" className="st-remove" onClick={() => cartRemove(l.item.variant)} aria-label={`${t.remove}: ${name}`}>{t.remove}</button>
        </div>
      </div>
      <Amt className="st-line-tot">{sar(l.issue ? l.unit * l.item.qty : l.total)}</Amt>
    </li>
  );
}
