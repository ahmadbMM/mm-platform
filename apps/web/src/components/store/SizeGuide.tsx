"use client";

import { useLocalize } from "@/i18n/TxProvider";
import { optionOpen, sizeForHeight, type StoreProduct } from "@/lib/store-core";
import { cmText, guideOf, heightCm, type GuideCol } from "@/lib/store-pdp";
import { T } from "./Store.text";
import { T as W } from "./w3a.text";
import Modal from "./Modal";
import { cmWords } from "./pdp-bits";

// The size guide (F21, F22): a centred pop-up with the product's own table, the rider height beside each size for a
// bike, the chest and the waist for a jersey, the row of the size picked tinted. A bike's guide asks the rider's height:
// the size it fits is tinted instead, its button on the page gets a green ring, and Choose M picks it (while it is in
// stock: a sold-out size is asked for from its own button).
export default function SizeGuide({ p, size, height, onHeight, onChoose, onClose }: {
  p: StoreProduct; size: string | null; height: string; onHeight: (raw: string) => void; onChoose: (size: string) => void; onClose: () => void;
}) {
  const t = useLocalize(T);
  const w = useLocalize(W);
  const g = guideOf(p);
  if (!g) return null;
  const cm = heightCm(height);
  const fit = cm === null ? null : sizeForHeight(p, cm);
  const mark = fit ?? size;
  const label: Record<GuideCol, string> = { height: w.riderHeight, chest: w.chest, waist: w.waist };
  // a bike's table reads height then size, as a rider looks it up; a jersey's size then its measures
  const heightFirst = g.cols.length === 1 && g.cols[0] === "height";
  const sizeCell = (s: string) => <th scope="row">{s}</th>;
  return (
    <Modal title={w.sizeGuide} onClose={onClose} closeLabel={t.close}>
      {g.cols.includes("height") && (
        <div className="bk-field st-field st-guide-cm">
          <label htmlFor="st-guide-cm">{w.yourHeight}</label>
          <input id="st-guide-cm" type="text" inputMode="numeric" dir="ltr" maxLength={3} autoComplete="off" value={height}
            onChange={(e) => onHeight(e.target.value)} aria-describedby={height && cm !== null && !fit ? "st-guide-no" : undefined} />
          {height && cm !== null && !fit && <p id="st-guide-no" className="bk-ferr">{w.noFit}</p>}
        </div>
      )}
      <table className="st-guide">
        <thead>
          <tr>
            {!heightFirst && <th scope="col">{t.size}</th>}
            {g.cols.map((c) => <th key={c} scope="col">{label[c]}</th>)}
            {heightFirst && <th scope="col">{t.size}</th>}
          </tr>
        </thead>
        <tbody>
          {g.rows.map((r) => (
            <tr key={r.size} className={r.size === mark ? "on" : undefined} aria-current={r.size === mark ? "true" : undefined}>
              {!heightFirst && sizeCell(r.size)}
              {g.cols.map((c) => <td key={c}>{cmWords(w, cmText(r[c])) || "–"}</td>)}
              {heightFirst && sizeCell(r.size)}
            </tr>
          ))}
        </tbody>
      </table>
      {fit && optionOpen(p, "size", fit, null) && (
        <div className="bk-pop-foot st-guide-foot">
          <button type="button" className="bk-btn" onClick={() => onChoose(fit)}>{w.chooseSize(fit)}</button>
        </div>
      )}
    </Modal>
  );
}
