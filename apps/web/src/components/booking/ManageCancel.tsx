"use client";

import { useId, useState } from "react";
import { CANCEL_OTHER, NOTE_MAX, type Reason } from "@/lib/booking-manage";
import type { ManageWords } from "./Manage.words";
import { ManageDialog, sayError } from "./ManageDialog";
import { fillN, postManage } from "./manage-client";

// Cancel on a ticket (the booking app's showCancelReasonModal and confirmCancelWithReason): why, as one list of real radios
// with nothing picked until the rider picks; Other opens a box for the rider's own words; a party is told the cancel takes
// all of it ("This cancels the booking for all 3 riders"); the two answers stacked at full width, the cancel first (Cancel
// booking, Cancel the booking for all 3, or Leave waitlist when nothing is held), then Keep booking. What is missing is
// said by the buttons. The whole booking is cancelled (POST /api/booking/cancel), each row with the reason's code.

const REASON_KEY: Record<string, keyof ManageWords> = {
  plans: "r_plans", work: "r_work", unwell: "r_unwell", weather: "r_weather", wrong_date: "r_wrong_date", transport: "r_transport", group: "r_group", price: "r_price", other: "r_other",
};
export const reasonLabel = (r: Reason, w: ManageWords) => r.label ?? (REASON_KEY[r.code] ? w[REASON_KEY[r.code]] : r.code);

export default function ManageCancel({ open, onClose, onDone, booking, count, allWl, noBike, reasons, w }: {
  open: boolean; onClose: () => void; onDone: () => void; booking: string; count: number; allWl: boolean; noBike: boolean; reasons: Reason[]; w: ManageWords;
}) {
  const id = useId();
  const [pick, setPick] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const close = () => { setPick(null); setNote(""); setErr(""); onClose(); };

  async function go() {
    if (busy) return;
    if (!pick) { setErr(w.crPick); return; }
    const words = note.trim();
    if (pick === CANCEL_OTHER && !words) { setErr(w.crWrite); document.getElementById(`${id}-o`)?.focus(); return; }
    setBusy(true); setErr("");
    const a = await postManage("/api/booking/cancel", { booking, reason: pick, note: pick === CANCEL_OTHER ? words.slice(0, NOTE_MAX) : null });
    setBusy(false);
    if (a.ok) { setPick(null); setNote(""); onDone(); return; }
    setErr(sayError(w, a));
  }

  return (
    <ManageDialog open={open} onClose={close} title={w.crTitle} closeLabel={w.close} className="mg-cr-dlg"
      sub={count > 1 ? <p className="mg-sub">{fillN(noBike ? w.crPartySess : w.crParty, count)}</p> : null}>
      <div className="mg-cr-opts" role="radiogroup" aria-label={w.crTitle}>
        {reasons.map((r) => (
          <label key={r.code} className="mg-cr-opt">
            <input type="radio" name={`${id}-r`} value={r.code} checked={pick === r.code} onChange={() => { setPick(r.code); setErr(""); }} />
            <span className="mg-cr-dot" aria-hidden="true" /><span className="mg-cr-txt">{reasonLabel(r, w)}</span>
          </label>
        ))}
      </div>
      {pick === CANCEL_OTHER && (
        <textarea id={`${id}-o`} className="tk-brp-ta" rows={3} maxLength={NOTE_MAX} placeholder={w.crOtherPh} aria-label={w.crOtherPh}
          value={note} onChange={(e) => { setNote(e.target.value); setErr(""); }} />
      )}
      {err && <p className="tk-brp-err" role="alert">{err}</p>}
      <div className="tk-dlg-acts">
        <button type="button" className="mg-btn mg-red" disabled={busy} aria-busy={busy || undefined} onClick={go}>
          {allWl ? w.leaveWl : count > 1 ? fillN(w.cancelAll, count) : w.cancelOne}
        </button>
        <button type="button" className="mg-btn" onClick={close}>{w.keep}</button>
      </div>
    </ManageDialog>
  );
}
