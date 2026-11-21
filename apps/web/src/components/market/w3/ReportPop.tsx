"use client";

import { useId, useState } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { MK_NOTE_MAX, mkErrorKey, type MkReportReason, type MkReportTarget } from "@/lib/market/core";
import { reportReasons } from "@/lib/market/w3";
import { mkPost } from "@/lib/market/w3-client";
import MkModal from "../MkModal";
import { T as S, mkErrorText } from "../Market.text";
import { T } from "../w3.text";
import "../w3.css";

// Reporting a listing or a conversation to staff: a centred pop-up with the reasons (a listing's are about the item,
// a conversation's about the person) and an optional note of 300 characters, sent to /api/market/report. One report per
// account per thing: a second one is answered as the first was, with the same quiet thanks. Nobody but staff ever
// learns who reported.
//   target, refId   what is reported
//   onSent          the report is with staff (or already was): the button that opened this says "Reported" from now on
export default function ReportPop({ target, refId, onClose, onSent }: { target: MkReportTarget; refId: number; onClose: () => void; onSent: () => void }) {
  const s = useLocalize(S);
  const w = useLocalize(T);
  const [reason, setReason] = useState<MkReportReason | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);
  const group = useId();
  const noteId = useId();
  const title = target === "listing" ? w.reportListing : w.reportThread;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !reason) return;
    setBusy(true);
    setErr("");
    const r = await mkPost<{ dup: boolean }>("/api/market/report", { target, ref: refId, reason, ...(note.trim() ? { note } : {}) });
    setBusy(false);
    if (!r.ok) { setErr(mkErrorKey(r.error, r.detail)); return; }
    setSent(true);
    onSent();
  }

  if (sent) {
    return (
      <MkModal title={title} onClose={onClose}>
        <p role="status">{w.reportThanks}</p>
        <div className="mk-pop-acts">
          <button type="button" className="mk-btn" onClick={onClose} autoFocus>{s.done}</button>
        </div>
      </MkModal>
    );
  }
  return (
    <MkModal title={title} onClose={onClose} busy={busy}>
      <form className="mk-w3-report" onSubmit={submit} noValidate>
        <fieldset className="mk-set mk-w3-reasons">
          <legend>{w.reason}</legend>
          {reportReasons(target).map((r) => (
            <label key={r} className="mk-w3-reason">
              <input className="mk-radio" type="radio" name={group} checked={reason === r} onChange={() => { setReason(r); setErr(""); }} disabled={busy} />
              <span>{w[`r_${r}`]}</span>
            </label>
          ))}
        </fieldset>
        <div className="mk-field">
          <label htmlFor={noteId}>{w.note}</label>
          <textarea id={noteId} dir="auto" rows={3} maxLength={MK_NOTE_MAX} value={note} disabled={busy} onChange={(e) => setNote(e.target.value)} />
        </div>
        {err && <p className="mk-err" role="alert">{mkErrorText(s, err)}</p>}
        <div className="mk-pop-acts">
          <button type="submit" className="mk-btn" disabled={busy || !reason} aria-busy={busy || undefined}>{w.reportSend}</button>
          <button type="button" className="mk-btn2" onClick={onClose} disabled={busy}>{s.cancel}</button>
        </div>
      </form>
    </MkModal>
  );
}
