"use client";

import { useState, type ReactNode } from "react";
import { useL, useTxLocale } from "@/i18n/TxProvider";
import { fill } from "@/i18n/tx";
import { NOTE_MAX, REASON_MAX, RG_FORMS, RG_LOW, questionKeys, questionTree, ratingErrors, type RatingForm as Form } from "@/lib/rating";
import { ratingWords, type RatingWords } from "./RatingForm.words";

// The post-ride rating's questions, as the booking app asks them (lib/rating.ts): each question a
// 1-10 scale, a sub-question indented under its main one, each main question and its subs in one
// box; a score of 8 or under opens a box asking why, which is then required. The breakfast box has
// its own "I did not stay for breakfast". It goes to /api/account/rate with the account cookie.
// RateRide (a card on My Account) and RatingGate (the pop-up a rider cannot skip) both use it.
// Under the breakfast heading, one quiet line says those answers may reach the restaurant without
// the rider's name (staff share them with the vendor, vendor_shared_ratings_mine): a site text, so
// it is translated through src/i18n/tx like any other.
type Props = {
  entryId: string; form: Form; noBike: boolean;
  /** Called once the rating has landed. */
  onRated: (t: RatingWords) => void;
  /** Under the send button: the gate's sign-out. */
  footer?: ReactNode;
};

export default function RatingForm({ entryId, form, noBike, onRated, footer }: Props) {
  const t = ratingWords(useTxLocale());
  const tx = useL();
  const [s, setS] = useState<Record<string, number>>({});
  const [why, setWhy] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [skipBf, setSkipBf] = useState(false);
  const [err, setErr] = useState<Record<string, "pick" | "why">>({});
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const id = (k: string) => `rg-${entryId}-${k}`;
  const opts = { noBike, skipBf };
  const tree = questionTree(form, opts);

  const pick = (k: string, v: number) => {
    setS((cur) => ({ ...cur, [k]: v }));
    setErr((cur) => {
      if (!cur[k] || (cur[k] === "why" && v <= RG_LOW && !(why[k] ?? "").trim())) return cur;
      const next = { ...cur };
      delete next[k];
      return next;
    });
  };
  const reason = (k: string, v: string) => {
    setWhy((cur) => ({ ...cur, [k]: v }));
    if (v.trim()) setErr((cur) => { if (!cur[k]) return cur; const next = { ...cur }; delete next[k]; return next; });
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setFail("");
    const keys = questionKeys(form, opts);
    const errs = ratingErrors(keys, s, why);
    setErr(errs);
    const first = keys.find((k) => errs[k]);
    if (first) {
      // the first question still to answer, in view and focused (its reason box, else its scale)
      requestAnimationFrame(() => {
        const q = document.getElementById(id(first));
        q?.scrollIntoView({ block: "center", behavior: "smooth" });
        (q?.querySelector<HTMLElement>("textarea") ?? q?.querySelector<HTMLElement>("button"))?.focus({ preventScroll: true });
      });
      return;
    }
    const sent: Record<string, number> = {}, reasons: Record<string, string> = {};
    for (const k of keys) {
      sent[k] = s[k];
      const w = (why[k] ?? "").trim();
      if (s[k] <= RG_LOW && w) reasons[k] = w.slice(0, REASON_MAX);
    }
    setBusy(true);
    try {
      const r = await fetch("/api/account/rate", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ entryId, form, s: sent, why: reasons, skipBf: form === "social" && skipBf, note: note.trim() }),
      });
      const b = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (b.ok) { onRated(t); return; }
      setFail(t.errors[(b.error || "") as keyof RatingWords["errors"]] || t.errors.generic);
    } catch {
      setFail(t.errors.generic);
    }
    setBusy(false);
  }

  const question = (k: string, sub: boolean) => {
    const v = s[k] || 0, e = err[k];
    return (
      <div key={k} id={id(k)} className={`rg-q${sub ? " rg-sub" : ""}${e ? " err" : ""}`}>
        <div className="rg-lbl" id={`${id(k)}-l`}>{t.q[k] ?? k}</div>
        {k === "breakfast" && !sub && (
          <p className="rg-share">{tx("Your breakfast answers may be shared with the restaurant, without your name.", "قد نشارك إجاباتك عن الإفطار مع المطعم، دون ذكر اسمك.")}</p>
        )}
        <div className="rg-scale" role="group" aria-labelledby={`${id(k)}-l`}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" className={v === n ? "on" : ""} aria-pressed={v === n} onClick={() => pick(k, n)}>{n}</button>
          ))}
        </div>
        {v > 0 && v <= RG_LOW && (
          <>
            <label className="rg-why-l" htmlFor={`${id(k)}-w`}>{fill(t.why, v)}</label>
            <textarea id={`${id(k)}-w`} className="rg-why" rows={2} maxLength={REASON_MAX} value={why[k] ?? ""} onChange={(ev) => reason(k, ev.target.value)} aria-invalid={e === "why" || undefined} />
          </>
        )}
        {e && <p className="ac-err" role="alert">{e === "why" ? t.whyErr : t.pickErr}</p>}
      </div>
    );
  };

  return (
    <form className="rg-form" onSubmit={submit} noValidate>
      <p className="rg-sub-text">{t.sub}</p>
      <div className="rg-list">
        {RG_FORMS[form].map(([k]) => {
          const q = tree.find((x) => x[0] === k);
          const skip = k === "breakfast" ? (
            <button type="button" className={`rg-skip${skipBf ? " on" : ""}`} aria-pressed={skipBf} onClick={() => setSkipBf((x) => !x)}>
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><rect x="1.5" y="1.5" width="13" height="13" rx="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />{skipBf && <path d="M4.5 8.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}</svg>
              {t.skipBf}
            </button>
          ) : null;
          if (!q) return skip ? <div key={k} className="rg-grp"><div className="rg-lbl">{t.q[k]}</div>{skip}</div> : null;
          return <div key={k} className="rg-grp">{question(k, false)}{q[1].map((x) => question(x, true))}{skip}</div>;
        })}
      </div>
      <label className="rr-note">{t.note}<textarea value={note} onChange={(ev) => setNote(ev.target.value)} maxLength={NOTE_MAX} rows={3} /></label>
      {fail && <p className="ac-err" role="alert">{fail}</p>}
      <button type="submit" className="rr-send" disabled={busy}>{busy ? t.sending : t.send}</button>
      {footer}
    </form>
  );
}
