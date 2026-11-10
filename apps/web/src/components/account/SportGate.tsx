"use client";

import "./rating.css";
import "./waiver.css";
import "./sport.css";
import { useEffect, useRef, useState } from "react";
import { useL, useTxLocale } from "@/i18n/TxProvider";
import { SP_OTHER, spClean, spOtherClean, spProblem, type SportAnswer, type SportOption } from "@/lib/sport";
import SportFields from "./SportFields";
import { sportWords } from "./Sport.words";
import { signOut } from "./quiet";

// Whether the rider competes in a sport, as a pop-up a Community member who has not answered cannot skip (the user,
// 2026-11-10: "force it on community members the next time they open or sign in the website"; the booking app's own
// pop-up, _fixSpHtml): the question, Yes and No. No saves at once; Yes opens what they compete in (SportFields: the
// user's list, the sports staff added, Other and its box) and Save.
// No close, no backdrop, no Escape, moving about keeps it; signing out is the only other way off. The rest of the page
// is made inert while it is up. Its frame is the rating gate's (rating.css), its buttons the waiver gate's (waiver.css).
/** saved: the database has it · absent: the database cannot store it yet (let through). */
export type SportDone = "saved" | "absent";

export default function SportGate({ added, onDone }: { added: readonly SportOption[]; onDone: (r: SportDone) => void }) {
  const tx = useL();
  const locale = useTxLocale();
  const w = sportWords(locale);
  const box = useRef<HTMLDivElement>(null);
  const [v, setV] = useState<SportAnswer>({ competes: null, feds: [], other: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [bad, setBad] = useState<"pick" | "feds" | "other" | null>(null);
  const [out, setOut] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    // Everything but this pop-up, at every level up to <body>, is made inert: no focus, no clicks.
    const made: Element[] = [];
    for (let n: Element | null = el.closest(".spg-gate"); n && n !== document.body; n = n.parentElement) {
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

  const failed = () => tx("It could not be sent. Check the connection and try again.", "تعذّر الإرسال. تحقق من الاتصال وحاول مجدداً.");
  async function send(a: SportAnswer) {
    if (busy) return;
    setErr(""); setBad(null);
    const feds = spClean(a.feds, added);
    const say = (p: "pick" | "feds" | "other") => { setBad(p); setErr(p === "pick" ? w.errPick : p === "other" ? w.errOther : w.errFeds); };
    const p = spProblem({ ...a, feds });
    if (p) return say(p);
    setBusy(true);
    try {
      const r = await fetch("/api/account/sport", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ competes: a.competes, federations: a.competes ? feds : [], other: a.competes && feds.includes(SP_OTHER) ? spOtherClean(a.other) : null }),
      });
      const b = (await r.json().catch(() => null)) as { ok?: boolean; error?: string; problem?: "pick" | "feds" | "other" } | null;
      if (b?.ok) return onDone("saved");
      if (b?.error === "absent") return onDone("absent");
      // the account's session has ended: the page drawn again asks with whatever the cookie holds now
      if (b?.error === "signin") return window.location.reload();
      if (b?.error === "refused") { say(b.problem ?? "feds"); setBusy(false); return; }
      setErr(b?.error === "busy" ? tx("Too many tries. Please wait a few minutes and try again.", "محاولات كثيرة. انتظر بضع دقائق ثم حاول مجددًا.") : failed());
    } catch {
      setErr(failed());
    }
    setBusy(false);
  }

  const leave = () => { setOut(true); signOut(); };

  return (
    <div className="rg-gate spg-gate">
      <div ref={box} className="rg-box spg-box" role="dialog" aria-modal="true" aria-labelledby="spg-title" tabIndex={-1}>
        <span className="spg-ic" aria-hidden="true">
          {/* a medal on its ribbon, drawn */}
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2.5h3l2 5M16 2.5h-3l-1.2 3" />
            <circle cx="12" cy="15" r="6.5" />
            <path d="m12 11.6 1.05 2.15 2.35.33-1.7 1.66.4 2.34L12 17l-2.1 1.08.4-2.34-1.7-1.66 2.35-.33L12 11.6Z" />
          </svg>
        </span>
        <h2 id="spg-title" className="rg-title">{w.ask}</h2>
        <form onSubmit={(e) => { e.preventDefault(); void send(v); }} noValidate className="spg-form">
          <SportFields value={v} w={w} locale={locale} id="spg" labelledBy="spg-title" added={added} disabled={busy} problem={bad === "pick" ? null : bad}
            onChange={(a) => { setV(a); setErr(""); setBad(null); }} onNo={() => void send({ competes: false, feds: [], other: "" })} />
          {err && <p className="wg-err" role="alert">{err}</p>}
          {v.competes === true && (
            <button type="submit" className="wg-btn spg-save" disabled={busy}>
              {busy && <span className="sg-spin" aria-hidden="true" />}
              {busy ? tx("Saving…", "جارٍ الحفظ…") : w.save}
            </button>
          )}
          {busy && v.competes === false && <p className="spg-busy" role="status"><span className="sg-spin" aria-hidden="true" />{tx("Saving…", "جارٍ الحفظ…")}</p>}
        </form>
        <button type="button" className="wg-out" onClick={leave} disabled={out || busy}>{tx("Sign out", "تسجيل الخروج")}</button>
      </div>
    </div>
  );
}
