"use client";

import { useEffect, useRef, useState } from "react";
import { useL } from "@/i18n/TxProvider";
import { signOut } from "./quiet";

// Which club or community, for someone registered for the Blood Donation event before the question (the booking app's
// renderClubGate): a name, or I don't have one. Only an answer or Sign out gets past it. Its words come from the route
// (content/blood-words.ts), so nothing in the browser's code names the event.
export type PendingClub = {
  sessionId: string;
  name: string;
  when: string;
  words: { kicker: string; q: string; sub: string; ph: string; none: string; err: string; save: string };
};
export type ClubDone = "answered" | "absent";

export default function ClubGate({ onDone, ...w }: PendingClub & { onDone: (r: ClubDone) => void }) {
  const tx = useL();
  const box = useRef<HTMLDivElement>(null);
  const [v, setV] = useState("");
  const [bad, setBad] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState(false);
  const [out, setOut] = useState(false);
  const id = `cg-${w.sessionId}`, d = w.words;

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

  async function send(none: boolean) {
    if (busy) return;
    const club = none ? "" : v.trim().replace(/\s+/g, " ").slice(0, 80);
    if (!none && !club) { setBad(true); return; }
    setBusy(true);
    setBad(false);
    setFail(false);
    try {
      const r = await fetch("/api/account/pending-club", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: w.sessionId, club }),
      });
      const b = (await r.json().catch(() => null)) as { ok?: boolean; absent?: boolean; error?: string } | null;
      if (b?.ok) return onDone(b.absent ? "absent" : "answered");
      // the account's session has ended: the page drawn again asks with whatever the cookie holds now
      if (b?.error === "signin") return window.location.reload();
    } catch { /* offline: say so below */ }
    setFail(true);
    setBusy(false);
  }

  return (
    <div className="rg-gate sg-gate ev-blood">
      <div ref={box} className="rg-box sg-box" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-sub`} tabIndex={-1}>
        <p className="rg-kicker sg-kicker">{d.kicker}</p>
        <h2 id={`${id}-title`} className="rg-title">{d.q}</h2>
        <div className="wg-sess">
          <p className="wg-ev"><bdi>{w.name}</bdi></p>
          <p className="wg-ln"><span>{w.when}</span></p>
        </div>
        <p id={`${id}-sub`} className="wg-sub">{d.sub}</p>
        <input className="cg-in" type="text" maxLength={80} autoComplete="off" value={v} placeholder={d.ph} aria-label={d.q} disabled={busy}
          onChange={(e) => { setV(e.target.value); setBad(false); setFail(false); }} />
        {bad && <p className="wg-err" role="alert">{d.err}</p>}
        {fail && <p className="wg-err" role="alert">{tx("It could not be sent. Check the connection and try again.", "تعذّر الإرسال. تحقق من الاتصال وحاول مجدداً.")}</p>}
        <button type="button" className="wg-btn" disabled={busy} onClick={() => void send(false)}>
          {busy && <span className="sg-spin" aria-hidden="true" />}
          {busy ? tx("Sending…", "جارٍ الإرسال…") : d.save}
        </button>
        <button type="button" className="cg-none" disabled={busy} onClick={() => void send(true)}>{d.none}</button>
        <button type="button" className="wg-out" onClick={() => { setOut(true); signOut(); }} disabled={out || busy}>{tx("Sign out", "تسجيل الخروج")}</button>
      </div>
    </div>
  );
}
