"use client";

import { useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useLocalize } from "@/i18n/TxProvider";
import { sized } from "@/lib/img";
import { optionOpen, optionsOf, pick, pickVariant, priceRange, productStock, sar, stockState, variantLabel, variantPrice, type StoreProduct } from "@/lib/store-core";
import { MAX_QTY } from "@/lib/cart";
import { T } from "./Store.text";
import { Amt, Ic } from "./bits";
import Modal from "./Modal";
import { cartAdd, useCart } from "./useCart";

// The product page's choices: size and colour (a choice nobody can have is shown but cannot be picked),
// the price of what is picked with VAT, how many are left, the quantity and Add to cart. A pick that is
// missing is said where it is missing. Added, a centred pop-up says so and offers the cart. No bar fixed to the
// bottom of the screen (the owner took them out of the booking app).
// A size or a colour in stock only with another pick is open too, drawn lighter: a size picked that way brings the
// first colour it comes in; a colour picked that way clears the size, for the customer to choose again (a size is
// never changed for them). The quantity goes up to what the cart can still take of it: the stock, 10 a line.
export default function BuyBox({ p, locale, licence }: { p: StoreProduct; locale: string; licence: string | null }) {
  const t = useLocalize(T);
  const o = optionsOf(p);
  const firstColour = o.colours.find((c) => optionOpen(p, "colour", c.key, null))?.key ?? o.colours[0]?.key ?? null;
  const [size, setSize] = useState<string | null>(o.sizes.length === 1 ? o.sizes[0] : null);
  const [colour, setColour] = useState<string | null>(o.colours.length ? firstColour : null);
  const [qty, setQty] = useState(1);
  const [need, setNeed] = useState<"" | "size" | "colour" | "full" | "most">("");
  const [added, setAdded] = useState<{ qty: number; label: string } | null>(null);
  const sizeGroup = useRef<HTMLDivElement>(null);
  const cart = useCart();

  const v = pickVariant(p, size, colour);
  const { lo, hi } = priceRange(p);
  const price = v ? sar(variantPrice(p, v)) : lo !== hi ? t.from(sar(lo)) : sar(lo);
  const stock = v ? stockState(v.stock) : productStock(p);
  const inCart = v ? cart.find((l) => l.variant === v.id.toLowerCase())?.qty ?? 0 : 0;
  const room = Math.min(MAX_QTY, v?.stock ?? MAX_QTY) - inCart;
  const max = Math.max(1, room);
  const n = Math.min(qty, max);
  const name = pick(locale, p.name_en, p.name_ar);
  const colourName = (key: string | null | undefined) => { const c = o.colours.find((x) => x.key === key); return c ? pick(locale, c.en, c.ar) : ""; };

  function pickSize(s: string) {
    setSize(s); setNeed("");
    if (colour && !optionOpen(p, "size", s, colour)) setColour(o.colours.find((c) => optionOpen(p, "size", s, c.key))?.key ?? colour);
  }
  function pickColour(c: string) {
    setColour(c); setNeed("");
    if (size && !optionOpen(p, "colour", c, size)) setSize(null);
  }
  function add() {
    if (o.sizes.length && !size) { setNeed("size"); sizeGroup.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus(); return; }
    if (o.colours.length && !colour) { setNeed("colour"); return; }
    if (!v || v.stock <= 0) return;
    if (room <= 0) { setNeed("most"); return; }
    const got = cartAdd(v.id, n);
    if (got === null) { setNeed("full"); return; }
    if (got <= 0) { setNeed("most"); return; }
    setNeed("");
    setAdded({ qty: got, label: variantLabel(v, locale) });
  }
  const canAdd = !(v && v.stock <= 0) && stock.kind !== "out";

  return (
    <div className="st-buy">
      <p className="st-price">
        <Amt>{price}</Amt>
        {licence && p.compare_at && !v?.price && <s className="st-was"><Amt>{sar(p.compare_at)}</Amt></s>}
      </p>
      <p className="st-vat">{t.vatIncl}{licence && p.compare_at ? ` · ${t.licence(licence)}` : ""}</p>

      {o.sizes.length > 0 && (
        <div className="st-opt">
          <p className="st-opt-k" id="st-size-k">{t.size}{size ? <b>: {size}</b> : null}</p>
          <div className="st-sizes" role="group" aria-labelledby="st-size-k" ref={sizeGroup}>
            {o.sizes.map((s) => {
              const open = optionOpen(p, "size", s, null), here = optionOpen(p, "size", s, colour);
              // in stock only in another colour: said with the colour a tap brings
              const other = open && !here && colour ? colourName(o.colours.find((c) => optionOpen(p, "size", s, c.key))?.key) : "";
              return (
                <button key={s} type="button" aria-pressed={size === s} disabled={!open} className={open && !here ? "st-elsewhere" : undefined} onClick={() => pickSize(s)}
                  aria-label={!open ? `${s}, ${t.soldOut}` : other ? `${s}, ${other}` : s}>{s}</button>
              );
            })}
          </div>
          {need === "size" && <p className="st-need" role="alert">{t.pickSize}</p>}
        </div>
      )}
      {o.colours.length > 0 && (
        <div className="st-opt">
          <p className="st-opt-k" id="st-colour-k">{t.colour}{colour ? <b>: {pick(locale, o.colours.find((c) => c.key === colour)?.en, o.colours.find((c) => c.key === colour)?.ar)}</b> : null}</p>
          <div className="st-swatches" role="group" aria-labelledby="st-colour-k">
            {o.colours.map((c) => {
              const open = optionOpen(p, "colour", c.key, null), here = optionOpen(p, "colour", c.key, size);
              const label = pick(locale, c.en, c.ar);
              return (
                <button key={c.key} type="button" aria-pressed={colour === c.key} disabled={!open} className={open && !here ? "st-elsewhere" : undefined} title={label} onClick={() => pickColour(c.key)}
                  aria-label={open ? label : `${label}, ${t.soldOut}`}>
                  <span className="st-sw" style={c.hex ? { background: c.hex } : undefined} aria-hidden="true" />
                </button>
              );
            })}
          </div>
          {need === "colour" && <p className="st-need" role="alert">{t.pickColour}</p>}
        </div>
      )}

      <p className={`st-stock ${stock.kind}`}>{stock.kind === "out" ? t.soldOut : stock.kind === "low" ? t.left(stock.left) : t.inStock}</p>

      <div className="st-cta">
        {canAdd && (
          <div className="st-qty" role="group" aria-label={t.qty}>
            <button type="button" onClick={() => setQty(Math.max(1, n - 1))} disabled={n <= 1} aria-label={t.less}><Ic name="minus" size={16} /></button>
            <output aria-live="polite">{n}</output>
            <button type="button" onClick={() => setQty(Math.min(max, n + 1))} disabled={n >= max} aria-label={t.more}><Ic name="plus" size={16} /></button>
          </div>
        )}
        <button type="button" className="bk-btn grow" onClick={add} disabled={!canAdd}>
          <Ic name="bag" size={18} />{canAdd ? t.add : t.soldOut}
        </button>
      </div>
      {need === "full" && <p className="st-need" role="alert">{t.cartFull}</p>}
      {need === "most" && <p className="st-need" role="alert">{t.cartHasMost}</p>}

      {added && (
        <Modal title={t.added} onClose={() => setAdded(null)} closeLabel={t.close}>
          <div className="st-added">
            <span className="st-added-img">{p.images[0] ? <img src={sized(p.images[0], 640)} alt="" /> : <Ic name="bag" size={26} />}</span>
            <span>
              <b>{name}</b>
              <small>{[added.label, t.qtyN(added.qty)].filter(Boolean).join(" · ")}</small>
            </span>
          </div>
          <div className="bk-pop-foot">
            <button type="button" className="bk-btn2" onClick={() => setAdded(null)}>{t.keepShopping}</button>
            <Link href="/store/cart" className="bk-btn">{t.viewCart}</Link>
          </div>
        </Modal>
      )}
    </div>
  );
}
