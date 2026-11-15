"use client";

import { useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useLocalize } from "@/i18n/TxProvider";
import { cartLines, MAX_QTY, shipsKsa, type CartLine } from "@/lib/cart";
import { sized } from "@/lib/img";
import type { PaySettings } from "@/lib/pay/settings";
import { pick, priceRange, productHref, sar, variantLabel, vatIn, type StoreProduct } from "@/lib/store-core";
import { deliveryOptions, freeProgress, type Fulfil } from "@/lib/store-delivery";
import { checkoutMoney, digitalOnly, goesWithCart, hasBike, onlyChoice, type Way } from "@/lib/store-checkout";
import { T, type StoreText } from "./Store.text";
import { T as W, type W4Text } from "./w4.text";
import { Amt, Ic, NoPhoto } from "./bits";
import { ApplePayButton, CodeRow, Off } from "./CheckoutBits";
import { cartAdd, cartRemove, cartSetQty, savedFulfil, saveFulfil, useCart, useHydrated } from "./useCart";
import { laterPut, laterRemove, useLater } from "./useLists";
import { useApplePay, usePromo } from "./useCode";

// micromobility.sa/store/cart: each line with its photo, choice, price and quantity; a line that cannot be ordered as it
// is (gone, sold out, fewer left) is marked and holds checkout until it is fixed, and any line can be saved for later
// (F68: kept in this browser, listed under the cart with Move to cart). Under the lines, what goes with a bike in the
// cart (F66: two of the products staff paired with it, each added in one tap where it has one choice, turning into
// "Added"). Beside them, the subtotal, a starter set's saving and the code (F31, F67: only beside the discount
// licence), the delivery ways with their fees and dates, how far free delivery is, the total, Checkout and, on a device
// with Apple Pay, Apple's own button to the same checkout (F83: Moyasar's form there offers Apple Pay first).
export type Whens = Record<string, string | null>;

export default function CartView({ locale, products, settings, whens, licence, applePay }: {
  locale: string; products: StoreProduct[]; settings: PaySettings; whens: Whens; licence: string | null; applePay: boolean;
}) {
  const t = useLocalize(T);
  const w = useLocalize(W);
  const cart = useCart();
  const later = useLater();
  const ready = useHydrated();
  const apple = useApplePay(applePay);
  const router = useRouter();
  const [picked, setPicked] = useState<Fulfil | null>(() => null);
  const [moveMsg, setMoveMsg] = useState("");
  const [gwAdded, setGwAdded] = useState<string[]>([]);
  const promo = usePromo(cart, !!licence);
  if (!ready) return <div className="st-cart-wait" aria-busy="true" />;
  const store = { products };
  const lines = cartLines(cart, store);
  const kept = cartLines(later, store);
  const goes = goesWithCart(products, lines, 2, gwAdded);
  const laterList = kept.length > 0 && <Later lines={kept} t={t} w={w} locale={locale} msg={moveMsg} onMove={(v, qty) => {
    const got = cartAdd(v, qty);
    if (got === null) { setMoveMsg(t.cartFull); return; }
    setMoveMsg(""); laterRemove(v);
  }} />;
  if (!lines.length) {
    return (
      <div className="st-cart st-ct-none">
        <div className="st-ct-main">
          <div className="st-empty">
            <p>{t.cartEmpty}</p>
            <Link href="/store" className="bk-btn">{t.browse}</Link>
          </div>
          {laterList}
        </div>
      </div>
    );
  }
  const digital = digitalOnly(lines);
  const bike = hasBike(lines);
  const before = checkoutMoney({ lines, settings, way: "pickup", licence, code: promo.hit?.discount });
  const options = digital ? [] : deliveryOptions(settings, { subtotal: before.subtotal - before.discount, shipKsa: shipsKsa(lines) });
  const keptWay = (picked ?? savedFulfil()) as Fulfil | null;
  const way: Way = digital ? "digital" : (options.find((o) => o.id === keptWay) ?? options[0])?.id ?? "pickup";
  const money = checkoutMoney({ lines, settings, way, licence, code: promo.hit?.discount });
  const giftValue = lines.filter((l) => l.product?.kind === "gift_card").reduce((n, l) => n + l.total, 0);
  const free = digital ? null : freeProgress(settings, before.subtotal - before.discount);
  const blocked = lines.some((l) => l.issue);
  const pickWay = (id: Fulfil) => { setPicked(id); saveFulfil(id); };
  const wayName = (id: Fulfil) => (id === "pickup" ? (bike ? w.pickupBuilt : t.pickup) : id === "jeddah" ? (bike ? w.jeddahBuilt : t.jeddah) : t.ksa);
  const wayLine = (id: Fulfil) => (id === "pickup" ? (whens.pickup ? w.ready(whens.pickup) : "") : whens[id] ? t.arrives(whens[id] as string) : "");

  return (
    <div className="st-cart">
      <div className="st-ct-main">
        <ul className="st-lines">
          {lines.map((l) => <Line key={l.item.variant} l={l} t={t} w={w} locale={locale} />)}
        </ul>
        {goes.length > 0 && <GoesWith list={goes} added={gwAdded} onAdded={(id) => setGwAdded((x) => [...x, id])} t={t} w={w} locale={locale} />}
        {laterList}
      </div>
      <aside className="st-sum" aria-labelledby="st-sum-h">
        <h2 id="st-sum-h" className="st-sum-h">{t.summary}</h2>
        <p className="bk-sum-row"><span>{t.subtotal}</span><Amt>{sar(money.subtotal)}</Amt></p>
        {money.setOff > 0 && <p className="bk-sum-row st-co-off"><span>{w.setLine}</span><Off n={money.setOff} /></p>}
        {licence && <CodeRow promo={promo} off={money.codeOff} t={t} w={w} />}
        {options.length > 0 && (
          <fieldset className="st-ways-pick">
            <legend>{t.deliveryTo}</legend>
            {options.map((o) => (
              <label key={o.id} className={way === o.id ? "on" : undefined}>
                <input type="radio" name="st-way" value={o.id} checked={way === o.id} onChange={() => pickWay(o.id)} />
                <span>
                  <b>{wayName(o.id)}</b>
                  {wayLine(o.id) && <small>{wayLine(o.id)}</small>}
                </span>
                <em>{o.fee === 0 ? t.free : <Amt>{sar(o.fee)}</Amt>}</em>
              </label>
            ))}
          </fieldset>
        )}
        {free && way !== "pickup" && (
          <div className="st-free">
            <p>{free.left > 0 ? t.toFree(sar(free.left)) : t.gotFree}</p>
            <span className="st-free-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={free.pct} aria-label={t.freeOver(sar(free.over))}><i style={{ width: `${free.pct}%` }} /></span>
          </div>
        )}
        <p className="bk-sum-tot sep"><span>{t.total}</span><Amt>{sar(money.total)}</Amt></p>
        <p className="st-vatline">{t.vatOf(sar(vatIn(Math.max(0, money.total - giftValue))))}</p>
        {blocked && <p className="bk-err" role="alert">{t.fixCart}</p>}
        {blocked
          ? <button type="button" className="bk-btn wide" disabled>{t.checkout}</button>
          : <Link href="/store/checkout" className="bk-btn wide"><Ic name="lock" size={17} />{t.checkout}</Link>}
        {apple && !blocked && <ApplePayButton label={w.applePay} lang={locale} onClick={() => router.push("/store/checkout")} />}
        <Link href="/store" className="st-link">{t.keepShopping}</Link>
      </aside>
    </div>
  );
}

function Line({ l, t, w, locale }: { l: CartLine; t: StoreText; w: W4Text; locale: string }) {
  const p = l.product, v = l.variant;
  const name = p ? pick(locale, p.name_en, p.name_ar) : "";
  const max = Math.max(1, Math.min(MAX_QTY, v?.stock ?? 1));
  const issue = l.issue === "gone" ? t.gone : l.issue === "out" ? t.out : l.issue === "short" ? t.short(v?.stock ?? 0) : "";
  return (
    <li className={`st-line${l.issue ? " bad" : ""}`}>
      <span className="st-line-img">{p?.images[0] ? <img src={sized(p.images[0], 640)} alt="" loading="lazy" /> : <NoPhoto />}</span>
      <div className="st-line-mid">
        {p ? <Link href={productHref(p)} className="st-line-name">{name}</Link> : <span className="st-line-name">{t.unavailable}</span>}
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
          {p && (
            <button type="button" className="st-remove" onClick={() => { laterPut(l.item); cartRemove(l.item.variant); }} aria-label={`${w.saveLater}: ${name}`}>{w.saveLater}</button>
          )}
        </div>
      </div>
      <Amt className="st-line-tot">{sar(l.issue ? l.unit * l.item.qty : l.total)}</Amt>
    </li>
  );
}

/** Saved for later (F68): what was put aside, with Move to cart and Remove; a choice no longer in the store says so. */
function Later({ lines, t, w, locale, msg, onMove }: { lines: CartLine[]; t: StoreText; w: W4Text; locale: string; msg: string; onMove: (variant: string, qty: number) => void }) {
  return (
    <section className="st-ct-later" aria-labelledby="st-ct-later-h">
      <h2 id="st-ct-later-h" className="st-sum-h">{w.laterH(lines.length)}</h2>
      {msg && <p className="bk-err" role="alert">{msg}</p>}
      <ul className="st-lines">
        {lines.map((l) => {
          const p = l.product, v = l.variant;
          const name = p ? pick(locale, p.name_en, p.name_ar) : t.unavailable;
          return (
            <li key={l.item.variant} className="st-line">
              <span className="st-line-img">{p?.images[0] ? <img src={sized(p.images[0], 640)} alt="" loading="lazy" /> : <NoPhoto />}</span>
              <div className="st-line-mid">
                {p ? <Link href={productHref(p)} className="st-line-name">{name}</Link> : <span className="st-line-name">{name}</span>}
                {v && variantLabel(v, locale) && <small>{variantLabel(v, locale)}</small>}
                {l.issue === "gone" ? <p className="st-line-issue" role="status">{t.lineIssue.gone}</p> : l.issue === "out" ? <p className="st-line-issue" role="status">{t.soldOut}</p> : null}
                <div className="st-line-acts">
                  {p && v && <button type="button" className="bk-btn2 st-ct-move" onClick={() => onMove(l.item.variant, l.item.qty)} aria-label={`${w.toCart}: ${name}`}>{w.toCart}</button>}
                  <button type="button" className="st-remove" onClick={() => laterRemove(l.item.variant)} aria-label={`${t.remove}: ${name}`}>{t.remove}</button>
                </div>
              </div>
              {p && <Amt className="st-line-tot">{sar(l.unit * l.item.qty)}</Amt>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** "Goes with your bike" (F66): two small cards; Add puts a one-choice product in the cart and turns into "Added" with a
 *  drawn tick (D14-E); a product with sizes or colours opens its page to choose. */
function GoesWith({ list, added, onAdded, t, w, locale }: { list: StoreProduct[]; added: string[]; onAdded: (id: string) => void; t: StoreText; w: W4Text; locale: string }) {
  const [full, setFull] = useState(false);
  return (
    <section className="st-ct-gw" aria-labelledby="st-ct-gw-h">
      <h2 id="st-ct-gw-h" className="st-sum-h">{w.goesWith}</h2>
      {full && <p className="bk-err" role="alert">{t.cartFull}</p>}
      <ul>
        {list.map((p) => {
          const name = pick(locale, p.name_en, p.name_ar);
          const one = onlyChoice(p);
          const { lo, hi } = priceRange(p);
          return (
            <li key={p.id} className="st-ct-gw-card">
              <Link href={productHref(p)} className="st-ct-gw-img" tabIndex={-1} aria-hidden="true">{p.images[0] ? <img src={sized(p.images[0], 640)} alt="" loading="lazy" /> : <NoPhoto />}</Link>
              <span className="st-ct-gw-mid">
                <Link href={productHref(p)} className="st-line-name">{name}</Link>
                <Amt>{lo !== hi ? t.from(sar(lo)) : sar(lo)}</Amt>
              </span>
              {one ? (
                <button type="button" className={`bk-btn2 st-ct-add${added.includes(p.id) ? " is-added" : ""}`} aria-label={added.includes(p.id) ? `${w.added}: ${name}` : `${w.add}: ${name}`}
                  onClick={() => { if (added.includes(p.id)) return; const got = cartAdd(one.id, 1); if (got === null) { setFull(true); return; } setFull(false); onAdded(p.id); }}>
                  {added.includes(p.id) ? <><Ic name="tick" size={16} />{w.added}</> : <><Ic name="plus" size={16} />{w.add}</>}
                </button>
              ) : (
                <Link href={productHref(p)} className="bk-btn2 st-ct-add">{w.choose}</Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
