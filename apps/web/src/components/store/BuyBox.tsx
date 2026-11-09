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
import { cartAdd } from "./useCart";

// The product page's choices: size and colour (a choice nobody can have is shown but cannot be picked),
// the price of what is picked with VAT, how many are left, the quantity and Add to cart. A pick that is
// missing is said where it is missing. Added, a centred pop-up says so and offers the cart. No bar fixed to the
// bottom of the screen (the owner took them out of the booking app).
export default function BuyBox({ p, locale, licence }: { p: StoreProduct; locale: string; licence: string | null }) {
  const t = useLocalize(T);
  const o = optionsOf(p);
  const firstColour = o.colours.find((c) => optionOpen(p, "colour", c.key, null))?.key ?? o.colours[0]?.key ?? null;
  const [size, setSize] = useState<string | null>(o.sizes.length === 1 ? o.sizes[0] : null);
  const [colour, setColour] = useState<string | null>(o.colours.length ? firstColour : null);
  const [qty, setQty] = useState(1);
  const [need, setNeed] = useState<"" | "size" | "colour" | "full">("");
  const [added, setAdded] = useState<{ qty: number; label: string } | null>(null);
  const sizeGroup = useRef<HTMLDivElement>(null);

  const v = pickVariant(p, size, colour);
  const { lo, hi } = priceRange(p);
  const price = v ? sar(variantPrice(p, v)) : lo !== hi ? t.from(sar(lo)) : sar(lo);
  const stock = v ? stockState(v.stock) : productStock(p);
  const max = Math.max(1, Math.min(MAX_QTY, v?.stock ?? MAX_QTY));
  const n = Math.min(qty, max);
  const name = pick(locale, p.name_en, p.name_ar);

  function add() {
    if (o.sizes.length && !size) { setNeed("size"); sizeGroup.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus(); return; }
    if (o.colours.length && !colour) { setNeed("colour"); return; }
    if (!v || v.stock <= 0) return;
    if (!cartAdd(v.id, n)) { setNeed("full"); return; }
    setNeed("");
    setAdded({ qty: n, label: variantLabel(v, locale) });
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
              const open = optionOpen(p, "size", s, colour);
              return (
                <button key={s} type="button" aria-pressed={size === s} disabled={!open} onClick={() => { setSize(s); setNeed(""); }}
                  aria-label={open ? s : `${s}, ${t.soldOut}`}>{s}</button>
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
              const open = optionOpen(p, "colour", c.key, size);
              const label = pick(locale, c.en, c.ar);
              return (
                <button key={c.key} type="button" aria-pressed={colour === c.key} disabled={!open} title={label} onClick={() => { setColour(c.key); setNeed(""); }}
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
