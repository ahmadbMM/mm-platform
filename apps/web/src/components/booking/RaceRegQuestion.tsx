"use client";

import { useState } from "react";
import { raceRegView, type RaceRegAnswer } from "@/lib/race-reg";
import { DEFE_RACE_CODE } from "@/lib/tickets";

// "Have you registered for the race?" on a booked DEFE 5KM Run place (the owner, 2026-10-18), as the
// booking app's ticket asks it (_defeRegHtml): Yes, or No, the members' discount code and the way to
// Defe's registration page, where the race itself is entered. Yes leaves "You told us you are registered for the race." with Change. The answer
// is saved on the booking through /api/account/race-reg (customer_set_race_reg) and shows at once; a
// save that fails puts the last answer back and says so. The place is booked whatever the answer.
// Its words come ready in the page's language from the ticket (tickets.text.ts).
export type RaceRegText = {
  q: string; sub: string; noNote: string; code: string; link: string; yesNote: string; yes: string; no: string; change: string; failed: string;
};

const Tick = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
);

export default function RaceRegQuestion({ entryId, initial, url, t }: { entryId: string; initial: RaceRegAnswer | null; url: string; t: RaceRegText }) {
  const [answer, setAnswer] = useState<RaceRegAnswer | null>(initial);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const qId = `tk-rr-q-${entryId}`;

  async function set(v: RaceRegAnswer) {
    if (busy) return;
    const was = answer;
    setAnswer(v); setErr(""); setBusy(true);
    if (v === "yes") setAsking(false);
    try {
      const r = await fetch("/api/account/race-reg", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ entryId, answer: v }),
      });
      const b = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (b?.ok) return;
      // signed out, or the booking is no longer one the question is for: the page drawn again says so
      if (b?.error === "signin" || b?.error === "refused") { window.location.reload(); return; }
      setAnswer(was); setErr(t.failed);
    } catch {
      setAnswer(was); setErr(t.failed);
    } finally { setBusy(false); }
  }

  const view = raceRegView(answer, asking);
  if (view === "done") {
    return (
      <div className="tk-rr tk-rr-done" role="status">
        <Tick /><span>{t.yesNote}</span>
        <button type="button" onClick={() => setAsking(true)}>{t.change}</button>
      </div>
    );
  }
  const btn = (v: RaceRegAnswer, label: string) => (
    <button type="button" aria-pressed={answer === v} disabled={busy} onClick={() => set(v)}>{label}</button>
  );
  return (
    <div className="tk-rr" role="group" aria-labelledby={qId}>
      <p className="tk-rr-q" id={qId}>{t.q}</p>
      <p className="tk-rr-sub">{t.sub}</p>
      <div className="tk-rr-yn">{btn("yes", t.yes)}{btn("no", t.no)}</div>
      {view === "askNo" && (
        <div className="tk-rr-no">
          <p className="tk-rr-sub">{t.noNote}</p>
          {/* the discount code, bold and left to right in every language (the booking app's defe-reg-code) */}
          <p className="tk-rr-code">{((parts) => <>{parts[0]}<strong dir="ltr">{DEFE_RACE_CODE}</strong>{parts[1] ?? ""}</>)(t.code.split("{0}"))}</p>
          <a className="tk-rr-link" href={url} target="_blank" rel="noopener">{t.link}</a>
        </div>
      )}
      {err && <p className="tk-rr-err" role="alert">{err}</p>}
    </div>
  );
}
