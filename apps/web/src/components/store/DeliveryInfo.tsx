"use client";

import { useLocalize } from "@/i18n/TxProvider";
import { paragraphs, sar } from "@/lib/store-core";
import type { Fulfil } from "@/lib/store-delivery";
import { POLICY, warrantyParts } from "@/lib/store-policy";
import type { Estimate } from "@/lib/store-pdp";
import { T } from "./Store.text";
import { T as W, warrantyWords } from "./w3a.text";
import { Amt, Ic } from "./bits";
import { StIcon } from "./icons";
import Modal from "./Modal";

// The product page's delivery and returns box (D16-A, F26-F28, X06, X07, L07, L09): one row for each way to have it,
// with its fee at the price of what is picked (a dearer size can reach free delivery, X06) and the day it is expected
// on; the way picked feeds the buy box's total and is the cart's too. A bike's ways say who builds it, "Collect fully
// built" with a spanner and "Delivered ready to ride in Jeddah" (F27); pickup says the day it is ready (F28). Then the
// store's one return sentence word for word (L07) with "Returns policy", always there and opening the full policy in a
// centred pop-up whatever the Help page's switch says (X07), and the warranty with a drawn shield (L09): 2 years new,
// 1 year certified pre-owned, or staff's longer term.
//   The pop-up itself is ReturnsPop, drawn by ProductTop beside the size guide: this box sits in the buy column, which
// stays in view on a desktop (position: sticky), and a sticky column paints everything inside it at its own level, so a
// pop-up drawn in here was covered by the site's header (its close button under it).
const LOOK: Record<Fulfil, "shop" | "truck"> = { pickup: "shop", jeddah: "truck", ksa: "truck" };

export default function DeliveryInfo({ bike, est, onWay, whens, freeOver, showroom, onPolicy, warranty }: {
  bike: boolean; est: Estimate; onWay: (id: Fulfil) => void; whens: Record<string, string | null>; freeOver: number | null; showroom: string;
  onPolicy: () => void; warranty: number;
}) {
  const t = useLocalize(T);
  const w = useLocalize(W);
  const pol = useLocalize(POLICY);
  const label = (id: Fulfil) => (id === "pickup" ? (bike ? w.pickupBuilt : t.pickup) : id === "jeddah" ? (bike ? w.jeddahBuilt : t.jeddah) : t.ksa);
  const sub = (id: Fulfil) => { const d = whens[id]; return id === "pickup" ? (d ? w.ready(d) : showroom) : d ? t.arrives(d) : ""; };
  const pickable = est.options.length > 1;
  const wy = warrantyParts(warranty);
  const row = (id: Fulfil, fee: number) => (
    <>
      {bike && id === "pickup" ? <StIcon name="spanner" size={20} /> : <Ic name={LOOK[id]} size={20} />}
      <span><b>{label(id)}</b>{sub(id) && <small>{sub(id)}</small>}</span>
      <em>{fee === 0 ? t.free : <Amt>{sar(fee)}</Amt>}</em>
    </>
  );
  return (
    <section className="st-info" aria-labelledby="st-deliv-h">
      <h2 id="st-deliv-h" className="st-info-h">{t.delivery}</h2>
      {pickable ? (
        <div className="st-ways st-ways-on" role="radiogroup" aria-labelledby="st-deliv-h">
          {est.options.map((o) => (
            <label key={o.id} className={est.way?.id === o.id ? "on" : undefined}>
              <input type="radio" name="st-pdp-way" value={o.id} checked={est.way?.id === o.id} onChange={() => onWay(o.id)} />
              {row(o.id, o.fee)}
            </label>
          ))}
        </div>
      ) : (
        <ul className="st-ways">
          {est.options.map((o) => <li key={o.id}>{row(o.id, o.fee)}</li>)}
        </ul>
      )}
      {freeOver !== null && <p className="st-info-note">{t.freeOver(sar(freeOver))}</p>}
      <h2 className="st-info-h st-info-h2"><Ic name="back" size={18} />{t.returnsH}</h2>
      <p className="st-info-note">{pol.returnSentence}{" "}
        <button type="button" className="st-linkbtn" aria-haspopup="dialog" onClick={onPolicy}>{t.returnsLink}</button>
      </p>
      <p className="st-warranty"><StIcon name="shield" size={20} /><b>{w.warranty}</b><em>{warrantyWords(w, wy.years, wy.months)}</em></p>
    </section>
  );
}

/** The returns policy (X07): the one sentence, then the Help page's Returns answers as staff keep them (each answer's
 *  paragraphs as they wrote them), in a centred pop-up. */
export function ReturnsPop({ policy, onClose }: { policy: { q: string; a: string }[]; onClose: () => void }) {
  const t = useLocalize(T);
  const pol = useLocalize(POLICY);
  return (
    <Modal title={t.returnsLink} onClose={onClose} closeLabel={t.close}>
      <div className="st-policy">
        <p className="st-policy-lead">{pol.returnSentence}</p>
        {policy.map((x, i) => (
          <div key={i}>
            <h3>{x.q}</h3>
            {paragraphs(x.a).map((para, j) => <p key={j}>{para}</p>)}
          </div>
        ))}
      </div>
    </Modal>
  );
}
