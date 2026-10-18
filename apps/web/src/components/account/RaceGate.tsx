"use client";

import "./rating.css";
import "./waiver.css";
import "./race-gate.css";
import { useEffect, useRef, useState } from "react";
import { useL } from "@/i18n/TxProvider";
import { DEFE_RACE_CODE, DEFE_RACE_URL } from "@/lib/tickets";
import type { RaceRegAnswer } from "@/lib/race-reg";
import { signOut } from "./quiet";

// "Have you registered for the race?" on a DEFE 5KM Run place, as a pop-up the runner cannot skip (the
// owner, 2026-10-18: "i want it as an unskippable pop up"; the booking app's renderRaceGate): the run -
// what, when and where - then Yes or No. Yes saves and lets the runner through; No saves and shows the
// members' code and the way to Defe's registration page, then Done lets them through for this visit (the
// next visit asks again until Yes). No close, no backdrop, no Escape; signing out is the only other way
// off, and the rest of the page is inert while it is up. The answer goes through /api/account/race-reg.
export type PendingRaceReg = {
  entryId: string;
  /** The answer so far: null before any, or "no" (asked again until Yes). */
  answer: RaceRegAnswer | null;
  name: string; when: string; time: string; venue: string;
  /** The question's words in the page's language (tickets.text.ts). */
  t: { q: string; sub: string; noNote: string; code: string; link: string; yes: string; no: string; failed: string };
};
/** yes: answered Yes · later: No, passed with Done for this visit · stale: the place no longer asks (ask again). */
export type RaceRegDone = "yes" | "later" | "stale";

const Ic = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const CAL = "M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z";
const CLOCK = "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z";
const PIN = "M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21ZM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z";

export default function RaceGate({ onDone, ...w }: PendingRaceReg & { onDone: (r: RaceRegDone) => void }) {
  const tx = useL();
  const box = useRef<HTMLDivElement>(null);
  const [answer, setAnswer] = useState<RaceRegAnswer | null>(w.answer);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState(false);
  const [out, setOut] = useState(false);
  const id = `rr-${w.entryId}`;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    // Everything but this pop-up, at every level up to <body>, is made inert: no focus, no clicks.
    const made: Element[] = [];
    for (let n: Element | null = el.closest(".rr-gate"); n && n !== document.body; n = n.parentElement) {
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

  async function set(v: RaceRegAnswer) {
    if (busy) return;
    const was = answer;
    setAnswer(v); setFail(false); setBusy(true);
    try {
      const r = await fetch("/api/account/race-reg", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ entryId: w.entryId, answer: v }),
      });
      const b = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (b?.ok) { setBusy(false); if (v === "yes") onDone("yes"); return; }
      // the place no longer asks (cancelled, or not a Defe place any more): ask for the next, if any
      if (b?.error === "refused") return onDone("stale");
      // the account's session has ended: the page drawn again asks with whatever the cookie holds now
      if (b?.error === "signin") return window.location.reload();
    } catch { /* offline: say so below */ }
    setAnswer(was); setFail(true); setBusy(false);
  }

  const leave = () => { setOut(true); signOut(); };
  const btn = (v: RaceRegAnswer, label: string) => (
    <button type="button" aria-pressed={answer === v} disabled={busy} onClick={() => set(v)}>{label}</button>
  );
  const code = w.t.code.split("{0}");

  return (
    <div className="rg-gate rr-gate">
      <div ref={box} className="rg-box rr-box" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-sub`} tabIndex={-1}>
        <h2 id={`${id}-title`} className="rg-title">{w.t.q}</h2>
        <div className="wg-sess">
          <p className="wg-ev"><bdi>{w.name}</bdi></p>
          <p className="wg-ln"><Ic d={CAL} /><span>{w.when}</span></p>
          {w.time && <p className="wg-ln"><Ic d={CLOCK} /><bdi>{w.time}</bdi></p>}
          <p className="wg-ln"><Ic d={PIN} /><span>{w.venue}</span></p>
        </div>
        <p id={`${id}-sub`} className="wg-sub">{w.t.sub}</p>
        <div className="rr-yn">{btn("yes", w.t.yes)}{btn("no", w.t.no)}</div>
        {answer === "no" && (
          <div className="rr-no">
            <p className="rr-note">{w.t.noNote}</p>
            {/* the discount code, bold and left to right in every language */}
            <p className="rr-code">{code[0]}<strong dir="ltr">{DEFE_RACE_CODE}</strong>{code[1] ?? ""}</p>
            <a className="rr-link" href={DEFE_RACE_URL} target="_blank" rel="noopener">{w.t.link}</a>
          </div>
        )}
        {fail && <p className="wg-err" role="alert">{w.t.failed}</p>}
        {answer === "no" && <button type="button" className="wg-btn" disabled={busy} onClick={() => onDone("later")}>{tx("Done", "تم")}</button>}
        <button type="button" className="wg-out" onClick={leave} disabled={out || busy}>{tx("Sign out", "تسجيل الخروج")}</button>
      </div>
    </div>
  );
}
