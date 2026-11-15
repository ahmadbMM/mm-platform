"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { isRtl } from "@/i18n/locales";
import { ADDED_MS, MAX_QTY } from "@/lib/cart";
import type { PaySettings } from "@/lib/pay/settings";
import {
  optionOpen, optionsOf, photosFor, pick, pickVariant, priceRange, productStock, sar, sizeForHeight, stockState, variantLabel, variantPrice,
  wasPrice, type StoreProduct, type StoreVariant,
} from "@/lib/store-core";
import { warrantyMonths } from "@/lib/store-policy";
import { buyNowWithHref, estimate, extrasOf, extraChoices, heightCm, keptWay, requestLabel, soldOutTarget, tabbyPart, ticked, waHref } from "@/lib/store-pdp";
import type { Fulfil } from "@/lib/store-delivery";
import { T } from "./Store.text";
import { T as W } from "./w3a.text";
import { Amt } from "./bits";
import { specIcon, StIcon } from "./icons";
import { Bidi } from "./pdp-bits";
import BuyBox from "./BuyBox";
import DeliveryInfo, { ReturnsPop } from "./DeliveryInfo";
import PdpPickers from "./PdpPickers";
import ProductGallery from "./ProductGallery";
import SizeGuide from "./SizeGuide";
import StockAsk from "./StockAsk";
import { cartAdd, savedFulfil, saveFulfil, useCart, useHydrated } from "./useCart";
import { savedToggle, useSaved } from "./useLists";

// The top of a product's page (store build 2026-11-15, chain w3a): its photos, its name and price, the choices, the buy
// box and the delivery and returns box, as one piece because they share what is picked.
//   Desktop (D10, from 1120px): three columns as Amazon's - the photos with their thumbnails | the brand, name, price,
//   key points and the choices | a bordered buy box (price, delivery date, stock, quantity, the estimated total, Add to
//   cart, Buy now) with the delivery and returns box under it, which stays in view. From 900px two: the photos (in view)
//   | the rest. A phone (D11-C, D12-C): the peeking photos, then the name and price, then the choices as numbered steps
//   on a bike (1 Size, 2 Colour, 3 Extras: the Goes-with products as tick rows, F60) and plain on the rest, then the
//   buy box as the summary with the estimated total. Nothing is fixed to the bottom of the screen (D13-A).
//   The photos follow the colour picked (F18), each colour's chip is its photo (D15-B), each size button carries the
//   rider height (F20), the size guide's height field rings the size that fits (F21, F22). Added to the cart, the button
//   says Added with a tick for a moment, no pop-up (D14-E). A sold-out size or colour asks to be told when it is back
//   (F34). The delivery rows and the total follow the price of what is picked, the extras and the way picked (F25, X06),
//   and the way picked is the cart's (mm-cart-fulfil).
export type TopProps = {
  p: StoreProduct;
  locale: string;
  licence: string | null;
  today: string;
  /** The Goes-with products a bike's Extras step offers (relatedOf), cut down for the browser. */
  related: StoreProduct[];
  settings: PaySettings;
  /** Each way's dates written for this language (allWhens): pickup's is the day it is ready. */
  whens: Record<string, string | null>;
  showroom: string;
  /** The Help page's Returns answers, for the returns pop-up (X07). */
  policy: { q: string; a: string }[];
  /** The WhatsApp number (digits), "" for none. */
  whatsapp: string;
  /** store.tabby.on (F29). */
  tabby: boolean;
  /** Payments ready and Apple Pay's domain file in place (F83). */
  applePay: boolean;
  /** The page's own address, for the WhatsApp message (the browser's is used once it runs). */
  href: string;
};

type Need = "" | "size" | "colour" | "full" | "most";
const never = () => () => {};
type ApplePayWindow = { ApplePaySession?: { canMakePayments?: () => boolean } };
/** Whether this device can pay with Apple Pay (Safari with a card in Wallet): the express button shows only there. */
function useApplePayHere(on: boolean): boolean {
  return useSyncExternalStore(never, () => {
    if (!on) return false;
    try { return (window as unknown as ApplePayWindow).ApplePaySession?.canMakePayments?.() === true; } catch { return false; }
  }, () => false);
}

export default function ProductTop(props: TopProps) {
  const { p, locale, licence, today, related, settings, whens, showroom, policy, whatsapp, tabby, applePay, href } = props;
  const t = useLocalize(T);
  const w = useLocalize(W);
  const rtl = isRtl(locale);
  const o = optionsOf(p);
  const bike = p.category === "bikes";
  const firstColour = o.colours.find((c) => optionOpen(p, "colour", c.key, null))?.key ?? o.colours[0]?.key ?? null;
  const [size, setSize] = useState<string | null>(o.sizes.length === 1 ? o.sizes[0] : null);
  const [colour, setColour] = useState<string | null>(o.colours.length ? firstColour : null);
  const [qty, setQty] = useState(1);
  const [need, setNeed] = useState<Need>("");
  const [added, setAdded] = useState(false);
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [way, setWay] = useState<Fulfil | null>(null);
  const [height, setHeight] = useState("");
  const [guide, setGuide] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [ask, setAsk] = useState<StoreVariant | null>(null);
  const sizeGroup = useRef<HTMLDivElement>(null);
  const addedTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(addedTimer.current), []);
  const cart = useCart();
  const ready = useHydrated();
  const saved = useSaved().includes(p.slug);
  const appleHere = useApplePayHere(applePay);

  // what is picked, and what it costs
  const v = pickVariant(p, size, colour);
  const { lo, hi } = priceRange(p);
  const unit = v ? variantPrice(p, v) : lo === hi ? lo : null;
  const priceText = unit !== null ? sar(unit) : t.from(sar(lo));
  const was = v?.price ? null : wasPrice(p, licence, today);
  const stock = v ? stockState(v.stock) : productStock(p);
  const inCart = v ? cart.find((l) => l.variant === v.id.toLowerCase())?.qty ?? 0 : 0;
  const room = Math.min(MAX_QTY, v?.stock ?? MAX_QTY) - inCart;
  const max = Math.max(1, room);
  const n = Math.min(qty, max);
  const name = pick(locale, p.name_en, p.name_ar);
  const tagline = pick(locale, p.tagline_en, p.tagline_ar);
  const canAdd = !(v && v.stock <= 0) && stock.kind !== "out";

  // the Extras step (bikes only, F60): ticked rows, each with the choice staff's first in-stock variant until changed
  const extras = bike ? extrasOf(related) : [];
  const picks: Record<string, string | null> = {};
  for (const x of extras) picks[x.id] = ticks[x.id] ? choice[x.id] ?? extraChoices(x)[0]?.id ?? null : null;
  const withX = ticked(extras, picks);

  // the delivery rows, the way picked and the total at the price of what is picked (X06, F25)
  const kept = way ?? (ready ? keptWay(savedFulfil()) : null);
  const est = estimate(settings, { unit, lo, qty: n, extras: withX.map((x) => x.price), shipKsa: p.ship_ksa && withX.every((x) => x.product.ship_ksa), picked: kept });
  const pickWay = (id: Fulfil) => { setWay(id); saveFulfil(id); };

  const fit = (() => { const cm = heightCm(height); return cm === null ? null : sizeForHeight(p, cm); })();
  const photos = photosFor(p, colour);
  const colourName = (key: string | null | undefined) => { const c = o.colours.find((x) => x.key === key); return c ? pick(locale, c.en, c.ar) : ""; };

  function pickSize(s: string) {
    setSize(s); setNeed(""); setAdded(false);
    if (colour && !optionOpen(p, "size", s, colour)) setColour(o.colours.find((c) => optionOpen(p, "size", s, c.key))?.key ?? colour);
  }
  function pickColour(c: string) {
    setColour(c); setNeed(""); setAdded(false);
    if (size && !optionOpen(p, "colour", c, size)) setSize(null);
  }
  function soldOut(dim: "size" | "colour" | null, value: string | null) {
    setAsk(soldOutTarget(p, dim, value, dim === "size" ? colour : dim === "colour" ? size : null, v));
  }
  /** The choice made, or what is missing said where it is missing; the variant when it can be bought. */
  function chosen(): StoreVariant | null {
    if (o.sizes.length && !size) { setNeed("size"); sizeGroup.current?.querySelector<HTMLButtonElement>("button:not(.st-out)")?.focus(); return null; }
    if (o.colours.length && !colour) { setNeed("colour"); return null; }
    if (!v || v.stock <= 0) return null;
    return v;
  }
  function add() {
    const got0 = chosen();
    if (!got0) return;
    if (room <= 0) { setNeed("most"); return; }
    const got = cartAdd(got0.id, n);
    if (got === null) { setNeed("full"); return; }
    if (got <= 0) { setNeed("most"); return; }
    // the extras ticked go in with it, one of each; a cart with no room left for one says so
    const full = withX.some((x) => cartAdd(x.variant, 1) === null);
    setNeed(full ? "full" : "");
    setAdded(true);
    window.clearTimeout(addedTimer.current);
    addedTimer.current = window.setTimeout(() => setAdded(false), ADDED_MS);
  }
  function buyNow() {
    const got = chosen();
    // checkout is its own page, drawn by the server: a plain visit (the page's language rides in its cookie)
    if (got) window.location.assign(buyNowWithHref(got.id, n, withX.map((x) => x.variant)));
  }

  const vl = v ? variantLabel(v, locale) : "";
  const ask0 = vl ? `${name} (${vl})` : name;
  const askHref = waHref(whatsapp, w.askMsg(ask0, ready ? window.location.href.split("#")[0] : href));
  const keys = p.key_specs;

  return (
    <article className={`st-pdp st-top${bike ? " is-bike" : ""}`}>
      <ProductGallery key={colour ?? ""} p={p} photos={photos} locale={locale} name={name} />

      <div className="st-pdp-info">
        {p.brand && <p className="st-brand"><Bidi text={p.brand} rtl={rtl} /></p>}
        <div className="st-pdp-name">
          <h1><Bidi text={name} rtl={rtl} /></h1>
          <button type="button" className="st-save" aria-pressed={saved} aria-label={w.save} title={saved ? w.saved : w.save} onClick={() => savedToggle(p.slug)}>
            <StIcon name="heart" filled={saved} size={22} />
          </button>
        </div>
        {tagline && <p className="st-tagline"><Bidi text={tagline} rtl={rtl} /></p>}
        <p className="st-price">
          <Amt>{priceText}</Amt>
          {was !== null && <s className="st-was"><Amt>{sar(was)}</Amt></s>}
        </p>
        <p className="st-vat">{t.vatIncl}{was !== null && licence ? ` · ${t.licence(licence)}` : ""}</p>
        {tabby && (
          <p className="st-tabby">
            <span>{w.tabby(sar(tabbyPart(unit ?? lo)))}</span>
            {/* Tabby's own mark, as Tabby draws it (owner: payment marks keep their original artwork) */}
            <img src="/site/payments/tabby.svg" alt="tabby" width={52} height={20} />
          </p>
        )}
        {keys.length > 0 && (
          <ul className="st-keys" aria-label={w.keySpecs}>
            {keys.map((k, i) => (
              <li key={i}><StIcon name={specIcon(k.icon)} size={20} /><span><Bidi text={pick(locale, k.en, k.ar)} rtl={rtl} /></span></li>
            ))}
          </ul>
        )}
        <PdpPickers p={p} locale={locale} rtl={rtl} numbered={bike} size={size} colour={colour} fit={fit} need={need} sizeGroup={sizeGroup}
          onSize={pickSize} onColour={pickColour} onSoldOut={soldOut} onGuide={() => setGuide(true)} colourName={colourName}
          extras={extras} ticks={ticks} choice={choice}
          onTick={(id, on) => { setTicks((x) => ({ ...x, [id]: on })); setAdded(false); }}
          onChoice={(id, vid) => { setChoice((x) => ({ ...x, [id]: vid })); setTicks((x) => ({ ...x, [id]: true })); setAdded(false); }} />
      </div>

      <div className="st-pdp-buy">
        <BuyBox locale={locale} rtl={rtl} bike={bike} name={name} v={v} priceText={priceText} unit={unit} qty={n} max={max} stock={stock}
          extras={withX} est={est} whens={whens} canAdd={canAdd} added={added} need={need} applePay={appleHere} askHref={askHref}
          onQty={(q) => { setQty(q); setAdded(false); }} onAdd={add} onBuy={buyNow} onNotify={() => soldOut(null, null)} />
        <DeliveryInfo bike={bike} est={est} onWay={pickWay} whens={whens} freeOver={settings.delivery.freeOver} showroom={showroom}
          onPolicy={() => setPolicyOpen(true)} warranty={warrantyMonths(p)} />
      </div>

      {guide && (
        <SizeGuide p={p} size={size} height={height} onHeight={setHeight}
          onChoose={(s) => { pickSize(s); setGuide(false); }} onClose={() => setGuide(false)} />
      )}
      {/* drawn here, outside the sticky buy column, so nothing on the page paints over it (DeliveryInfo) */}
      {policyOpen && <ReturnsPop policy={policy} onClose={() => setPolicyOpen(false)} />}
      {ask && <StockAsk variant={ask} label={requestLabel(ask) ? variantLabel(ask, locale) : ""} locale={locale} onClose={() => setAsk(null)} />}
    </article>
  );
}
