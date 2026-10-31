"use client";

import "./rating.css";
import "./waiver.css";
import "./question-gate.css";
import { useEffect, useRef, useState } from "react";
import { useL } from "@/i18n/TxProvider";
import { ANSWER_MAX, type RiderQuestion } from "@/lib/rider-question";

// A question staff put on one rider's account, as a pop-up with a box for the answer (2026-11-01; the
// booking app's renderRiderQ): the question in the staff's own words, the box, Send, and Later under it.
// Send saves the answer once and thanks the rider; Later lets this visit through (the next visit asks
// again until it is answered). The rest of the page is inert while it is up. The answer goes through
// POST /api/account/question.
/** sent: answered · later: passed for this visit · stale: no longer open (answered elsewhere): ask for the next. */
export type QuestionDone = "sent" | "later" | "stale";

export default function QuestionGate({ id, question, onDone }: RiderQuestion & { onDone: (r: QuestionDone) => void }) {
  const tx = useL();
  const box = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [empty, setEmpty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState(false);
  const [sent, setSent] = useState(false);
  const key = `rdq-${id}`;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    // Everything but this pop-up, at every level up to <body>, is made inert: no focus, no clicks.
    const made: Element[] = [];
    for (let n: Element | null = el.closest(".rdq-gate"); n && n !== document.body; n = n.parentElement) {
      for (const sib of Array.from(n.parentElement?.children ?? [])) {
        if (sib !== n && !sib.hasAttribute("inert") && sib.tagName !== "SCRIPT") { sib.setAttribute("inert", ""); made.push(sib); }
      }
    }
    document.documentElement.classList.add("wg-lock");
    area.current?.focus({ preventScroll: true });
    return () => {
      for (const sib of made) sib.removeAttribute("inert");
      document.documentElement.classList.remove("wg-lock");
    };
  }, []);

  async function send() {
    if (busy) return;
    const v = text.trim();
    if (!v) { setEmpty(true); area.current?.focus(); return; }
    setFail(false); setBusy(true);
    try {
      const r = await fetch("/api/account/question", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, answer: v.slice(0, ANSWER_MAX) }),
      });
      const b = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (b?.ok) { setBusy(false); setSent(true); box.current?.focus({ preventScroll: true }); return; }
      // answered already (another device), or no longer this account's: nothing left to ask here
      if (b?.error === "refused") return onDone("stale");
      // the account's session has ended: the page drawn again asks with whatever the cookie holds now
      if (b?.error === "signin") return window.location.reload();
    } catch { /* offline: say so below */ }
    setFail(true); setBusy(false);
  }

  return (
    <div className="rg-gate rdq-gate">
      <div ref={box} className="rg-box rdq-box" role="dialog" aria-modal="true" aria-labelledby={`${key}-title`} aria-describedby={`${key}-q`} tabIndex={-1}>
        <h2 id={`${key}-title`} className="rg-title">{tx("A question for you", "سؤال لك")}</h2>
        <p id={`${key}-q`} className="rdq-q" dir="auto">{question}</p>
        {sent ? (
          <>
            <p className="rdq-thanks" role="status">{tx("Thank you, your answer is sent.", "شكراً لك، تم إرسال إجابتك.")}</p>
            <button type="button" className="wg-btn" onClick={() => onDone("sent")}>{tx("Close", "إغلاق")}</button>
          </>
        ) : (
          <>
            <label className="rdq-lbl" htmlFor={`${key}-a`}>{tx("Your answer", "إجابتك")}</label>
            <textarea
              ref={area} id={`${key}-a`} className="rdq-a" rows={4} maxLength={ANSWER_MAX} value={text} disabled={busy}
              placeholder={tx("Type your answer here", "اكتب إجابتك هنا")}
              aria-invalid={empty || undefined} aria-describedby={empty ? `${key}-err` : undefined}
              onChange={(e) => { setText(e.target.value); if (e.target.value.trim()) setEmpty(false); }}
            />
            {empty && <p id={`${key}-err`} className="wg-err" role="alert">{tx("Type your answer first.", "اكتب إجابتك أولاً.")}</p>}
            {fail && <p className="wg-err" role="alert">{tx("It could not be sent. Check the connection and try again.", "تعذّر الإرسال. تحقق من الاتصال وحاول مجدداً.")}</p>}
            <button type="button" className="wg-btn" disabled={busy} onClick={send}>{tx("Send", "إرسال")}</button>
            <button type="button" className="wg-out" disabled={busy} onClick={() => onDone("later")}>{tx("Later", "لاحقاً")}</button>
          </>
        )}
      </div>
    </div>
  );
}
