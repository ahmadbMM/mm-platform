"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useLocalize } from "@/i18n/TxProvider";
import NoticeLink from "@/components/privacy/NoticeLink";
import { T } from "./Account.text";
import { postJson } from "./fields";

// Ride news and the Privacy Notice, as the booking app keeps them (toggleRideNews, _consentCheck):
// the rider's own yes or no, switched here at any time, and - when the account has not confirmed
// THIS version of the notice, or never answered ride news (every account made before either
// existed) - a pop-up that only an answer closes. "No thanks" is as easy as yes and costs nothing
// (Personal Data Protection Law, Art. 7 and 25). Both answers go through /api/account/consents.

/** "…our {0}…" with the Privacy Notice link where {0} stands. */
function withLink(text: string, link: ReactNode): ReactNode {
  const i = text.indexOf("{0}");
  return i < 0 ? text : <>{text.slice(0, i)}{link}{text.slice(i + 3)}</>;
}

export function RideNews({ on: initial, dialog }: { on: boolean; dialog: string }) {
  const t = useLocalize(T);
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function flip() {
    setBusy(true); setErr("");
    const b = await postJson<{ rideNews?: boolean }>("/api/account/consents", { rideNews: !on });
    setBusy(false);
    if (b.ok && typeof b.rideNews === "boolean") setOn(b.rideNews); else setErr(b.error === "signin" ? t.errors.signin : t.connection);
  }
  return (
    <section className="ac-panel" aria-labelledby="ac-rn-h">
      <h2 id="ac-rn-h" className="ac-panel-h">{t.rnTitle}</h2>
      <p className="ac-sub">{t.rnSub}</p>
      <p className={`ac-state${on ? " on" : ""}`} role="status">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {on ? <path d="M5 12.5l4.2 4.2L19 7" /> : <path d="M6 12h12" />}
        </svg>
        {on ? t.rnOn : t.rnOff}
      </p>
      {err && <p className="ac-err" role="alert">{err}</p>}
      <div className="ac-row-btns">
        <button type="button" className={`ac-btn${on ? " ac-btn-line" : ""}`} onClick={flip} disabled={busy}>{on ? t.rnStop : t.rnStart}</button>
        <NoticeLink dialog={dialog} className="ac-link">{t.privacy}</NoticeLink>
      </div>
    </section>
  );
}

export function ConsentPrompt({ needAck, needNews, dialog }: { needAck: boolean; needNews: boolean; dialog: string }) {
  const t = useLocalize(T);
  const router = useRouter();
  const box = useRef<HTMLDialogElement>(null);
  const [ack, setAck] = useState(false);
  const [ackErr, setAckErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [fails, setFails] = useState(0);
  useEffect(() => {
    const d = box.current;
    if (d && !d.open && typeof d.showModal === "function") d.showModal();
  }, []);
  async function answer(news: boolean | null) {
    if (needAck && !ack) { setAckErr(true); return; }
    setBusy(true); setErr("");
    const b = await postJson("/api/account/consents", { privacy: needAck || undefined, rideNews: needNews ? news : undefined });
    setBusy(false);
    if (b.ok) { box.current?.close(); router.refresh(); return; }
    // Answered, but it did not save: once more; a second failure lets them through rather than
    // lock the page behind the pop-up - still unanswered, they are asked on the next visit.
    if (fails >= 1) { box.current?.close(); return; }
    setFails((n) => n + 1);
    setErr(b.error === "signin" ? t.errors.signin : t.connection);
  }
  const link = <NoticeLink dialog={dialog} className="ac-link">{t.privacy}</NoticeLink>;
  return (
    // Only an answer closes it: Escape does nothing.
    <dialog ref={box} className="ac-dlg" aria-labelledby="ac-cs-h" onCancel={(e) => e.preventDefault()}>
      <h2 id="ac-cs-h">{needAck ? t.askTitle : t.askNewsTitle}</h2>
      {needAck && (
        <>
          <p className="ac-sub">{withLink(t.askNotice, link)}</p>
          <label className={`ac-tick${ackErr && !ack ? " miss" : ""}`}>
            <input type="checkbox" checked={ack} onChange={(e) => { setAck(e.target.checked); setAckErr(false); }} />
            <span>{withLink(t.ack, t.privacy)}</span>
          </label>
          {ackErr && !ack && <p className="ac-err" role="alert">{t.ackRequired}</p>}
        </>
      )}
      {needNews ? (
        <>
          {needAck && <h3 className="ac-dlg-h3">{t.askNewsTitle}</h3>}
          <p className="ac-sub">{t.rnSub}</p>
          <div className="ac-dlg-btns">
            <button type="button" className="ac-btn" onClick={() => answer(true)} disabled={busy}>{t.yes}</button>
            <button type="button" className="ac-btn ac-btn-line" onClick={() => answer(false)} disabled={busy}>{t.no}</button>
          </div>
        </>
      ) : (
        <div className="ac-dlg-btns"><button type="button" className="ac-btn" onClick={() => answer(null)} disabled={busy}>{t.continue}</button></div>
      )}
      {err && <p className="ac-err" role="alert">{err}</p>}
    </dialog>
  );
}
