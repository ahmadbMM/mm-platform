"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useLocalize } from "@/i18n/TxProvider";
import { buyNowHref, MAX_QTY } from "@/lib/cart";
import { pick, sar, variantPrice, type StoreProduct } from "@/lib/store-core";
import { T } from "./Store.text";
import { T as W } from "./w4.text";
import { Amt, Ic } from "./bits";
import { StIcon } from "./icons";
import { cartAdd, useCart } from "./useCart";

// One gift card product (F57): a drawn card that shows the amount picked, the amounts as pills (each variant one face
// value; a sold-out one cannot be picked), how many, Add to cart (it turns into "Added" with a drawn tick, D14-E) and
// Buy now (checkout with this line alone, the cart left as it is), and how long a card is valid.
export default function GiftCardBuy({ p, locale, about, named }: { p: StoreProduct; locale: string; about: string[]; named: boolean }) {
  const t = useLocalize(T);
  const w = useLocalize(W);
  const cart = useCart();
  const amounts = [...p.variants].sort((a, b) => variantPrice(p, a) - variantPrice(p, b) || a.sort - b.sort);
  const first = amounts.find((v) => v.stock > 0) ?? null;
  const [pick_, setPick] = useState<string | null>(first?.id ?? null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [need, setNeed] = useState("");
  const v = amounts.find((x) => x.id === pick_ && x.stock > 0) ?? null;
  const inCart = v ? cart.find((l) => l.variant === v.id.toLowerCase())?.qty ?? 0 : 0;
  const room = Math.max(0, Math.min(MAX_QTY, v?.stock ?? 0) - inCart);
  const n = Math.max(1, Math.min(qty, room || 1));
  const name = pick(locale, p.name_en, p.name_ar);
  const id = `st-gc-${p.id.slice(0, 8)}`;

  function add() {
    if (!v) return;
    if (room <= 0) { setNeed(t.cartHasMost); return; }
    const got = cartAdd(v.id, n);
    if (got === null) { setNeed(t.cartFull); return; }
    if (got <= 0) { setNeed(t.cartHasMost); return; }
    setNeed(""); setAdded(true);
  }

  return (
    <section className="st-gc" aria-labelledby={named ? `${id}-h` : undefined} aria-label={named ? undefined : name}>
      <div className="st-gc-card" aria-hidden="true">
        <svg className="st-gc-mark" viewBox="0 0 223 223" width="34" height="34"><path d="M27.5 189 V49.75 A14.75 14.75 0 0 1 57 49.75 V170.25 A14.75 14.75 0 0 0 86.5 170.25 V49.75 A14.75 14.75 0 0 1 116 49.75 V165 A24 24 0 0 0 140 189 H195" fill="none" stroke="currentColor" strokeWidth="23.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span className="st-gc-card-k">{w.giftTitle}</span>
        <span className="st-gc-card-amt"><Amt>{sar(v ? variantPrice(p, v) : first ? variantPrice(p, first) : p.price)}</Amt></span>
        <span className="st-gc-card-name">MicroMobility</span>
      </div>
      <div className="st-gc-buy">
        {named && <h2 id={`${id}-h`} className="st-gc-h">{name}</h2>}
        <p className="st-opt-k" id={`${id}-k`}>{w.amount}</p>
        <div className="st-gc-amts" role="radiogroup" aria-labelledby={`${id}-k`}>
          {amounts.map((x) => (
            <button key={x.id} type="button" role="radio" aria-checked={pick_ === x.id} disabled={x.stock <= 0}
              onClick={() => { setPick(x.id); setAdded(false); setNeed(""); }}>
              <Amt>{sar(variantPrice(p, x))}</Amt>
            </button>
          ))}
        </div>
        <p className="st-gc-valid"><StIcon name="calendar" size={18} />{w.valid}</p>
        {v ? (
          <div className="st-cta st-gc-cta">
            <div className="st-qty" role="group" aria-label={t.qty}>
              <button type="button" onClick={() => { setQty(Math.max(1, n - 1)); setAdded(false); }} disabled={n <= 1} aria-label={t.less}><Ic name="minus" size={16} /></button>
              <output>{n}</output>
              <button type="button" onClick={() => { setQty(Math.min(room || 1, n + 1)); setAdded(false); }} disabled={n >= (room || 1)} aria-label={t.more}><Ic name="plus" size={16} /></button>
            </div>
            <button type="button" className={`bk-btn st-gc-add${added ? " is-added" : ""}`} onClick={add} aria-live="polite">
              {added ? <><Ic name="tick" size={18} />{w.added}</> : <><Ic name="bag" size={18} />{t.add}</>}
            </button>
            <Link href={buyNowHref(v.id, n)} className="bk-btn2 st-gc-now">{w.buyNow}</Link>
          </div>
        ) : <p className="st-stock out">{t.soldOut}</p>}
        {need && <p className="st-need" role="alert">{need}</p>}
        {added && <Link href="/store/cart" className="st-gc-cart">{t.viewCart}</Link>}
        {about.map((d, i) => <p key={i} className="st-gc-about">{d}</p>)}
      </div>
    </section>
  );
}
