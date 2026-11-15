"use client";

import type { RefObject } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { sized } from "@/lib/img";
import { colourPhoto, optionOpen, optionsOf, pick, sar, variantLabel, variantPrice, type StoreProduct } from "@/lib/store-core";
import { extraChoices, guideOf, sizeHeight } from "@/lib/store-pdp";
import { T } from "./Store.text";
import { T as W } from "./w3a.text";
import { Amt, NoPhoto } from "./bits";
import { StIcon } from "./icons";
import { Bidi, cmWords } from "./pdp-bits";

// The product's choices (D11-C, F19-F23, D15-B, F60). A bike's are numbered steps - 1 Size, 2 Colour, 3 Extras - and
// the rest's the plain pickers, the same buttons either way.
//   Sizes: two lines when staff gave the rider height, "M" over "165-174 cm" (F20); a size sold out is struck through
//   and a tap asks to be told when it is back (F34); one in stock only in another colour is dashed (F19); the one the
//   size guide's height fits has a green ring (F22). "Size guide" beside the label opens the guide (F21).
//   Colours: a chip with the colour's own photo when staff tagged one (D15-B), else the colour's dot; the name in the
//   label, "Colour: Black" (F23).
//   Extras: the products staff put under Goes with, each a row to tick with its photo and price, and its own choice
//   when it comes in several; ticked, it goes into the cart with the bike and into the total.
export default function PdpPickers(props: {
  p: StoreProduct; locale: string; rtl: boolean; numbered: boolean; size: string | null; colour: string | null; fit: string | null;
  need: string; sizeGroup: RefObject<HTMLDivElement | null>;
  onSize: (s: string) => void; onColour: (c: string) => void; onSoldOut: (dim: "size" | "colour", value: string) => void; onGuide: () => void;
  colourName: (key: string | null | undefined) => string;
  extras: StoreProduct[]; ticks: Record<string, boolean>; choice: Record<string, string>;
  onTick: (id: string, on: boolean) => void; onChoice: (id: string, variant: string) => void;
}) {
  const { p, locale, rtl, numbered, size, colour, fit, need, sizeGroup, onSize, onColour, onSoldOut, onGuide, colourName, extras, ticks, choice, onTick, onChoice } = props;
  const t = useLocalize(T);
  const w = useLocalize(W);
  const o = optionsOf(p);
  const guide = guideOf(p);
  let step = 0;
  const num = () => (numbered ? <span className="st-step-n" aria-hidden="true">{++step}</span> : null);

  return (
    <div className={`st-picks${numbered ? " st-steps-on" : ""}`}>
      {o.sizes.length > 0 && (
        <div className="st-opt">
          <div className="st-opt-head">
            <p className="st-opt-k" id="st-size-k">{num()}<span>{t.size}{size ? <b>: {size}</b> : null}</span></p>
            {guide && <button type="button" className="st-guide-btn" aria-haspopup="dialog" onClick={onGuide}><StIcon name="ruler" size={18} />{w.sizeGuide}</button>}
          </div>
          <div className="st-sizes" role="group" aria-labelledby="st-size-k" ref={sizeGroup}>
            {o.sizes.map((s) => {
              const open = optionOpen(p, "size", s, null), here = optionOpen(p, "size", s, colour);
              // in stock only in another colour: said with the colour a tap brings
              const other = open && !here && colour ? colourName(o.colours.find((c) => optionOpen(p, "size", s, c.key))?.key) : "";
              const h = cmWords(w, sizeHeight(p, s));
              const cls = [!open ? "st-out" : !here ? "st-elsewhere" : "", fit === s ? "st-fit" : "", h ? "st-two" : ""].filter(Boolean).join(" ");
              return (
                <button key={s} type="button" aria-pressed={open ? size === s : undefined} className={cls || undefined}
                  aria-haspopup={open ? undefined : "dialog"} onClick={() => (open ? onSize(s) : onSoldOut("size", s))}
                  aria-label={[s, h, !open ? t.soldOut : other].filter(Boolean).join(", ")}>
                  <b>{s}</b>{h && <small>{h}</small>}
                </button>
              );
            })}
          </div>
          {need === "size" && <p className="st-need" role="alert">{t.pickSize}</p>}
        </div>
      )}
      {o.colours.length > 0 && (
        <div className="st-opt">
          <p className="st-opt-k" id="st-colour-k">{num()}<span>{t.colour}{colour ? <b>: <Bidi text={colourName(colour)} rtl={rtl} /></b> : null}</span></p>
          <div className="st-swatches" role="group" aria-labelledby="st-colour-k">
            {o.colours.map((c) => {
              const open = optionOpen(p, "colour", c.key, null), here = optionOpen(p, "colour", c.key, size);
              const label = pick(locale, c.en, c.ar);
              const photo = colourPhoto(p, c.key);
              const cls = [!open ? "st-out" : !here ? "st-elsewhere" : "", photo ? "st-chip" : ""].filter(Boolean).join(" ");
              return (
                <button key={c.key} type="button" aria-pressed={open ? colour === c.key : undefined} className={cls || undefined} title={label}
                  aria-haspopup={open ? undefined : "dialog"} onClick={() => (open ? onColour(c.key) : onSoldOut("colour", c.key))}
                  aria-label={open ? label : `${label}, ${t.soldOut}`}>
                  {photo
                    ? <img src={sized(photo, 640)} alt="" loading="lazy" decoding="async" />
                    : <span className="st-sw" style={c.hex ? { background: c.hex } : undefined} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          {need === "colour" && <p className="st-need" role="alert">{t.pickColour}</p>}
        </div>
      )}
      {extras.length > 0 && (
        <div className="st-opt">
          <p className="st-opt-k" id="st-extra-k">{num()}{w.extras}</p>
          <ul className="st-extras" aria-labelledby="st-extra-k">
            {extras.map((x) => {
              const ch = extraChoices(x);
              const cv = ch.find((c) => c.id === choice[x.id]) ?? ch[0];
              const nm = pick(locale, x.name_en, x.name_ar);
              const on = !!ticks[x.id];
              const id = `st-x-${x.id}`;
              return (
                <li key={x.id} className={on ? "on" : undefined}>
                  <input id={id} type="checkbox" checked={on} onChange={(e) => onTick(x.id, e.target.checked)} />
                  <label htmlFor={id}>
                    <span className="st-extra-img">{x.images[0] ? <img src={sized(x.images[0], 640)} alt="" loading="lazy" decoding="async" /> : <NoPhoto />}</span>
                    <span className="st-extra-name"><Bidi text={nm} rtl={rtl} /></span>
                    {cv && <Amt>{sar(variantPrice(x, cv))}</Amt>}
                  </label>
                  {ch.length > 1 && cv && (
                    <select aria-label={w.choiceFor(nm)} value={cv.id} onChange={(e) => onChoice(x.id, e.target.value)}>
                      {ch.map((c) => <option key={c.id} value={c.id}>{variantLabel(c, locale)}</option>)}
                    </select>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
