"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

// The parts of My Account's ticket that answer a tap (TicketCard.tsx is drawn on the server): the Details fold, Share,
// Directions with the iPhone's choice of maps, and the screen kept awake while today's code is on the page. All four
// are the booking app's, from its Bookings page research (2026-11-10): _tkMore, _tkShare, _dirBtnHtml / _dirPick and
// _wakeWant.

const Chev = () => (
  <svg className="tk-more-ic" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6" /></svg>
);
// the booking app's _TK_SHARE_IC: an arrow up out of a tray
const ShareIc = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M12 15V4" /><path d="M8 7.5L12 3.5l4 4" /><path d="M7 11H5.6A1.6 1.6 0 0 0 4 12.6v6.8A1.6 1.6 0 0 0 5.6 21h12.8a1.6 1.6 0 0 0 1.6-1.6v-6.8a1.6 1.6 0 0 0-1.6-1.6H17" />
  </svg>
);
const TickIc = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
);
const XIc = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18" /></svg>
);

/** The route and the add-ons behind one Details row, closed until opened; the total stays in view. They are things a
 *  rider looks up, not what they need at a glance or at the desk, and they made every ticket about a screen tall. */
export function TicketMore({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={`tk-more${open ? " on" : ""}`}>
      <button type="button" className="tk-more-btn" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <span>{label}</span><Chev />
      </button>
      <div className="tk-more-body" id={id} hidden={!open}>{children}</div>
    </div>
  );
}

/** The rider's own booking as words and a link: what, when and where, and the booking app's page for the same date.
 *  Never a picture of the code (a code in someone else's hand is a ticket) and nobody's name. Without a share sheet the
 *  words are copied and the button wears a tick for two seconds; nothing else is said. */
export function TicketShare({ text, url, label, copied }: { text: string; url: string; label: string; copied: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => setDone(false), 2000);
    return () => clearTimeout(id);
  }, [done]);
  async function share() {
    if (navigator.share) {
      try { await navigator.share({ text, url }); } catch { /* the sheet was closed */ }
      return;
    }
    try { await navigator.clipboard.writeText(`${text}\n${url}`); } catch { return; }
    setDone(true);
  }
  const name = done ? copied : label;
  return (
    <button type="button" className="tk-btn tk-share" aria-label={name} title={name} onClick={share}>{done ? <TickIc /> : <ShareIc />}</button>
  );
}

// An iPhone or iPad (an iPad says Macintosh, with a touch screen): the one place Apple Maps is the phone's own, and where
// the route's GPX file goes to the share sheet (TicketRoutePage).
export const appleTouch = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

/** Directions: a link to the place (`href`). At the circuit (`apple`, the booth's Apple Maps link) an iPhone or iPad is
 *  offered Apple Maps or Google Maps in a centred dialog; everything else follows the Google Maps link, which a phone
 *  opens in its Maps app. The dialog closes a tick after a link is followed: a link taken out of the page in its own
 *  click goes nowhere. */
export function TicketDir({ href, apple, words, children }: { href: string; apple?: string | null; words: { title: string; apple: string; google: string; close: string }; children: ReactNode }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const id = useId();
  const picked = () => setTimeout(() => dlg.current?.close(), 0);
  return (
    <>
      <a className="tk-btn tk-dir" href={href} target="_blank" rel="noopener"
        onClick={(e) => { if (!apple || !dlg.current || !appleTouch()) return; e.preventDefault(); dlg.current.showModal(); }}>{children}</a>
      {apple && (
        <dialog ref={dlg} className="tk-dlg" aria-labelledby={`${id}-t`} onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}>
          <div className="tk-dlg-in">
            <h2 id={`${id}-t`} className="tk-dlg-t">{words.title}</h2>
            <button type="button" className="tk-dlg-x" aria-label={words.close} onClick={() => dlg.current?.close()}><XIc /></button>
            <div className="tk-dlg-acts">
              <a className="tk-dlg-a" href={apple} target="_blank" rel="noopener" onClick={picked}>{words.apple}</a>
              <a className="tk-dlg-a" href={href} target="_blank" rel="noopener" onClick={picked}>{words.google}</a>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}

/** The phone stays awake while the page shows today's code large (the booking app's _wakeWant): at the desk the ticket
 *  gets a few seconds, and a screen that dimmed or locked in the line cost the rider a passcode and the desk a rider.
 *  Nothing is said about it. The browser lets the lock go when the page is hidden; it is asked again when the page
 *  shows, and let go when the code leaves the page. Without the Wake Lock API nothing happens. */
export function TicketWake() {
  useEffect(() => {
    const wl = navigator.wakeLock;
    if (!wl?.request) return;
    let lock: WakeLockSentinel | null = null, asking = false, gone = false;
    const take = () => {
      if (gone || lock || asking || document.hidden) return;
      asking = true;
      wl.request("screen").then((l) => {
        asking = false;
        if (gone) { l.release().catch(() => {}); return; }
        lock = l;
        l.addEventListener("release", () => { if (lock === l) lock = null; });
      }, () => { asking = false; });
    };
    take();
    document.addEventListener("visibilitychange", take);
    return () => {
      gone = true;
      document.removeEventListener("visibilitychange", take);
      lock?.release().catch(() => {});
      lock = null;
    };
  }, []);
  return null;
}
