"use client";

import "./emergency.css";
import "./sport.css";
import { useState } from "react";
import { useL, useTxLocale } from "@/i18n/TxProvider";
import { SP_OTHER, spClean, spName, spOtherClean, spProblem, type SportAnswer, type SportOption } from "@/lib/sport";
import SportFields from "./SportFields";
import { sportWords } from "./Sport.words";

type Problem = "pick" | "feds" | "other";

// My Account's sport card, for every account (the booking app's own, 2026-11-10): an answer reads as one line - No, or
// Yes and what they compete in, Other as the words they wrote - with Change; no answer (or Change) is the question
// (SportFields) with Save, and Cancel when there was an answer. The page reads the stored answer and the sports staff
// added to the list server-side (customer_sport, sport_option_list) and leaves the card out while the database has no
// such function; Save posts to /api/account/sport. A Community member who has not answered meets the pop-up (SportGate)
// first. Its frame and button are the blood type card's (bt-card, ac-go).
export default function SportCard({ initial, added }: { initial: SportAnswer; added: readonly SportOption[] }) {
  const tx = useL();
  const locale = useTxLocale();
  const w = sportWords(locale);
  const [held, setHeld] = useState<SportAnswer>(initial);
  const [edit, setEdit] = useState(initial.competes === null);
  const [v, setV] = useState<SportAnswer>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [bad, setBad] = useState<Problem | null>(null);
  const [ok, setOk] = useState(false);
  const failed = () => tx("It could not be sent. Check the connection and try again.", "تعذّر الإرسال. تحقق من الاتصال وحاول مجدداً.");
  const say = (p: Problem) => { setBad(p); setErr(p === "pick" ? w.errPick : p === "other" ? w.errOther : w.errFeds); };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErr(""); setBad(null); setOk(false);
    const feds = spClean(v.feds, added);
    const p = spProblem({ ...v, feds });
    if (p) return say(p);
    const other = v.competes && feds.includes(SP_OTHER) ? spOtherClean(v.other) : null;
    setBusy(true);
    try {
      const r = await fetch("/api/account/sport", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ competes: v.competes, federations: v.competes ? feds : [], other }),
      });
      const b = (await r.json().catch(() => null)) as { ok?: boolean; error?: string; problem?: Problem } | null;
      if (b?.ok) {
        const now = { competes: v.competes, feds: v.competes ? feds : [], other: other ?? "" };
        setHeld(now); setV(now); setEdit(false); setOk(true);
        return;
      }
      // the account's session has ended: the page drawn again is signed out
      if (b?.error === "signin") return window.location.reload();
      if (b?.error === "refused") return say(b.problem ?? "feds");
      setErr(b?.error === "busy" ? tx("Too many tries. Please wait a few minutes and try again.", "محاولات كثيرة. انتظر بضع دقائق ثم حاول مجددًا.") : failed());
    } catch {
      setErr(failed());
    } finally { setBusy(false); }
  }

  if (!edit && held.competes !== null) {
    return (
      <div className="bt-card sp-card">
        <div className="sp-held">
          <div className="sp-held-txt">
            <p className="sp-held-yn">{held.competes ? w.yes : w.no}</p>
            {held.competes && <p className="sp-held-feds">{held.feds.map((c) => (c === SP_OTHER ? held.other || w.other : spName(c, locale, added))).join(" · ")}</p>}
          </div>
          <button type="button" className="sp-change" onClick={() => { setV(held); setEdit(true); setOk(false); setErr(""); setBad(null); }}>{w.change}</button>
        </div>
        {ok && <p className="bt-ok" role="status">{w.saved}</p>}
      </div>
    );
  }
  return (
    <form className="bt-card sp-card" onSubmit={save} noValidate>
      <p id="ac-sp-ask" className="sp-ask">{w.ask}</p>
      <SportFields value={v} w={w} locale={locale} id="ac-sp" labelledBy="ac-sp-ask" added={added} disabled={busy} problem={bad === "pick" ? null : bad}
        onChange={(a) => { setV(a); setErr(""); setBad(null); setOk(false); }} />
      {err && <p className="eg-err" role="alert">{err}</p>}
      <div className="sp-btns">
        <button type="submit" className="ac-go bt-save" disabled={busy}>
          {busy ? tx("Saving…", "جارٍ الحفظ…") : w.save}
        </button>
        {held.competes !== null && (
          <button type="button" className="sp-change" disabled={busy} onClick={() => { setV(held); setEdit(false); setErr(""); setBad(null); }}>{w.cancel}</button>
        )}
      </div>
    </form>
  );
}
