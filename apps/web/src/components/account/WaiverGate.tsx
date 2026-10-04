"use client";

import "./rating.css";
import "./waiver.css";
import { useEffect, useRef, useState } from "react";
import { useL } from "@/i18n/TxProvider";
import type { WaiverCopy, WaiverKind } from "@/content/waivers";

// A desk-added booking's waiver as a page the rider cannot skip, as the booking app shows it
// (renderWaiverGate, the owner 2026-10-04): the ride - what, when, where and who - so the rider
// knows which ride the waiver is for, then the waiver itself, a tick and "Agree and continue". No
// close, no backdrop, no Escape, moving about keeps it; signing out is the only other way off. The
// rest of the page is made inert while it is up. The pop-up's frame is the rating gate's (rating.css).
export type PendingWaiver = {
  sessionId: string; version: string; kind: WaiverKind; copy: WaiverCopy;
  /** The ride's name, its day and date, its time ("" when it has none) and its place. */
  name: string; when: string; time: string; venue: string;
  /** "Riders", or "Participants" where there are no bikes, and who is on the booking (no number on a ride staff approve). */
  ridersLabel: string; riders: Array<{ name: string; num: number | null }>;
};
/** agreed: the database has it · absent: the database cannot record it yet (let through) ·
 *  stale: the ride's waiver changed since the pop-up was drawn (ask again). */
export type WaiverDone = "agreed" | "absent" | "stale";

const Ic = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const CAL = "M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z";
const CLOCK = "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z";
const PIN = "M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21ZM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z";

export default function WaiverGate({ onDone, ...w }: PendingWaiver & { onDone: (r: WaiverDone) => void }) {
  const tx = useL();
  const box = useRef<HTMLDivElement>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState(false);
  const [out, setOut] = useState(false);
  const id = `wg-${w.sessionId}`;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    // Everything but this pop-up, at every level up to <body>, is made inert: no focus, no clicks.
    const made: Element[] = [];
    for (let n: Element | null = el.closest(".wg-gate"); n && n !== document.body; n = n.parentElement) {
      for (const sib of Array.from(n.parentElement?.children ?? [])) {
        if (sib !== n && !sib.hasAttribute("inert") && sib.tagName !== "SCRIPT") { sib.setAttribute("inert", ""); made.push(sib); }
      }
    }
    document.documentElement.classList.add("wg-lock");
    el.focus({ preventScroll: true });
    return () => {
      for (const sib of made) sib.removeAttribute("inert");
      document.documentElement.classList.remove("wg-lock");
    };
  }, []);

  async function agree() {
    if (!ok || busy) return;
    setBusy(true);
    setFail(false);
    try {
      const r = await fetch("/api/account/pending-waiver", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: w.sessionId, version: w.version }),
      });
      const b = (await r.json().catch(() => null)) as { ok?: boolean; absent?: boolean; error?: string } | null;
      if (b?.ok) return onDone(b.absent ? "absent" : "agreed");
      if (b?.error === "changed") return onDone("stale");
      // the account's session has ended: the page drawn again asks with whatever the cookie holds now
      if (b?.error === "signin") return window.location.reload();
    } catch { /* offline: say so below */ }
    setFail(true);
    setBusy(false);
  }

  const signOut = () => {
    setOut(true);
    fetch("/api/account", { method: "DELETE" }).finally(() => window.location.reload());
  };

  return (
    <div className="rg-gate wg-gate">
      <div ref={box} className="rg-box wg-box" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-sub`} tabIndex={-1}>
        <p className="rg-kicker wg-kicker">
          <span className="rg-flag" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="12" height="12"><path d="M12 2.5 4 5.6v5.9c0 5 3.4 8.9 8 10 4.6-1.1 8-5 8-10V5.6Zm-1.2 13.3-3.6-3.6 1.6-1.6 2 2 4.6-4.6 1.6 1.6Z" fill="currentColor" fillRule="evenodd" /></svg>
          </span>
          {tx("Waiver needed", "إقرار مطلوب")}
        </p>
        <h2 id={`${id}-title`} className="rg-title">{w.copy.title}</h2>
        <p id={`${id}-sub`} className="wg-sub">{tx("Our team booked you on this ride. Read its waiver and agree to it to continue.", "سجّلك فريقنا في هذه الرحلة. اقرأ إقرارها ووافق عليه للمتابعة.")}</p>
        <div className="wg-sess">
          <p className="wg-ev"><bdi>{w.name}</bdi></p>
          <p className="wg-ln"><Ic d={CAL} /><span>{w.when}</span></p>
          {w.time && <p className="wg-ln"><Ic d={CLOCK} /><bdi>{w.time}</bdi></p>}
          <p className="wg-ln"><Ic d={PIN} /><span>{w.venue}</span></p>
          <p className="wg-sec">{w.ridersLabel}</p>
          <ul className="wg-riders">
            {w.riders.map((r, i) => (
              <li key={i}>{r.num != null && <bdi className="wg-num" dir="ltr">#{r.num}</bdi>}<bdi>{r.name}</bdi></li>
            ))}
          </ul>
        </div>
        <div className="wg-text" tabIndex={0} role="region" aria-label={w.copy.title}>{w.copy.body}</div>
        <label className={`wg-agree${ok ? " on" : ""}`}>
          <input type="checkbox" checked={ok} disabled={busy} onChange={(e) => { setOk(e.target.checked); setFail(false); }} />
          <span>{w.copy.agree}</span>
        </label>
        {fail && <p className="wg-err" role="alert">{tx("It could not be sent. Check the connection and try again.", "تعذّر الإرسال. تحقق من الاتصال وحاول مجدداً.")}</p>}
        <button type="button" className="wg-btn" disabled={!ok || busy} onClick={agree}>
          {busy ? tx("Sending…", "جارٍ الإرسال…") : tx("Agree and continue", "أوافق وأتابع")}
        </button>
        <button type="button" className="wg-out" onClick={signOut} disabled={out || busy}>{tx("Sign out", "تسجيل الخروج")}</button>
      </div>
    </div>
  );
}
