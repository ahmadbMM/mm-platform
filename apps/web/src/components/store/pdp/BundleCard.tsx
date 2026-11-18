"use client";

import { useState } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { sized } from "@/lib/img";
import { linePhoto, pick, priceRange, sar, variantPrice, type StoreProduct, type StoreVariant } from "@/lib/store-core";
import { cartRoom, choiceKind, choicesOf } from "@/lib/store-sections";
import { T as StoreT } from "../Store.text";
import { T } from "../w3b.text";
import { Amt, Ic, NoPhoto } from "../bits";
import { cartAdd, useCart } from "../useCart";
import { useFlash } from "./useFlash";

// The starter set (F31): this product with the one to three staff bundled with it, at one price, shown only beside a
// discount licence (the page asks bundleOf, which also wants every one of them in stock). One card: the photos
// overlapping, the names, the set's price with what they cost one by one struck through (at the sizes and colours
// picked), the saving and the licence number. A size or colour is picked here for each one that comes in several;
// "Add the set" puts one of each in the cart, where checkout takes the difference off (the database works it out again).
export default function BundleCard({ products, price, licence, locale }: { products: StoreProduct[]; price: number; licence: string; locale: string }) {
  const t = useLocalize(StoreT), w = useLocalize(T);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [need, setNeed] = useState<"" | "pick" | "full" | "most">("");
  const [added, flash] = useFlash();
  const cart = useCart();
  const variantOf = (p: StoreProduct): StoreVariant | null => (choiceKind(p) ? p.variants.find((v) => v.id === chosen[p.id]) ?? null : p.variants[0] ?? null);
  const picks = products.map((p) => ({ p, v: variantOf(p) }));
  const sum = Math.round(picks.reduce((n, { p, v }) => n + (v ? variantPrice(p, v) : priceRange(p).lo), 0) * 100) / 100;
  const save = Math.round((sum - price) * 100) / 100;
  const names = products.map((p) => pick(locale, p.name_en, p.name_ar));
  const askOf = (p: StoreProduct) => { const k = choiceKind(p); return k === "size" ? t.pickSize : k === "colour" ? t.pickColour : k === "both" ? w.pickBoth : w.pickOne; };
  const missing = picks.find((x) => !x.v)?.p ?? null;
  const lic = t.licence("\u0000").split("\u0000"); // the sentence around the number, which is kept whole and left to right

  function add() {
    if (picks.some((x) => !x.v)) { setNeed("pick"); return; }
    const vs = picks.map((x) => x.v as StoreVariant);
    const room = cartRoom(cart, vs, products);
    if (room !== "ok") { setNeed(room); return; }
    for (const v of vs) cartAdd(v.id, 1);
    setNeed("");
    flash();
  }

  return (
    <div className="st-pd-set">
      <div className="st-pd-set-imgs" aria-hidden="true">
        {picks.map(({ p, v }) => { const img = v ? linePhoto(p, v) : p.images[0]; return <span key={p.id}>{img ? <img src={sized(img, 640)} alt="" loading="lazy" decoding="async" /> : <NoPhoto />}</span>; })}
      </div>
      <div className="st-pd-set-body">
        <p className="st-pd-set-names">{names.map((n, i) => <span key={i}>{i > 0 && " + "}<bdi>{n}</bdi></span>)}</p>
        <p className="st-pd-set-price">
          <Amt>{sar(price)}</Amt>
          {save > 0 && <s className="st-was"><span aria-hidden="true"><Amt>{sar(sum)}</Amt></span><span className="st-pd-sr">{w.apart(sar(sum))}</span></s>}
          {save > 0 && <span className="st-pd-save">{w.save(sar(save))}</span>}
        </p>
        <p className="st-vat">{t.vatIncl} · {lic[0]}<bdi dir="ltr" className="st-pd-lic">{licence}</bdi>{lic[1]}</p>
        {picks.some(({ p }) => choiceKind(p)) && (
          <div className="st-pd-set-picks">
            {picks.map(({ p }, i) => {
              const kind = choiceKind(p);
              if (!kind) return null;
              const ask = askOf(p);
              return (
                <label key={p.id} className="st-pd-pick">
                  <span className="st-pd-pick-k"><bdi>{names[i]}</bdi></span>
                  <select value={chosen[p.id] ?? ""} aria-invalid={(need === "pick" && !chosen[p.id]) || undefined}
                    onChange={(e) => { setChosen({ ...chosen, [p.id]: e.target.value }); setNeed(""); }}>
                    <option value="">{ask}</option>
                    {choicesOf(p, locale).map((c) => <option key={c.id} value={c.id} disabled={!c.open}>{c.open ? c.label : `${c.label} · ${t.soldOut}`}</option>)}
                  </select>
                </label>
              );
            })}
          </div>
        )}
        <button type="button" className={`bk-btn st-pd-set-add${added ? " is-added" : ""}`} onClick={add}>
          <Ic name={added ? "tick" : "bag"} size={18} />{added ? w.setAdded : w.setAdd}
        </button>
        <span className="st-pd-sr" role="status">{added ? w.setAdded : ""}</span>
        {need === "pick" && missing && <p className="st-need" role="alert"><bdi>{names[products.indexOf(missing)]}</bdi>: {askOf(missing)}</p>}
        {need === "full" && <p className="st-need" role="alert">{t.cartFull}</p>}
        {need === "most" && <p className="st-need" role="alert">{t.cartHasMost}</p>}
      </div>
    </div>
  );
}
