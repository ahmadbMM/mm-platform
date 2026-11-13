"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { TickIcon } from "@/components/site/Icons";
import { BRP_FAULTS, BRP_NOTE_MAX, brpChipUntil, type BrpFault } from "@/lib/bike-report";
import type { BikeReportWords } from "./BikeReport.words";

// "Report a bike problem" on My Account's ticket (lib/bike-report.ts; the booking app's _brpHtml and bike-report.js,
// 2026-11-13): one button, which opens a centred pop-up (a native dialog, as TicketDir's): which bike when the booking
// holds more than one (the account's own riders only), the faults as real radios, an optional note of 300 characters, Send
// report and Close. A report taken, or one the database's limits refuse, closes it and leaves one quiet "Problem reported"
// chip where the button was until every bike's booking may report again (ten minutes); nothing is said either way (the
// owner: no bar after an action). A booking no longer checked in, a bike gone from it, or the time to report over draws
// the page again; a database without the function takes the button away. Its words come ready in the page's language
// from the ticket (BikeReport.words.ts).
export type BrpPick = { booking: string; bike: string; name: string; who: string };

export default function TicketBikeReport({ options, reported: first, now: drawn, words }: { options: BrpPick[]; reported: Record<string, number>; now: number; words: BikeReportWords }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const [reported, setReported] = useState(first);
  const [now, setNow] = useState(drawn); // the server's clock first, so the page draws the same here as there
  const [gone, setGone] = useState(false);
  const [pick, setPick] = useState(0);
  const [fault, setFault] = useState<BrpFault | "">("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const until = brpChipUntil(options.map((o) => o.booking), reported, now);
  // the chip gives way to the button once its ten minutes are over
  useEffect(() => {
    if (until === null) return;
    const t = setTimeout(() => setNow(Date.now()), Math.max(0, until - Date.now()) + 50);
    return () => clearTimeout(t);
  }, [until]);

  function open() {
    setPick(0); setFault(""); setErr(""); setBusy(false);
    if (ta.current) ta.current.value = "";
    dlg.current?.showModal();
  }
  const close = () => dlg.current?.close();

  async function send() {
    if (busy) return;
    if (!fault) { setErr(words.pick); return; }
    const o = options[pick] ?? options[0];
    const note = (ta.current?.value ?? "").trim().slice(0, BRP_NOTE_MAX);
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/account/bike-report", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ booking: o.booking, bike: o.bike, fault, note: note || null }),
      });
      const b = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (b?.ok || b?.error === "limit") { // refused by the limits: the same chip, without a word
        const at = Date.now();
        close(); setReported((x) => ({ ...x, [o.booking]: at })); setNow(at);
        return;
      }
      if (b?.error === "absent") { close(); setGone(true); return; }
      if (b?.error === "none" || b?.error === "closed" || b?.error === "signin") { close(); window.location.reload(); return; }
      setErr(words.err);
    } catch {
      setErr(words.err);
    } finally { setBusy(false); }
  }

  if (gone) return null;
  if (until !== null) return <div className="tk-brp"><span className="tk-brp-ok"><TickIcon size={16} />{words.sent}</span></div>;
  const several = new Set(options.map((o) => o.booking)).size > 1;
  const radio = (name: string, key: string, on: boolean, change: () => void, label: ReactNode) => (
    <label key={key} className="tk-brp-opt"><input type="radio" name={name} value={key} checked={on} onChange={change} /><span>{label}</span></label>
  );
  return (
    <div className="tk-brp">
      <button type="button" className="tk-btn" onClick={open}>{words.btn}</button>
      <dialog ref={dlg} className="tk-dlg tk-brp-dlg" aria-labelledby={`${id}-t`} onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}>
        <div className="tk-dlg-in">
          <h2 id={`${id}-t`} className="tk-dlg-t">{words.btn}</h2>
          {options.length > 1 && (
            <div className="tk-brp-sec">
              <p className="tk-brp-lbl" id={`${id}-b`}>{words.bike}</p>
              <div className="tk-brp-opts" role="radiogroup" aria-labelledby={`${id}-b`}>
                {options.map((o, i) => radio(`${id}-bike`, String(i), pick === i, () => setPick(i), <><bdi>{o.name}</bdi>{several && o.who && <> · <bdi>{o.who}</bdi></>}</>))}
              </div>
            </div>
          )}
          <div className="tk-brp-opts" role="radiogroup" aria-labelledby={`${id}-t`}>
            {BRP_FAULTS.map((k) => radio(`${id}-fault`, k, fault === k, () => { setFault(k); setErr(""); }, words[k]))}
          </div>
          <div className="tk-brp-sec">
            <label className="tk-brp-lbl" htmlFor={`${id}-n`}>{words.note}</label>
            <textarea ref={ta} id={`${id}-n`} className="tk-brp-ta" maxLength={BRP_NOTE_MAX} rows={2} />
          </div>
          {err && <p className="tk-brp-err" role="alert">{err}</p>}
          <div className="tk-dlg-acts">
            <button type="button" className="tk-brp-send" disabled={busy} onClick={send}>{words.send}</button>
            <button type="button" className="tk-brp-close" onClick={close}>{words.close}</button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
