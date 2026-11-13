"use client";

import "./rating.css";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTxLocale } from "@/i18n/TxProvider";
import { Link } from "@/i18n/navigation";
import Medal from "./Medal";
import RatingForm from "./RatingForm";
import { ratingWords } from "./RatingForm.words";
import { ratingFinWords } from "./RatingFin.words";
import { signOut } from "./quiet";
import { challengeName, hubMarks, type Fin } from "@/lib/hub";
import type { RatingForm as Form } from "@/lib/rating";

// The post-ride rating as a page the rider cannot skip, as the booking app shows it (2026-10-03):
// once a ride is checked out or its bike returned, the next time the rider opens My Account this
// asks them to rate it and stays up until they do - no close, no backdrop, no Escape; signing out
// is the only other way off. The rest of the page is made inert while it is up. Once the rating
// lands it thanks the rider and the page is drawn again, which brings the next unrated ride (the
// page keys this by its entry, so the next one starts empty), or nothing. `restaurant`: where the
// ride's breakfast was, which the form's breakfast box names (RatingForm).
// The last screen (2026-11-13, the booking app's _rgFinHtml, the Community tab reach build's R5): once the last ride
// waiting is rated, a Community member with something to show gets one more screen in the same pop-up instead of the
// next page: a badge just earned, else the month's challenge this ride moved, else the season challenge, with Community
// (the members' area, /club) and Done, and no sentence. /api/account/rating-fin decides; the thank-you shows while it
// answers, and with nothing to show the pop-up closes as before.
type Props = { entryId: string; name: string; when: string; form: Form; noBike: boolean; restaurant?: string | null; rgLow?: number; run?: boolean; session?: boolean; onDone?: () => void };

const FIN_KINDS = new Set(["badge", "me", "goal"]);
/** The last screen for this rating, or null: nothing to show, or no answer within eight seconds. */
async function askFin(entryId: string, locale: string): Promise<Fin | null> {
  const stop = new AbortController(), timer = window.setTimeout(() => stop.abort(), 8000);
  try {
    const r = await fetch("/api/account/rating-fin", { method: "POST", cache: "no-store", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ entryId, locale }), signal: stop.signal });
    if (!r.ok) return null;
    const f = ((await r.json()) as { fin?: Fin | null }).fin;
    return f && FIN_KINDS.has(f.k) && (f.k === "badge" || (f.tg > 0 && f.n >= 0)) ? f : null;
  } catch { return null; } finally { window.clearTimeout(timer); }
}

/** The challenge's progress, as the Community tab draws it: dots up to five, a bar above that, and "3 / 4". */
function FinProgress({ n, tg, labelledBy }: { n: number; tg: number; labelledBy: string }) {
  const v = Math.min(Math.max(0, n), tg), m = hubMarks(v, tg), txt = `${v} / ${tg}`;
  return (
    <div className="rg-fin-p" role="progressbar" aria-valuemin={0} aria-valuemax={tg} aria-valuenow={v} aria-valuetext={txt} aria-labelledby={labelledBy}>
      {"dots" in m
        ? <span className="hp-dots" aria-hidden="true">{m.dots.map((c, i) => <i key={i} className={c || undefined} />)}</span>
        : <span className="hp-bar" aria-hidden="true"><i className="on" style={{ width: `${m.bar.on.toFixed(1)}%` }} /></span>}
      <bdi className="rg-fin-n" dir="ltr">{txt}</bdi>
    </div>
  );
}

export default function RatingGate({ entryId, name, when, form, noBike, restaurant, rgLow, run, session, onDone }: Props) {
  const locale = useTxLocale();
  const t = ratingWords(locale), fw = ratingFinWords(locale);
  // a run says run, a session without a bike says session, a ride says ride (lib/rating.ts rideWord)
  const head = run ? t.run : session ? t.session : t;
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const [thanks, setThanks] = useState("");
  const [out, setOut] = useState(false);
  const [fin, setFin] = useState<Fin | null>(null);
  const later = useRef(0); // the thank-you's timer, cleared if the pop-up goes first
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; window.clearTimeout(later.current); }; }, []);
  const finish = () => (onDone ? onDone() : router.refresh());
  // the thank-you for 1.2 seconds at least, while the last screen is asked for; then that screen, or the pop-up goes
  const rated = (thx: string) => {
    setThanks(thx);
    const from = Date.now();
    void askFin(entryId, locale).then((f) => {
      if (!live.current) return;
      later.current = window.setTimeout(() => (f ? setFin(f) : finish()), Math.max(0, 1200 - (Date.now() - from)));
    });
  };
  useEffect(() => { if (fin) box.current?.focus({ preventScroll: true }); }, [fin]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    // Everything but this pop-up, at every level up to <body>, is made inert: no focus, no clicks.
    const made: Element[] = [];
    for (let n: Element | null = el.closest(".rg-gate"); n && n !== document.body; n = n.parentElement) {
      for (const sib of Array.from(n.parentElement?.children ?? [])) {
        if (sib !== n && !sib.hasAttribute("inert") && sib.tagName !== "SCRIPT") { sib.setAttribute("inert", ""); made.push(sib); }
      }
    }
    document.documentElement.classList.add("rg-lock");
    el.focus({ preventScroll: true });
    return () => {
      for (const sib of made) sib.removeAttribute("inert");
      document.documentElement.classList.remove("rg-lock");
    };
  }, []);

  const leave = () => {
    setOut(true);
    signOut();
  };

  if (fin) {
    const title = fin.k === "me" ? challengeName(fin.kind, fin.tg, fw) : fin.name;
    return (
      <div className="rg-gate">
        <div ref={box} className="rg-box rg-fin" role="dialog" aria-modal="true" aria-labelledby={`rg-title-${entryId}`} tabIndex={-1}>
          {fin.k === "badge" && <><p className="rg-fin-k">{fw.badge}</p><Medal icon={fin.icon} color={fin.color} className="rg-fin-medal" /></>}
          <h2 id={`rg-title-${entryId}`} className="rg-title rg-fin-t"><bdi>{title}</bdi></h2>
          {fin.k !== "badge" && <FinProgress n={fin.n} tg={fin.tg} labelledBy={`rg-title-${entryId}`} />}
          <Link href="/club" className="rr-send rg-fin-go" onClick={finish}>{fw.community}</Link>
          <button type="button" className="rg-fin-done" onClick={finish}>{fw.done}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="rg-gate">
      <div ref={box} className="rg-box" role="dialog" aria-modal="true" aria-labelledby={`rg-title-${entryId}`} tabIndex={-1}>
        <p className="rg-kicker">
          <span className="rg-flag" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="12" height="12"><path d="M12 2.8l2.75 5.6 6.15.9-4.45 4.33 1.05 6.12L12 16.86l-5.5 2.9 1.05-6.13L3.1 9.3l6.15-.9z" fill="currentColor" /></svg>
          </span>
          {head.kicker}
        </p>
        <h2 id={`rg-title-${entryId}`} className="rg-title">{head.title}</h2>
        <p className="rg-meta"><bdi>{name}</bdi> · <bdi>{when}</bdi></p>
        {thanks ? (
          <p className="rr-thanks" role="status">{thanks}</p>
        ) : (
          <RatingForm entryId={entryId} form={form} noBike={noBike} restaurant={restaurant} rgLow={rgLow} run={run} session={session}
            onRated={(w) => rated(w.thanks)}
            footer={<button type="button" className="rg-out" onClick={leave} disabled={out}>{t.signOut}</button>} />
        )}
      </div>
    </div>
  );
}
