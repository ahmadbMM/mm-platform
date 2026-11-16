"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { RH_BIZ, helpPos, helpWaHref, type RhKind } from "@/lib/ride-help";
import type { RideHelpWords } from "./RideHelp.words";

// "Need help?" on My Account's ticket (lib/ride-help.ts; the booking app's _rhHtml and _rhOpen, 2026-11-16): one outlined
// button from an hour before the session until 3 hours after it, which opens a centred pop-up (a native dialog, as the bike
// report's: Escape and a tap outside close it): what is wrong as real radios, nothing picked at first; WhatsApp us, whose
// message the choice and, once the phone gives it, the rider's location fill in; Call us; the ambulance (997) in red;
// Close. The location is asked once each time the pop-up opens and goes only into the WhatsApp link; nothing is stored or
// sent from here. The page draws it with the server's clock; the browser shows and hides it as the window opens and
// closes. Its words come ready in the page's language from the ticket (RideHelp.words.ts).
type Props = {
  /** The window, epoch milliseconds (helpWindow). */
  from: number; until: number;
  /** The server's clock when it drew the page, so the page draws the same here as there. */
  now: number;
  /** The choices, in order (helpKinds). */
  kinds: RhKind[];
  /** The message's second line: the account's name, and the session as the ticket names it. */
  who: string; line: string;
  locale: string;
  words: RideHelpWords;
};

const Ic = ({ d, size = 18 }: { d: ReactNode; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{d}</svg>
);
// the booking app's own drawings (_CU help, chat, phone and pin)
const HELP = <><circle cx="12" cy="12" r="8.6" /><path d="M9.6 9.5a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.8v.4M12 16.5v.1" /></>;
const CHAT = <path d="M20.4 11.6a8.2 8.2 0 0 1-12.1 7.2L3.6 20.4l1.6-4.5a8.2 8.2 0 1 1 15.2-4.3z" />;
const PHONE = <path d="M5.2 3.6h3.1l1.6 4.2-2.1 1.4a10.6 10.6 0 0 0 5 5l1.4-2.1 4.2 1.6v3.1a2 2 0 0 1-2.2 2A16.2 16.2 0 0 1 3.2 5.8a2 2 0 0 1 2-2.2z" />;
const PIN = <><path d="M12 21.2s-6.6-5.7-6.6-11.1a6.6 6.6 0 0 1 13.2 0c0 5.4-6.6 11.1-6.6 11.1z" /><circle cx="12" cy="10.1" r="2.3" /></>;

export default function TicketHelp({ from, until, now: drawn, kinds, who, line, locale, words }: Props) {
  const dlg = useRef<HTMLDialogElement>(null);
  const seq = useRef(0); // which opening a location answers: a late one from an earlier opening is dropped
  const id = useId();
  const [now, setNow] = useState(drawn);
  const [pick, setPick] = useState<RhKind | "">("");
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const on = now >= from && now < until;
  // shown and hidden as the window opens and closes (looked at again within the hour, so a far time never overflows)
  useEffect(() => {
    const next = now < from ? from : now < until ? until : null;
    if (next === null) return;
    const t = setTimeout(() => setNow(Date.now()), Math.min(Math.max(0, next - Date.now()), 3600e3) + 50);
    return () => clearTimeout(t);
  }, [now, from, until]);

  function open() {
    const n = ++seq.current;
    setPick(""); setPos(null);
    dlg.current?.showModal();
    // where the rider is, asked once as the pop-up opens (the browser asks first); the link stays a plain link, so the tap
    // that sends it is never held up waiting for the phone
    try {
      if (navigator.geolocation) navigator.geolocation.getCurrentPosition((p) => { if (seq.current === n) setPos(helpPos(p.coords)); }, () => {}, { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 });
    } catch { /* no location: the message goes without it */ }
  }
  const close = () => dlg.current?.close();

  if (!on) return null;
  return (
    <div className="tk-rh">
      <button type="button" className="tk-btn" onClick={open}><Ic d={HELP} /><span>{words.btn}</span></button>
      <dialog ref={dlg} className="tk-dlg tk-rh-dlg" aria-labelledby={`${id}-t`} onClose={() => { seq.current++; }}
        onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}>
        <div className="tk-dlg-in">
          <h2 id={`${id}-t`} className="tk-dlg-t">{words.btn}</h2>
          <div className="tk-brp-opts" role="radiogroup" aria-labelledby={`${id}-t`}>
            {kinds.map((k) => (
              <label key={k} className="tk-brp-opt"><input type="radio" name={`${id}-k`} value={k} checked={pick === k} onChange={() => setPick(k)} /><span>{words[k]}</span></label>
            ))}
          </div>
          <div className="tk-dlg-acts">
            <a className="tk-rh-wa" href={helpWaHref({ k: pick, who, line, pos }, locale)} target="_blank" rel="noopener noreferrer">
              <Ic d={CHAT} /><span>{words.wa}</span>
              <span className="tk-rh-loc" hidden={!pos}><Ic d={PIN} size={16} /><span className="tk-rh-sr">{words.loc}</span></span>
            </a>
            <a className="tk-rh-call" href={`tel:+${RH_BIZ}`}><Ic d={PHONE} /><span>{words.call}</span></a>
            <a className="tk-rh-amb" href="tel:997"><Ic d={PHONE} /><span>{words.amb}</span></a>
            <button type="button" className="tk-rh-close" onClick={close}>{words.close}</button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
