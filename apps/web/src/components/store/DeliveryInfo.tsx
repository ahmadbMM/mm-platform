"use client";

import { useLocalize } from "@/i18n/TxProvider";
import { paragraphs } from "@/lib/store-core";
import { POLICY, warrantyParts } from "@/lib/store-policy";
import { T } from "./Store.text";
import { T as W, warrantyWords } from "./w3a.text";
import { Ic } from "./bits";
import { StIcon } from "./icons";
import Modal from "./Modal";

// The product page's returns box (D16-A, X07, L07, L09). The ways to have it moved into the buy box, above Add, in the
// "do all" build of 2026-11-18 (P21, SM05-B: components/store/sx-B2-ways.tsx, with the rows this box drew: fees at the
// price of what is picked, X06; F26-F28). Here: the store's one return sentence word for word (L07) with "Returns policy", always there and opening the full policy in a
// centred pop-up whatever the Help page's switch says (X07), and the warranty with a drawn shield (L09): 2 years new,
// 1 year certified pre-owned, or staff's longer term.
//   The pop-up itself is ReturnsPop, drawn by ProductTop beside the size guide: this box sits in the buy column, which
// stays in view on a desktop (position: sticky), and a sticky column paints everything inside it at its own level, so a
// pop-up drawn in here was covered by the site's header (its close button under it).
export default function DeliveryInfo({ onPolicy, warranty }: { onPolicy: () => void; warranty: number }) {
  const t = useLocalize(T);
  const w = useLocalize(W);
  const pol = useLocalize(POLICY);
  const wy = warrantyParts(warranty);
  return (
    <section className="st-info" aria-labelledby="st-ret-h">
      <h2 id="st-ret-h" className="st-info-h"><Ic name="back" size={18} />{t.returnsH}</h2>
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
