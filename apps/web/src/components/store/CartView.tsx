"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useLocalize } from "@/i18n/TxProvider";
import { intlOf } from "@/i18n/locales";
import { cartLines, clampCart, MAX_QTY, productInCart, shipsKsa, type CartItem, type CartLine } from "@/lib/cart";
import { minOrderLeft } from "@/lib/store-rules";
import { sized } from "@/lib/img";
import type { PaySettings } from "@/lib/pay/settings";
import { linePhoto, pick, priceRange, productHref, sar, variantLabel, vatIn, type StoreProduct } from "@/lib/store-core";
import { deliveryOptions, freeProgress, type Fulfil } from "@/lib/store-delivery";
import { checkoutMoney, dayLabel, digitalOnly, goesWithCart, hasBike, onlyChoice, type Way } from "@/lib/store-checkout";
import { T, type StoreText } from "./Store.text";
import { T as W, type W4Text } from "./w4.text";
import { Amt, Ic, NoPhoto } from "./bits";
import { ApplePayButton, CodeRow, Off } from "./CheckoutBits";
import { cartAdd, cartRemove, cartReplace, cartSetQty, savedFulfil, saveFulfil, useCart, useHydrated } from "./useCart";
import { laterPut, laterRemove, useLater } from "./useLists";
import { useApplePay, usePromo } from "./useCode";
import { T as X, type SxText } from "./sx-B3.text";
import { SxIcon } from "./sx-b3-icons";
import { useBoxCookie } from "./sx-b3-reserve";
import { T as SPM, type SpmText } from "./spm.text";
import { PreorderLine } from "./spm-parts";
import "./sx-B3.css";

// micromobility.sa/store/cart: each line with its photo, choice, price and quantity; a line that cannot be ordered as it
// is (gone, sold out, fewer left) is marked and holds checkout until it is fixed, and any line can be saved for later
// (F68: kept in this browser, listed under the cart with Move to cart). Under the lines, what goes with a bike in the
// cart (F66: two of the products staff paired with it, each added in one tap where it has one choice, turning into
// "Added"). Beside them, the subtotal, a starter set's saving and the code (F31, F67: only beside the discount
// licence), the delivery ways with their fees and dates, how far free delivery is, the total, Checkout and, on a device
// with Apple Pay, Apple's own button to the same checkout (F83: Moyasar's form there offers Apple Pay first).
// The build of 2026-11-18 (SM10-B, SM10-C, P10, P16): every line in one template (a 72 px photo, the name, the size and
// colour and the price on one row; under it the 44 px stepper and the drawn Save for later and Remove buttons), the box
// kept at the height it had when last drawn here until the browser's cart is read (lib/sx-b3.ts), on a phone a row at
// the top with the total and Checkout, and under the total Apple Pay first, then Checkout.
//   The product-management build (2026-11-19): a product's lines are brought down to its limit per order as the cart is
// read (lib/cart.ts clampCart) and say the limit once they reach it; a pre-order's line says so with the day it ships by;
// under the store's smallest order (store.minOrder) Checkout waits, one line saying how much more it needs.
export type Whens = Record<string, string | null>;

export default function CartView({ locale, products, settings, whens, licence, applePay, reserve, minOrder = null }: {
  locale: string; products: StoreProduct[]; settings: PaySettings; whens: Whens; licence: string | null; applePay: boolean;
  /** the box's height until the cart is read: narrow (under 900 px) and wide, in px */
  reserve: { narrow: number; wide: number };
  /** store.minOrder: the smallest subtotal an order may have, null for none */
  minOrder?: number | null;
}) {
  const t = useLocalize(T);
  const w = useLocalize(W);
  const x = useLocalize(X);
  const sp = useLocalize(SPM);
  const box = useRef<HTMLDivElement>(null);
  const cart = useCart();
  const later = useLater();
  const ready = useHydrated();
  const apple = useApplePay(applePay);
  const router = useRouter();
  const [picked, setPicked] = useState<Fulfil | null>(() => null);
  const [moveMsg, setMoveMsg] = useState("");
  const [gwAdded, setGwAdded] = useState<string[]>([]);
  const promo = usePromo(cart, !!licence && !digitalOnly(cartLines(cart, { products })));
  useBoxCookie(box, "cart", cart.length, ready);
  // a product's lines past its limit per order are brought down to it once the cart is read
  useEffect(() => {
    if (!ready) return;
    const c = clampCart(cart, { products });
    if (c.changed) cartReplace(c.cart);
  }, [ready, cart, products]);
  if (!ready) return <ReserveBox reserve={reserve} />;
  const store = { products };
  const lines = cartLines(cart, store);
  const kept = cartLines(later, store);
  // added from the row and still in the cart: one removed since (Remove, Save for later) offers Add again
  const gwLive = gwAdded.filter((id) => lines.some((l) => l.product?.id === id));
  const goes = goesWithCart(products, lines, 2, gwLive);
  const laterList = kept.length > 0 && <Later lines={kept} t={t} w={w} x={x} locale={locale} msg={moveMsg} onMove={(v, qty) => {
    // a Preview's line reads as gone (no Move to cart); never moved even so
    if (!kept.some((l) => l.item.variant === v && l.product && !l.product.preview)) return;
    const got = cartAdd(v, qty);
    if (got === null) { setMoveMsg(t.cartFull); return; }
    if (got <= 0) { setMoveMsg(t.cartHasMost); return; } // the cart's line is at its most already: kept here, not lost
    // the cart took part of it (a line holds 10 at most): the rest stays here, never lost
    if (got < qty) { laterPut({ variant: v, qty: qty - got }); setMoveMsg(t.cartHasMost); return; }
    setMoveMsg(""); laterRemove(v);
  }} />;
  if (!lines.length) {
    return (
      <div className="st-cart st-ct-none" ref={box}>
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
  const short = minOrderLeft(minOrder, money.subtotal);
  const blocked = lines.some((l) => l.issue) || short > 0;
  const pickWay = (id: Fulfil) => { setPicked(id); saveFulfil(id); };
  const wayName = (id: Fulfil) => (id === "pickup" ? (bike ? w.pickupBuilt : t.pickup) : id === "jeddah" ? (bike ? w.jeddahBuilt : t.jeddah) : t.ksa);
  const wayLine = (id: Fulfil) => (id === "pickup" ? (whens.pickup ? w.ready(whens.pickup) : "") : whens[id] ? t.arrives(whens[id] as string) : "");

  const go = blocked
    ? <button type="button" className="bk-btn wide" disabled>{t.checkout}</button>
    : <Link href="/store/checkout" className="bk-btn wide"><Ic name="lock" size={17} />{t.checkout}</Link>;
  return (
    <div className="st-cart" ref={box}>
      {/* SM10-C: on a phone, the total and Checkout before the lines (not pinned: it scrolls away with the page) */}
      <div className="sx3-top">
        <p><span>{t.total}</span><Amt>{sar(money.total)}</Amt></p>
        {blocked
          ? <button type="button" className="bk-btn" disabled>{t.checkout}</button>
          : <Link href="/store/checkout" className="bk-btn">{t.checkout}</Link>}
      </div>
      <div className="st-ct-main">
        <ul className="st-lines">
          {lines.map((l) => <Line key={l.item.variant} l={l} cart={cart} t={t} w={w} x={x} sp={sp} locale={locale} />)}
        </ul>
        {goes.length > 0 && <GoesWith list={goes} added={gwLive} onAdded={(id) => setGwAdded((x) => (x.includes(id) ? x : [...x, id]))} t={t} w={w} locale={locale} />}
        {laterList}
      </div>
      <aside className="st-sum" aria-labelledby="st-sum-h">
        <h2 id="st-sum-h" className="st-sum-h">{t.summary}</h2>
        <p className="bk-sum-row"><span>{t.subtotal}</span><Amt>{sar(money.subtotal)}</Amt></p>
        {money.setOff > 0 && <p className="bk-sum-row st-co-off"><span>{w.setLine}</span><Off n={money.setOff} /></p>}
        {licence && !digital && <CodeRow promo={promo} off={money.codeOff} t={t} w={w} />}
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
        {lines.some((l) => l.issue) ? <p className="bk-err" role="alert">{t.fixCart}</p> : short > 0 && <p className="st-min" role="status">{sp.minLeft(sar(short))}</p>}
        {/* SM10-B: the express button first, then Checkout (both lead to the same checkout) */}
        {apple && !blocked && <ApplePayButton label={w.applePay} lang={locale} onClick={() => router.push("/store/checkout")} />}
        {go}
        <Link href="/store" className="st-link">{t.keepShopping}</Link>
      </aside>
    </div>
  );
}

/** The box drawn until the browser's cart is read: the height the cart had when last drawn (P10). */
export function ReserveBox({ reserve }: { reserve: { narrow: number; wide: number } }) {
  return <div className="st-cart-wait" aria-busy="true" style={{ "--sx3-n": `${reserve.narrow}px`, "--sx3-w": `${reserve.wide}px` } as CSSProperties} />;
}

/** One line (SM10-B, P16): the photo, the name, the size and colour (and "2 × price" for more than one) and the line's
 *  price on the first row; the stepper, Save for later and Remove on the second, always in the same places. */
function Line({ l, cart, t, w, x, sp, locale }: { l: CartLine; cart: CartItem[]; t: StoreText; w: W4Text; x: SxText; sp: SpmText; locale: string }) {
  const p = l.product, v = l.variant, img = p ? linePhoto(p, v) : null;
  const name = p ? pick(locale, p.name_en, p.name_ar) : "";
  // 10 a line, the stock (not for a pre-order) and what the product's limit leaves beside its other lines
  const limit = p?.max_per_order ?? null;
  const others = p ? productInCart(cart, p) - l.item.qty : 0;
  const max = Math.max(1, Math.min(MAX_QTY, p?.preorder ? MAX_QTY : v?.stock ?? 1, limit === null ? MAX_QTY : limit - others));
  const atLimit = limit !== null && p !== null && others + l.item.qty >= limit;
  const issue = l.issue === "gone" ? t.gone : l.issue === "out" ? t.out : l.issue === "short" ? t.short(v?.stock ?? 0) : l.issue === "max" && limit !== null ? sp.perOrder(limit) : "";
  const label = v ? variantLabel(v, locale) : "";
  return (
    <li className={`st-line${l.issue ? " bad" : ""}`}>
      <span className="st-line-img">{img ? <img src={sized(img, 320)} alt="" loading="lazy" width={72} height={72} /> : <NoPhoto />}</span>
      <div className="st-line-mid">
        {p ? <Link href={productHref(p)} className="st-line-name">{name}</Link> : <span className="st-line-name">{t.unavailable}</span>}
        {(label || (p && l.item.qty > 1)) && <small>{[label, p && l.item.qty > 1 ? x.times(l.item.qty, sar(l.unit)) : ""].filter(Boolean).join(" · ")}</small>}
        {p?.preorder && <PreorderLine ships={p.ships_on ? dayLabel(p.ships_on, intlOf(locale)) : null} x={sp} className="st-line-pre" />}
        {issue ? <p className="st-line-issue" role="status">{issue}</p> : atLimit && <p className="st-line-max">{sp.perOrder(limit)}</p>}
      </div>
      <Amt className="st-line-tot">{sar(l.issue ? l.unit * l.item.qty : l.total)}</Amt>
      <div className="st-line-acts">
        {p && v && (v.stock > 0 || p.preorder) ? (
          <div className="st-qty sm" role="group" aria-label={`${t.qty}: ${name}`}>
            <button type="button" onClick={() => cartSetQty(l.item.variant, l.item.qty - 1)} disabled={l.item.qty <= 1} aria-label={t.less}><Ic name="minus" size={15} /></button>
            <output>{l.item.qty}</output>
            <button type="button" onClick={() => cartSetQty(l.item.variant, Math.min(max, l.item.qty + 1))} disabled={l.item.qty >= max} aria-label={t.more}><Ic name="plus" size={15} /></button>
          </div>
        ) : <span />}
        <span className="sx3-acts">
          {p && (
            <button type="button" className="sx3-icbtn" onClick={() => { laterPut(l.item); cartRemove(l.item.variant); }} aria-label={x.saveOf(name)} title={w.saveLater}>
              <SxIcon name="bookmark" size={20} />
            </button>
          )}
          <button type="button" className="sx3-icbtn" onClick={() => cartRemove(l.item.variant)} aria-label={x.removeOf(name || t.unavailable)} title={t.remove}>
            <SxIcon name="trash" size={20} />
          </button>
        </span>
      </div>
    </li>
  );
}

/** Saved for later (F68): what was put aside, with Move to cart and Remove; a choice no longer in the store says so. */
function Later({ lines, t, w, x, locale, msg, onMove }: { lines: CartLine[]; t: StoreText; w: W4Text; x: SxText; locale: string; msg: string; onMove: (variant: string, qty: number) => void }) {
  return (
    <section className="st-ct-later" aria-labelledby="st-ct-later-h">
      <h2 id="st-ct-later-h" className="st-sum-h">{w.laterH(lines.length)}</h2>
      {msg && <p className="bk-err" role="alert">{msg}</p>}
      <ul className="st-lines">
        {lines.map((l) => {
          const p = l.product, v = l.variant, img = p ? linePhoto(p, v) : null;
          const name = p ? pick(locale, p.name_en, p.name_ar) : t.unavailable;
          return (
            <li key={l.item.variant} className="st-line">
              <span className="st-line-img">{img ? <img src={sized(img, 320)} alt="" loading="lazy" width={72} height={72} /> : <NoPhoto />}</span>
              <div className="st-line-mid">
                {p ? <Link href={productHref(p)} className="st-line-name">{name}</Link> : <span className="st-line-name">{name}</span>}
                {v && variantLabel(v, locale) && <small>{variantLabel(v, locale)}</small>}
                {l.issue === "gone" ? <p className="st-line-issue" role="status">{t.lineIssue.gone}</p> : l.issue === "out" ? <p className="st-line-issue" role="status">{t.soldOut}</p> : null}
              </div>
              {p ? <Amt className="st-line-tot">{sar(l.unit * l.item.qty)}</Amt> : <span />}
              <div className="st-line-acts">
                {p && v ? <button type="button" className="bk-btn2 st-ct-move" onClick={() => onMove(l.item.variant, l.item.qty)} aria-label={`${w.toCart}: ${name}`}>{w.toCart}</button> : <span />}
                <span className="sx3-acts">
                  <button type="button" className="sx3-icbtn" onClick={() => laterRemove(l.item.variant)} aria-label={x.removeOf(name)} title={t.remove}>
                    <SxIcon name="trash" size={20} />
                  </button>
                </span>
              </div>
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
                  onClick={() => { if (added.includes(p.id) || p.preview) return; const got = cartAdd(one.id, 1); if (got === null) { setFull(true); return; } setFull(false); onAdded(p.id); }}>
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
