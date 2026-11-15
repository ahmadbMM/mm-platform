"use client";

import { useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useLocalize } from "@/i18n/TxProvider";
import { sized, srcSet } from "@/lib/img";
import { linePhoto, photoAlt, pick, priceRange, productHref, sar, variantPrice, type StoreProduct } from "@/lib/store-core";
import { cartRoom, choiceKind, choicesOf } from "@/lib/store-sections";
import { T as StoreT } from "../Store.text";
import { T } from "../w3b.text";
import { Amt, Ic, NoPhoto } from "../bits";
import { cartAdd, useCart } from "../useCart";
import { useFlash } from "./useFlash";

// One add-on in "Complete your ride" (F30, D17-C): its photo and name (to its own page), its price, a choice of size or
// colour when it comes in several, and its own Add button, which turns into "Added" with a drawn tick (D14-E). A pick
// that is missing is said where it is missing, as on the buy box.
export default function AddonCard({ p, locale }: { p: StoreProduct; locale: string }) {
  const t = useLocalize(StoreT), w = useLocalize(T);
  const kind = choiceKind(p);
  const [chosen, setChosen] = useState("");
  const [need, setNeed] = useState<"" | "pick" | "full" | "most">("");
  const [added, flash] = useFlash();
  const select = useRef<HTMLSelectElement>(null);
  const cart = useCart();
  const v = kind ? p.variants.find((x) => x.id === chosen) ?? null : p.variants[0] ?? null;
  const { lo, hi } = priceRange(p);
  const price = v ? sar(variantPrice(p, v)) : lo !== hi ? t.from(sar(lo)) : sar(lo);
  const name = pick(locale, p.name_en, p.name_ar);
  const img = v ? linePhoto(p, v) : p.images[0]; // the colour picked shows its own photo
  const ask = kind === "size" ? t.pickSize : kind === "colour" ? t.pickColour : kind === "both" ? w.pickBoth : w.pickOne;
  const short = kind === "size" ? t.size : kind === "colour" ? t.colour : kind === "both" ? w.sizeAndColour : w.pickOne; // fits a phone's card

  function add() {
    if (!v) { setNeed("pick"); select.current?.focus(); return; }
    if (v.stock <= 0) return;
    const room = cartRoom(cart, [v]);
    if (room !== "ok") { setNeed(room); return; }
    const got = cartAdd(v.id, 1);
    if (got === null) { setNeed("full"); return; }
    if (got <= 0) { setNeed("most"); return; }
    setNeed("");
    flash();
  }

  return (
    <li className="st-pd-addon">
      <Link href={productHref(p)} className="st-pd-addon-link">
        <span className="st-pd-addon-img">
          {img ? <img src={sized(img, 640)} srcSet={srcSet(img)} sizes="(max-width: 600px) 50vw, 240px" alt={photoAlt(p, img, locale)} loading="lazy" decoding="async" /> : <NoPhoto />}
        </span>
        {p.brand && <span className="st-brand">{p.brand}</span>}
        <strong className="st-pd-addon-name"><bdi>{name}</bdi></strong>
      </Link>
      <p className="st-pd-addon-price"><Amt>{price}</Amt></p>
      {kind && (
        <label className="st-pd-pick">
          <span className="st-pd-sr">{short}</span>
          <select ref={select} value={chosen} aria-invalid={need === "pick" || undefined}
            onChange={(e) => { setChosen(e.target.value); setNeed(""); }}>
            <option value="">{short}</option>
            {choicesOf(p, locale).map((c) => <option key={c.id} value={c.id} disabled={!c.open}>{c.open ? c.label : `${c.label} · ${t.soldOut}`}</option>)}
          </select>
        </label>
      )}
      <button type="button" className={`bk-btn2 st-pd-add${added ? " is-added" : ""}`} onClick={add} aria-label={added ? w.addedOne : w.addThis(name)}>
        <Ic name={added ? "tick" : "plus"} size={18} />{added ? w.addedOne : w.addOne}
      </button>
      <span className="st-pd-sr" role="status">{added ? `${w.addedOne}: ${name}` : ""}</span>
      {need === "pick" && <p className="st-need" role="alert">{ask}</p>}
      {need === "full" && <p className="st-need" role="alert">{t.cartFull}</p>}
      {need === "most" && <p className="st-need" role="alert">{t.cartHasMost}</p>}
    </li>
  );
}
