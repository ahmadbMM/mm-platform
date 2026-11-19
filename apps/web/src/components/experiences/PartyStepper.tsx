"use client";

import { useLocalize } from "@/i18n/TxProvider";
import { Ic } from "./BookIcons";
import { T } from "./Booking.text";

// The party on a ride an account books several bikes on (staging's EF09, EM06-B): adults and children (5 and over, the
// birth-date rule's floor), so the rider steps that follow already have a row for each. The whole party is never more than
// the account may book (`cap`); a button at its end rests, saying nothing more (no why-disabled line).
export default function PartyStepper({ adults, kids, cap, kidsOk, onChange }: {
  adults: number; kids: number; cap: number; kidsOk: boolean; onChange: (adults: number, kids: number) => void;
}) {
  const t = useLocalize(T);
  const row = (id: string, label: string, n: number, min: number, dec: string, inc: string, set: (v: number) => void) => (
    <div className="sx6-party-row">
      <span className="sx6-party-k" id={id}>{label}</span>
      <div className="bk-qty" role="group" aria-labelledby={id}>
        <button type="button" onClick={() => set(n - 1)} disabled={n <= min} aria-label={dec}><Ic name="minus" size={18} /></button>
        <span aria-live="polite">{n}</span>
        <button type="button" onClick={() => set(n + 1)} disabled={adults + kids >= cap} aria-label={inc}><Ic name="plus" size={18} /></button>
      </div>
    </div>
  );
  return (
    <div className="sx6-party" role="group" aria-label={t.party}>
      {row("sx6-ad", t.adults, adults, 1, t.adultsDec, t.adultsInc, (v) => onChange(v, kids))}
      {kidsOk && row("sx6-kd", t.kids, kids, 0, t.kidsDec, t.kidsInc, (v) => onChange(adults, v))}
    </div>
  );
}
