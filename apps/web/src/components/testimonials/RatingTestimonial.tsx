"use client";

import { useEffect, useRef, useState } from "react";
import { useLocalize, useTxLocale } from "@/i18n/TxProvider";
import { TM_ASK_FROM, TM_BODY_MAX, TM_BODY_MIN, tmError, tmMine, tmStarsFromScore, type TmAbout, type TmMine, type TmNameMode } from "@/lib/testimonials";
import { T } from "./Testimonials.text";
import Stars from "./Stars";
import { ConsentTick, NameChoice, Words, firstChoice } from "./TestimonialFields";

// The ask after a high rating (the user's pick, 2026-11-18, as the booking app asks it): once a rating whose headline
// score is 9 or 10 has saved, and only while the launch switch is on, one more step offers to share it as a testimonial
// - the words they wrote with the rating to start from, the stars their score halved, what it is about from the booking,
// how their name shows and the tick that lets MicroMobility publish it. "Not now" skips it; it is sent with source
// 'rating' and the booking's id, so that ride is never asked about again once it has one (the database's "dup").
// RatingGate (the pop-up on every page) and RateRide (a card on My Account) show it.

/** testimonial_mine for the ask, or null: the rating's score is under 9, the switch is off, the rider is signed out, or
 *  no answer came within eight seconds - then nothing is asked. */
export async function askTestimonial(score: number): Promise<TmMine | null> {
  if (!(score >= TM_ASK_FROM)) return null;
  const stop = new AbortController(), timer = window.setTimeout(() => stop.abort(), 8000);
  try {
    const r = await fetch("/api/testimonials/mine", { cache: "no-store", credentials: "same-origin", signal: stop.signal });
    if (!r.ok) return null;
    const mine = tmMine(await r.json());
    return mine?.on ? mine : null;
  } catch { return null; } finally { window.clearTimeout(timer); }
}

type Props = {
  entryId: string; about: TmAbout; score: number; note: string; mine: TmMine;
  /** The step's heading id (the pop-up is labelled by it). */
  headId: string;
  /** Sent or skipped. */
  onDone: () => void;
};

export default function RatingTestimonial({ entryId, about, score, note, mine, headId, onDone }: Props) {
  const t = useLocalize(T);
  const locale = useTxLocale();
  const stars = tmStarsFromScore(score);
  const [body, setBody] = useState(() => note.trim().slice(0, TM_BODY_MAX));
  const [mode, setMode] = useState<TmNameMode>(() => firstChoice(mine.names));
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ key: string; field?: string } | null>(null);
  const [sent, setSent] = useState(false);
  const after = useRef(0);
  useEffect(() => () => window.clearTimeout(after.current), []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (busy || sent) return;
    const words = body.trim();
    if (words.length < TM_BODY_MIN || words.length > TM_BODY_MAX) return setErr({ key: "body", field: "body" });
    if (!consent) return setErr({ key: "consent", field: "consent" });
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/testimonials/send", {
        method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ body: words, stars, about, nameMode: mode, consent, photo: null, source: "rating", entry: entryId, lang: locale }),
      });
      const b = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (b?.ok) {
        setSent(true);
        window.clearTimeout(after.current);
        after.current = window.setTimeout(onDone, 1600);
        return;
      }
      const code = tmError(b?.error);
      setErr({ key: code, field: code });
    } catch {
      setErr({ key: "generic" });
    } finally {
      setBusy(false);
    }
  }

  const edit = <V,>(set: (v: V) => void) => (v: V) => { set(v); if (err) setErr(null); };
  return (
    <form className="tm-ask" onSubmit={send} noValidate>
      <h2 id={headId} className="rg-title">{t.askTitle}</h2>
      <Stars value={stars} label={t.starsOf(String(stars))} size={22} />
      {sent ? <p className="rr-thanks" role="status">{t.sent}</p> : (
        <>
          <Words value={body} onChange={edit(setBody)} w={t} disabled={busy} invalid={err?.field === "body" || err?.field === "link"} />
          <NameChoice mine={mine} value={mode} onChange={edit(setMode)} w={t} disabled={busy} />
          <ConsentTick checked={consent} onChange={edit(setConsent)} w={t} disabled={busy} invalid={err?.field === "consent"} />
          {err && <p className="ac-err" role="alert">{t.errors[err.key] ?? t.errors.generic}</p>}
          <button type="submit" className="rr-send" disabled={busy}>{busy ? t.sending : t.send}</button>
          <button type="button" className="rg-fin-done" onClick={onDone} disabled={busy}>{t.notNow}</button>
        </>
      )}
    </form>
  );
}
