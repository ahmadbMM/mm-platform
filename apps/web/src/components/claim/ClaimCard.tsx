"use client";

import "./claim.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { clockSkew, clockText, type ClaimState, type ClaimView } from "@/lib/claim";
import { claimWords } from "./ClaimCard.words";

// The waitlist claim card (micromobility.sa/?claim=<token>; the booking app's #wl-claim): one card,
// centred, that reads the offer (/api/claim), counts down the time to claim it on the device's clock
// corrected by the server's, and sends the answer. The database decides: a claim after the time, or
// once the place has gone, comes back as such, and the card says so. At 0 the card ends by itself
// ("This offer has ended"), as the booking app's does.
type Props = { token: string; locale: string; mine: string };

/** /api/claim's view of the offer, or null when it did not come back. */
async function readClaim(token: string, locale: string): Promise<ClaimView | null> {
  try {
    const r = await fetch(`/api/claim?t=${token}&locale=${encodeURIComponent(locale)}`, { cache: "no-store" });
    return r.ok ? ((await r.json()) as ClaimView) : null;
  } catch {
    return null;
  }
}

export default function ClaimCard({ token, locale, mine }: Props) {
  const w = claimWords(locale);
  const [view, setView] = useState<ClaimView | null>(null);
  const [state, setState] = useState<ClaimState>("load");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(false);
  const [left, setLeft] = useState("");
  const skew = useRef(0);
  const lastDecline = useRef(false); // Try again repeats the answer that did not land
  const box = useRef<HTMLDivElement>(null);

  // the offer as the server has it (the card starts as "load"; Try again sets it back first)
  const apply = useCallback((v: ClaimView | null) => {
    if (!v || !v.state) { setState("net"); return; }
    skew.current = clockSkew(v.now ?? undefined, Date.now());
    const c = clockText(v.expiresAt ?? undefined, skew.current, Date.now());
    setView(v);
    setLeft(c);
    setState(v.state === "ask" && !c ? "late" : v.state); // an open offer whose time is already up has ended
  }, []);
  useEffect(() => {
    let live = true;
    readClaim(token, locale).then((v) => { if (live) apply(v); });
    return () => { live = false; };
  }, [token, locale, apply]);
  const again = () => { setState("load"); setRetry(false); readClaim(token, locale).then(apply); };

  // the countdown, once a second while the question is open
  useEffect(() => {
    if (state !== "ask") return;
    const id = setInterval(() => {
      const c = clockText(view?.expiresAt ?? undefined, skew.current, Date.now());
      if (!c) setState("late");
      else setLeft(c);
    }, 1000);
    return () => clearInterval(id);
  }, [state, view]);

  // the card takes focus once it has something to say (a screen reader reads it from the top)
  const shown = useRef(false);
  useEffect(() => {
    if (state !== "load" && !shown.current) { shown.current = true; box.current?.focus({ preventScroll: true }); }
  }, [state]);

  async function answer(decline: boolean) {
    if (busy) return;
    setBusy(true);
    setRetry(false);
    lastDecline.current = decline;
    try {
      const r = await fetch("/api/claim", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ t: token, decline }) });
      const b = r.ok ? ((await r.json()) as { state?: ClaimState; retry?: boolean }) : null;
      if (b?.state) setState(b.state);
      else setRetry(true);
    } catch {
      setRetry(true);
    }
    setBusy(false);
  }

  const title = state === "done" ? w.doneTitle : state === "no" ? w.noTitle : state === "ask" || state === "net" ? w.title : w.lateTitle;
  const sub = state === "done" ? w.doneSub : state === "late" ? w.lateSub : state === "full" ? w.fullSub : state === "no" ? w.noSub : state === "net" ? w.net : w.goneSub;
  return (
    <div className="wlc-wrap">
      <div className="wlc-card" ref={box} tabIndex={-1} role="region" aria-labelledby="wlc-title" aria-busy={state === "load" || undefined}>
        {state === "load" ? (
          <div className="wlc-skel" aria-hidden="true"><span /><span /><span /><span /></div>
        ) : (
          <>
            <p className="wlc-kicker">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              {w.kicker}
            </p>
            <h1 id="wlc-title" className="wlc-title">{title}</h1>
            {view && state !== "gone" && state !== "net" && (view.title || view.when) && (
              <p className="wlc-ride"><bdi>{view.title}</bdi>{view.when && <><br /><bdi>{view.when}</bdi></>}</p>
            )}
            {state === "ask" ? (
              <>
                <p className="wlc-ends">{w.ends} <b dir="ltr" role="timer" aria-live="off">{left}</b></p>
                {retry && <p className="wlc-err" role="alert">{w.net}</p>}
                <button type="button" className="wlc-btn" onClick={() => answer(retry ? lastDecline.current : false)} disabled={busy}>{retry ? w.retry : w.claim}</button>
                <button type="button" className="wlc-link" onClick={() => answer(true)} disabled={busy}>{w.decline}</button>
              </>
            ) : (
              <>
                <p className="wlc-sub">{sub}</p>
                {state === "done" && <a className="wlc-btn" href={mine}>{w.mine}</a>}
                {state === "net" && <button type="button" className="wlc-btn" onClick={again}>{w.retry}</button>}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
