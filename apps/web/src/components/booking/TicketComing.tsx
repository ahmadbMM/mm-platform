"use client";

import { useId, useRef, useState } from "react";
import { ClockIcon, CloseIcon, TickIcon } from "@/components/site/Icons";
import { RL_MINS } from "@/lib/still-coming";
import type { ComingWords } from "./Coming.words";

// "Still coming?" on My Account's ticket (lib/still-coming.ts; the booking app's _stcHtml and _stcYes, 2026-11-13): "I'm
// coming" saves the answer through /api/account/coming and turns into one quiet "Coming" chip, with no line and no toast
// (the owner: no bar after an action); "Can't come" opens the booking app's My Bookings at this ticket with no=1, where the
// app asks as its own Can't come does (a Saturday Social Ride: "Not coming?", then the booking is cancelled; 2026-11-20).
// A session called off, not yet asked or already started, or a booking no longer seated, draws the page again (what the
// server knows wins); a database without the function takes the buttons away; a failure says so under them. Its words
// come ready in the page's language from the ticket (Coming.words.ts; failed is the ticket's rrFailed).
// Running late (the customer features round, 2026-11-19, item 1; the booking app's _rlPick and _rlSave): where the session
// has a time to turn up, from two hours before it until an hour after the start, a third button beside them (alone once
// they are gone) opens a centred pop-up (a native dialog, as the bike report's: Escape and a tap outside close it) with
// 10, 20 and 30 min; a pick saves at once through /api/account/late and one amber chip takes the buttons' place, saying it
// and opening the pop-up again, now with "I'm on time" to take it back. Running late counts as coming. A refusal is said
// in the pop-up in words (too late to change it, or the booking holds no place) and closing it draws the page again; a
// database without the function takes the button away; a failure says so in the pop-up.
type Props = {
  sessionId: string; cancel: string; words: ComingWords; failed: string;
  /** I'm coming / Can't come are asked (within their window); every waiting rider said yes. */
  ask?: boolean; ok?: boolean;
  /** The minutes the party said it will be late (0 none), and whether Running late may be said now. */
  late?: number; lateOn?: boolean;
};

export default function TicketComing({ sessionId, cancel, ask = true, ok: okFirst = false, late: lateFirst = 0, lateOn = false, words, failed }: Props) {
  const [ok, setOk] = useState(okFirst);
  const [late, setLate] = useState(lateFirst);
  const [gone, setGone] = useState(false); // a database without booking_coming
  const [lateOff, setLateOff] = useState(false); // a database without booking_late
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [dlgErr, setDlgErr] = useState("");
  const [said, setSaid] = useState(""); // a refusal, said in the pop-up; closing it draws the page again
  const dlg = useRef<HTMLDialogElement>(null);
  const id = useId();

  async function yes() {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/account/coming", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ session: sessionId }),
      });
      const b = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (b?.ok) { setOk(true); return; }
      if (b?.error === "absent") { setGone(true); return; }
      if (b?.error === "closed" || b?.error === "none" || b?.error === "signin") { window.location.reload(); return; }
      setErr(failed);
    } catch {
      setErr(failed);
    } finally { setBusy(false); }
  }

  function open() {
    setDlgErr(""); setSaid("");
    dlg.current?.showModal();
  }
  const close = () => dlg.current?.close();

  async function save(min: number | null) {
    if (busy) return;
    setBusy(true); setDlgErr("");
    try {
      const r = await fetch("/api/account/late", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ session: sessionId, min }),
      });
      const b = (await r.json().catch(() => null)) as { ok?: boolean; error?: string; coming?: string | null } | null;
      if (b?.ok) { setLate(min ?? 0); if (b.coming) setOk(true); close(); return; }
      if (b?.error === "absent") { setLateOff(true); close(); return; }
      if (b?.error === "closed" || b?.error === "none") { setSaid(b.error === "closed" ? words.noMore : words.noPlace); return; }
      if (b?.error === "signin") { close(); window.location.reload(); return; }
      setDlgErr(failed);
    } catch {
      setDlgErr(failed);
    } finally { setBusy(false); }
  }

  const rw = lateOn && !lateOff;
  const asked = ask && !gone;
  if (!asked && !rw) return null;
  const dialog = (
    <dialog ref={dlg} className="tk-dlg tk-rl-dlg" aria-labelledby={`${id}-t`} onClose={() => { if (said) window.location.reload(); }}
      onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}>
      <div className="tk-dlg-in">
        <h2 id={`${id}-t`} className="tk-dlg-t">{words.lateAsk}</h2>
        {said ? <p className="tk-rl-said" role="alert">{said}</p> : (
          <div className="tk-rl-acts" role="group" aria-labelledby={`${id}-t`}>
            {RL_MINS.map((n) => (
              <button key={n} type="button" aria-pressed={late === n} disabled={busy} onClick={() => save(n)}>{words.lateMin.replace("{0}", String(n))}</button>
            ))}
            {late > 0 && <button type="button" className="tk-rl-ontime" disabled={busy} onClick={() => save(null)}>{words.onTime}</button>}
          </div>
        )}
        {dlgErr && <p className="tk-brp-err" role="alert">{dlgErr}</p>}
        <button type="button" className="tk-dlg-x" aria-label={words.close} onClick={close}><CloseIcon size={20} /></button>
      </div>
    </dialog>
  );
  // the party's answer as one chip, which says it and opens it again
  if (late > 0 && (asked || rw)) return (
    <div className="tk-stc rl-one">
      <button type="button" className="tk-rl-chip" aria-haspopup="dialog" onClick={open}><ClockIcon size={16} /><span>{words.lateChip.replace("{0}", String(late))}</span></button>
      {dialog}
    </div>
  );
  const rb = rw ? <button type="button" className="tk-btn" aria-haspopup="dialog" onClick={open}>{words.late}</button> : null;
  if (!asked) return <div className="tk-stc rl-one">{rb}{dialog}</div>;
  if (ok) return <div className={`tk-stc${rb ? " rl-ok" : ""}`}><span className="tk-stc-ok"><TickIcon size={16} />{words.ok}</span>{rb}{dialog}</div>;
  return (
    <div className={`tk-stc${rb ? " rl-3" : ""}`} role="group" aria-label={words.ask}>
      <button type="button" className="tk-btn solid" disabled={busy} onClick={yes}>{words.yes}</button>
      {rb}
      <a className="tk-btn" href={cancel}>{words.no}</a>
      {err && <p className="tk-stc-err" role="alert">{err}</p>}
      {dialog}
    </div>
  );
}
