"use client";

import "./rating.css";
import "./waiver.css";
import { useEffect, useRef, useState } from "react";
import { useL } from "@/i18n/TxProvider";
import { signOut } from "./quiet";

// A Run for Her runner's agreement to share their details with the race's hosts, as a page the runner
// cannot skip, as the booking app shows it (_pendingShare, the owner 2026-10-06): the run - what, when
// and where - then what goes to Sela and Jeddah Yacht Club (JYC), a tick and "Agree and continue".
// No close, no backdrop, no Escape, moving about keeps it; signing out is the only other way off. The
// rest of the page is made inert while it is up. Its frame is the rating gate's (rating.css), its
// look the waiver gate's (waiver.css).
export type PendingShare = {
  sessionId: string;
  /** The run's name, its day and date, its time ("" when it has none) and its place. */
  name: string; when: string; time: string; venue: string;
  /** The distance the runner picked, in the ticket's words ("5 km"), or null when the booking has none. */
  distance: string | null;
};
/** agreed: the database has it · absent: the database cannot record it yet (let through) ·
 *  stale: the session is no longer Run for Her (ask again). */
export type ShareDone = "agreed" | "absent" | "stale";

const Ic = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const CAL = "M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z";
const CLOCK = "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z";
const PIN = "M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21ZM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z";
const CHECK = "M5 12.5 9.5 17 19 7.5";

export default function ShareGate({ onDone, ...w }: PendingShare & { onDone: (r: ShareDone) => void }) {
  const tx = useL();
  const box = useRef<HTMLDivElement>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState(false);
  const [out, setOut] = useState(false);
  const id = `sg-${w.sessionId}`;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    // Everything but this pop-up, at every level up to <body>, is made inert: no focus, no clicks.
    const made: Element[] = [];
    for (let n: Element | null = el.closest(".sg-gate"); n && n !== document.body; n = n.parentElement) {
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
      const r = await fetch("/api/account/pending-share", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: w.sessionId }),
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

  const leave = () => {
    setOut(true);
    signOut();
  };

  // what goes to the race's hosts, in the booking app's order
  const items = [
    tx("Full name", "الاسم الكامل"),
    tx("Email address", "البريد الإلكتروني"),
    tx("Birth date", "تاريخ الميلاد"),
    tx("Distance chosen", "المسافة المختارة"),
    tx("Emergency contact", "جهة اتصال للطوارئ"),
  ];

  return (
    <div className="rg-gate sg-gate">
      <div ref={box} className="rg-box sg-box" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-sub`} tabIndex={-1}>
        <p className="rg-kicker sg-kicker">
          <span className="rg-flag" aria-hidden="true">
            {/* Run for Her's pink ribbon (badge-glyphs.ts "ribbon"), its far band lighter */}
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinejoin="round">
              <path d="M12 3.1A3.9 3.9 0 0 0 8.1 7c0 1.8 1.3 3.6 3.9 6.7L17.4 21" opacity=".55" />
              <path d="M6.6 21 12 13.7c2.6-3.1 3.9-4.9 3.9-6.7A3.9 3.9 0 0 0 12 3.1" />
            </svg>
          </span>
          {tx("Before the race", "قبل السباق")}
        </p>
        <h2 id={`${id}-title`} className="rg-title">{tx("Sharing your details for the race", "مشاركة بياناتك للسباق")}</h2>
        <div className="wg-sess">
          <p className="wg-ev"><bdi>{w.name}</bdi></p>
          <p className="wg-ln"><Ic d={CAL} /><span>{w.when}</span></p>
          {w.time && <p className="wg-ln"><Ic d={CLOCK} /><bdi>{w.time}</bdi></p>}
          <p className="wg-ln"><Ic d={PIN} /><span>{w.venue}</span></p>
        </div>
        <p id={`${id}-sub`} className="wg-sub">{tx("To take part in the race, we will share these details about you with Sela and Jeddah Yacht Club (JYC):", "للمشاركة في السباق، سنشارك بياناتك التالية مع صلة ونادي جدة لليخوت (JYC):")}</p>
        <ul className="sg-list">
          {items.map((label, i) => (
            <li key={i}>
              <Ic d={CHECK} />
              <span>{label}{i === 3 && w.distance && <>{" · "}<bdi>{w.distance}</bdi></>}</span>
            </li>
          ))}
        </ul>
        <p className="sg-note">{tx("Nothing else about you is shared, and only for this race.", "لا نشارك أي شيء آخر عنك، وللسباق فقط.")}</p>
        <label className={`wg-agree${ok ? " on" : ""}`}>
          <input type="checkbox" checked={ok} disabled={busy} onChange={(e) => { setOk(e.target.checked); setFail(false); }} />
          <span>{tx("I agree to MicroMobility sharing these details with Sela and Jeddah Yacht Club (JYC) so I can take part in the race.", "أوافق على أن تشارك مايكروموبيليتي هذه البيانات مع صلة ونادي جدة لليخوت (JYC) لأتمكن من المشاركة في السباق.")}</span>
        </label>
        {fail && <p className="wg-err" role="alert">{tx("It could not be sent. Check the connection and try again.", "تعذّر الإرسال. تحقق من الاتصال وحاول مجدداً.")}</p>}
        <button type="button" className="wg-btn" disabled={!ok || busy} onClick={agree}>
          {busy && <span className="sg-spin" aria-hidden="true" />}
          {busy ? tx("Sending…", "جارٍ الإرسال…") : tx("Agree and continue", "أوافق وأتابع")}
        </button>
        <button type="button" className="wg-out" onClick={leave} disabled={out || busy}>{tx("Sign out", "تسجيل الخروج")}</button>
      </div>
    </div>
  );
}
