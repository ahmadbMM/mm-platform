"use client";

import "./rating.css";
import "./waiver.css";
import "./emergency.css";
import { useEffect, useRef, useState } from "react";
import { useL, useTxLocale } from "@/i18n/TxProvider";
import { EM_EMPTY, emReadBoth, type EmFields } from "@/lib/emergency";
import EmergencyFields, { type EmLook, type EmProblem } from "./EmergencyFields";
import { emergencyWords } from "./Emergency.words";
import { signOut } from "./quiet";

// The account's emergency contact, as a page the rider cannot skip (the owner, 2026-10-07: "make the
// emergency contact obligatory only the first one not the second and unskippable for all the
// customers"; the booking app's check-up, emReqTitle / emReqSub): an account without one gives it here,
// with an optional second one behind "Add a second contact", and Save. No close, no backdrop, no
// Escape, moving about keeps it; signing out is the only other way off. The rest of the page is made
// inert while it is up. Its frame is the rating gate's (rating.css), its buttons the waiver gate's
// (waiver.css), its boxes EmergencyFields.
/** saved: the database has it · absent: the database cannot store it yet (let through). */
export type EmDone = "saved" | "absent";

const LOOK: EmLook = { block: "eg-block", head: "eg-h", sub: "eg-sub", field: "eg-field", input: "eg-input", select: "eg-input", ph: "eg-ph", err: "eg-err", add: "eg-add", opt: "eg-opt" };

export default function EmergencyGate({ two: offerTwo, onDone }: { two: boolean; onDone: (r: EmDone) => void }) {
  const tx = useL();
  const w = emergencyWords(useTxLocale());
  const box = useRef<HTMLDivElement>(null);
  const [one, setOne] = useState<EmFields>(EM_EMPTY);
  const [two, setTwo] = useState<EmFields>(EM_EMPTY);
  const [problem, setProblem] = useState<EmProblem>(null);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const [out, setOut] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    // Everything but this pop-up, at every level up to <body>, is made inert: no focus, no clicks.
    const made: Element[] = [];
    for (let n: Element | null = el.closest(".eg-gate"); n && n !== document.body; n = n.parentElement) {
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

  // The box with the problem gets the keyboard.
  useEffect(() => {
    if (!problem) return;
    const el = box.current?.querySelector<HTMLElement>("[aria-invalid='true']");
    el?.scrollIntoView({ block: "center" });
    el?.focus({ preventScroll: true });
  }, [problem]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setFail("");
    const c = emReadBoth(one, offerTwo ? two : null, "");
    if ("error" in c) return setProblem(c);
    setBusy(true);
    try {
      const r = await fetch("/api/account/emergency", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ one, two: offerTwo ? two : null }),
      });
      const b = (await r.json().catch(() => null)) as { ok?: boolean; absent?: boolean; error?: string; problem?: EmProblem } | null;
      if (b?.ok) return onDone(b.absent ? "absent" : "saved");
      if (b?.error === "refused" && b.problem) { setProblem(b.problem); return; }
      // the account's session has ended: the page drawn again asks with whatever the cookie holds now
      if (b?.error === "signin") return window.location.reload();
      setFail(b?.error === "busy" ? tx("Too many tries. Please wait a few minutes and try again.", "محاولات كثيرة. انتظر بضع دقائق ثم حاول مجددًا.") : tx("It could not be sent. Check the connection and try again.", "تعذّر الإرسال. تحقق من الاتصال وحاول مجدداً."));
    } catch {
      setFail(tx("It could not be sent. Check the connection and try again.", "تعذّر الإرسال. تحقق من الاتصال وحاول مجدداً."));
    } finally { setBusy(false); }
  }

  const leave = () => {
    setOut(true);
    signOut();
  };

  return (
    <div className="rg-gate eg-gate">
      <div ref={box} className="rg-box eg-box" role="dialog" aria-modal="true" aria-labelledby="eg-title" aria-describedby="eg-sub" tabIndex={-1}>
        <p className="rg-kicker eg-kicker">
          <span className="rg-flag" aria-hidden="true">
            {/* a telephone handset, drawn */}
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
            </svg>
          </span>
          {w.title}
        </p>
        <h2 id="eg-title" className="rg-title">{w.reqTitle}</h2>
        <p id="eg-sub" className="wg-sub">{w.reqSub}</p>
        <form onSubmit={save} noValidate className="eg-form">
          <EmergencyFields one={one} two={two} onChange={(a, b) => { setOne(a); setTwo(b); setProblem(null); setFail(""); }} offerTwo={offerTwo} problem={problem} look={LOOK} head={false} />
          {fail && <p className="wg-err" role="alert">{fail}</p>}
          <button type="submit" className="wg-btn eg-save" disabled={busy}>
            {busy && <span className="sg-spin" aria-hidden="true" />}
            {busy ? tx("Saving…", "جارٍ الحفظ…") : w.save}
          </button>
        </form>
        <button type="button" className="wg-out" onClick={leave} disabled={out || busy}>{tx("Sign out", "تسجيل الخروج")}</button>
      </div>
    </div>
  );
}
