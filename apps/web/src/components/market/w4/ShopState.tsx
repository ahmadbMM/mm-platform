import type { ReactNode } from "react";
import type { MkShopMine } from "@/lib/market/core";
import { w4StatusClass } from "@/lib/market/w4";
import MkIcon from "../MkIcon";
import type { W4Words } from "../w4.text";

// The state of a shop's application, as its owner reads it: one mark, one word on a chip and one sentence - waiting,
// open, not approved or paused - and, when staff wrote one, the reason. Staff's note is shown as written, in its own
// direction. The buttons that fit the state are the page's (`children`).
//   title   another heading in place of the state's sentence ("Application sent", right after sending); the sentence
//           then reads under it
const ICON = { pending: "clock", approved: "tick", rejected: "alert", suspended: "block" } as const;

export default function ShopState({ shop, w, title, children }: { shop: MkShopMine; w: W4Words; title?: string; children?: ReactNode }) {
  const s = shop.status;
  const note = (s === "rejected" || s === "suspended") && shop.decision_note ? shop.decision_note : null;
  return (
    <section className={`mk-box mk-w4-state mk-w4-state-${s}`} data-mk-shop-state={s}>
      <div className="mk-w4-state-top">
        <span className="mk-w4-state-ic"><MkIcon name={ICON[s]} size={22} /></span>
        <div className="mk-w4-state-words">
          <span className={`mk-status mk-status-${w4StatusClass(s)}`}>{w.chip[s]}</span>
          <h2>{title ?? w.state[s]}</h2>
          {title && <p>{w.state[s]}</p>}
        </div>
      </div>
      {note && (
        <div className="mk-w4-reason">
          <span>{w.reason}</span>
          <p className="mk-user" dir="auto">{note}</p>
        </div>
      )}
      {children && <div className="mk-w4-acts">{children}</div>}
    </section>
  );
}
