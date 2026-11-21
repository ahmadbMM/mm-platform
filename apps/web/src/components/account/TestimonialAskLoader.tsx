"use client";

import "./rating.css";
import "@/components/testimonials/testimonials.css";
import "./testimonial-ask.css";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useLocalize, useTxLocale } from "@/i18n/TxProvider";
import { T } from "@/components/testimonials/Testimonials.text";
import { ConsentTick, NameChoice, firstChoice } from "@/components/testimonials/TestimonialFields";
import type { TmMine, TmNameMode } from "@/lib/testimonials";
import { tmAskWords } from "./TestimonialAsk.words";
import { TM_ASK_QUIET, isQuiet } from "./quiet";

// The one-time ask about an old comment (the booking app's _tstAskCheck and rider-testimonial.js, dfbfba44, fbd39da1,
// 294f2348): a rider who rated a done ride 9 or 10 before testimonials were switched on, and wrote 40 characters or more,
// is asked once - "May we publish your words?", the ride (its title, else its kind) and its day, their words as written,
// how their name shows and the tick - Publish it or No thanks (testimonial_old_answer through
// /api/account/testimonial-ask). Only while the testimonials switch is on (the database names none otherwise), and only
// once nothing else waits: RatingGateLoader mounts this once no ride waits to be rated. As the app asks it: at most once
// a day on this device, once a week when there was none; an answer, or one the database says is over, ends it here for
// good; a No thanks that did not reach us is asked again another day. The tab asks the server at most once an hour.
type Ask = { who: string; entry: string; body: string; meta: string; mine: TmMine };
const QUIET_MS = 60 * 60_000;
const DAY = 864e5;
const markKey = (who: string) => `mm_tst_ask_${who}`;
const mark = (who: string, o: Record<string, unknown>) => { try { localStorage.setItem(markKey(who), JSON.stringify({ at: Date.now(), ...o })); } catch { /* storage off */ } };
const marked = (who: string): { at?: number; none?: number; done?: number } | null => {
  try { const v = JSON.parse(localStorage.getItem(markKey(who)) || "null") as unknown; return v && typeof v === "object" ? v as { at?: number } : null; } catch { return null; }
};

export default function TestimonialAskLoader({ locale }: { locale: string }) {
  const path = usePathname();
  const [ask, setAsk] = useState<Ask | null>(null);
  useEffect(() => {
    if (ask || isQuiet(TM_ASK_QUIET)) return;
    let live = true;
    (async () => {
      type Got = { signedIn?: boolean; ok?: boolean; who?: string; on?: boolean; ask?: { entry: string; body: string; meta: string } | null; names?: TmMine["names"]; since?: TmMine["since"] };
      let b: Got | null = null;
      try {
        const r = await fetch(`/api/account/testimonial-ask?locale=${encodeURIComponent(locale)}`, { cache: "no-store", credentials: "same-origin" });
        b = r.ok || r.status === 401 ? ((await r.json()) as Got) : null;
      } catch { b = null; }
      if (!live || !b || b.signedIn === false || !b.ok || !b.who) return; // signed out, or no answer: the next page asks again
      try { sessionStorage.setItem(TM_ASK_QUIET, String(Date.now() + QUIET_MS)); } catch { /* storage off */ }
      const m = marked(b.who);
      if (m?.done || (m && Date.now() - (Number(m.at) || 0) < (m.none ? 7 * DAY : DAY))) return;
      if (!b.on) return;
      if (!b.ask) { mark(b.who, { none: 1 }); return; }
      mark(b.who, {});
      setAsk({ who: b.who, ...b.ask, mine: { on: true, names: b.names ?? { full: null, short: null }, since: b.since ?? null, items: [] } });
    })();
    return () => { live = false; };
  }, [path, locale, ask]);
  if (!ask) return null;
  return <TestimonialAsk key={ask.entry} ask={ask} onDone={(ended) => { if (ended) mark(ask.who, { done: 1 }); setAsk(null); }} />;
}

function TestimonialAsk({ ask, onDone }: { ask: Ask; onDone: (ended: boolean) => void }) {
  const t = useLocalize(T);
  const w = tmAskWords(useTxLocale());
  const box = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<TmNameMode>(() => firstChoice(ask.mine.names));
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const later = useRef(0);
  useEffect(() => () => window.clearTimeout(later.current), []);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    // a modal pop-up: everything else on the page is made inert while it is up, as the rating's is
    const made: Element[] = [];
    for (let n: Element | null = el.closest(".rg-gate"); n && n !== document.body; n = n.parentElement) {
      for (const sib of Array.from(n.parentElement?.children ?? [])) {
        if (sib !== n && !sib.hasAttribute("inert") && sib.tagName !== "SCRIPT") { sib.setAttribute("inert", ""); made.push(sib); }
      }
    }
    document.documentElement.classList.add("rg-lock");
    el.focus({ preventScroll: true });
    return () => { for (const sib of made) sib.removeAttribute("inert"); document.documentElement.classList.remove("rg-lock"); };
  }, []);

  async function answer(yes: boolean) {
    if (busy || sent) return;
    if (yes && !consent) { setErr("consent"); return; }
    setBusy(true);
    setErr(null);
    let b: { ok?: boolean; error?: string } | null = null;
    try {
      const r = await fetch("/api/account/testimonial-ask", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ entry: ask.entry, yes, nameMode: mode, consent: yes && consent }),
      });
      b = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    } catch { b = null; }
    setBusy(false);
    if (b?.ok) {
      if (!yes) { onDone(true); return; }
      setSent(true);
      later.current = window.setTimeout(() => onDone(true), 1600);
      return;
    }
    if (!yes && (!b || b.error === "signin" || b.error === "generic")) { onDone(false); return; } // asked again another day
    setErr(b?.error === "name" || b?.error === "consent" || b?.error === "signin" ? b.error : "generic");
  }

  const edit = <V,>(set: (v: V) => void) => (v: V) => { set(v); if (err) setErr(null); };
  return (
    <div className="rg-gate">
      <div ref={box} className="rg-box tm-old" role="dialog" aria-modal="true" aria-labelledby="tm-old-h" tabIndex={-1}>
        <h2 id="tm-old-h" className="rg-title">{w.askT}</h2>
        {ask.meta && <p className="rg-meta"><bdi>{ask.meta}</bdi></p>}
        <blockquote className="tm-old-q" dir="auto">{ask.body}</blockquote>
        {sent ? <p className="rr-thanks" role="status">{t.sent}</p> : (
          <div className="tm-ask">
            <NameChoice mine={ask.mine} value={mode} onChange={edit(setMode)} w={t} disabled={busy} />
            <ConsentTick checked={consent} onChange={edit(setConsent)} w={t} disabled={busy} invalid={err === "consent"} />
            {err && <p className="ac-err" role="alert">{t.errors[err] ?? t.errors.generic}</p>}
            <button type="button" className="rr-send" disabled={busy} onClick={() => answer(true)}>{busy ? t.sending : w.askYes}</button>
            <button type="button" className="rg-fin-done" disabled={busy} onClick={() => answer(false)}>{w.askNo}</button>
          </div>
        )}
      </div>
    </div>
  );
}
