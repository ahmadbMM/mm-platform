"use client";

import type { ReactNode } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { sar } from "@/lib/store-core";
import type { Fulfil } from "@/lib/store-delivery";
import type { Estimate } from "@/lib/store-pdp";
import { T } from "./Store.text";
import { T as W } from "./w3a.text";
import { T as B } from "./sx-B2.text";
import { Amt, Ic } from "./bits";
import { StIcon } from "./icons";

// How to get it (P21, SM05-B; the "do all" build of 2026-11-18): the ways to have the product, picked BEFORE Add, at the
// top of the buy box on every screen (it was a box under Add on a phone). A bike's is the last numbered step. Each row
// says its fee at the price of what is picked and the day it is expected on, and, while staff's date makes it true,
// "Order by Thu 26 Mar for Eid delivery" inside the label (N36). The way picked feeds the total and is the cart's too.
// Under "Collect fully built" a bike offers its 20-minute handover (N13, `handover`).
const LOOK: Record<Fulfil, "shop" | "truck"> = { pickup: "shop", jeddah: "truck", ksa: "truck" };

export default function WayStep({ bike, step, est, onWay, whens, freeOver, showroom, orderBy, handover }: {
  bike: boolean; step: number | null; est: Estimate; onWay: (id: Fulfil) => void; whens: Record<string, string | null>;
  freeOver: number | null; showroom: string;
  /** Per way, the order-by line already worded (N36); absent when it is not true. */
  orderBy: Partial<Record<Fulfil, string>>;
  handover?: ReactNode;
}) {
  const t = useLocalize(T);
  const w = useLocalize(W);
  const b = useLocalize(B);
  if (!est.options.length) return null;
  const label = (id: Fulfil) => (id === "pickup" ? (bike ? w.pickupBuilt : t.pickup) : id === "jeddah" ? (bike ? w.jeddahBuilt : t.jeddah) : t.ksa);
  const sub = (id: Fulfil) => { const d = whens[id]; return id === "pickup" ? (d ? w.ready(d) : showroom) : d ? t.arrives(d) : ""; };
  const pickable = est.options.length > 1;
  const row = (id: Fulfil, fee: number) => (
    <>
      {bike && id === "pickup" ? <StIcon name="spanner" size={20} /> : <Ic name={LOOK[id]} size={20} />}
      <span>
        <b>{label(id)}</b>
        {sub(id) && <small>{sub(id)}</small>}
        {orderBy[id] && <small className="st-b2-by">{orderBy[id]}</small>}
      </span>
      <em>{fee === 0 ? t.free : <Amt>{sar(fee)}</Amt>}</em>
    </>
  );
  return (
    <div className="st-b2-way">
      <p className="st-b2-way-k" id="st-way-k">
        {step ? <span className="st-step-n" aria-hidden="true">{step}</span> : null}
        <span>{b.howToGet}</span>
      </p>
      {pickable ? (
        <div className="st-ways st-ways-on" role="radiogroup" aria-labelledby="st-way-k">
          {est.options.map((o) => (
            <label key={o.id} className={est.way?.id === o.id ? "on" : undefined}>
              <input type="radio" name="st-pdp-way" value={o.id} checked={est.way?.id === o.id} onChange={() => onWay(o.id)} />
              {row(o.id, o.fee)}
            </label>
          ))}
        </div>
      ) : (
        <ul className="st-ways" aria-labelledby="st-way-k">
          {est.options.map((o) => <li key={o.id}>{row(o.id, o.fee)}</li>)}
        </ul>
      )}
      {handover}
      {freeOver !== null && est.options.some((o) => o.id !== "pickup") && <p className="st-info-note st-b2-free">{t.freeOver(sar(freeOver))}</p>}
    </div>
  );
}
