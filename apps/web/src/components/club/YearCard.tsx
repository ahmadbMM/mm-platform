"use client";

import { useEffect, useRef, useState } from "react";
import { fill } from "@/i18n/tx";
import { isRtl } from "@/i18n/locales";
import { KindIcon } from "@/components/experiences/KindArt";
import { fmtNum } from "@/lib/fill";
import { hubDay, type HubYear } from "@/lib/hub-feed";
import { monthName } from "@/lib/member-hub";
import { ltrNum, plainText, SHARE_INK, SHARE_SITE } from "@/lib/share-picture";
import { STAR } from "./HubCards";
import type { CommunityWords } from "./Community.words";

// Your year in a member's area on /club, in December and January only (lib/hub-feed.ts HubYear; the booking app's
// _yrCardHtml, _yrSlides, _yrHtml, _yrPrep and _yrShare, 2026-11-11): a card - "Your year so far" until 27 December, then
// "Your 2026 with MicroMobility" - with the member's sessions and See your year. That opens the slides in the card's place,
// moved by the member alone (nothing moves on its own): the year and since when, the sessions and Saturdays, the kinds
// tried, the busiest month and the badges, and the next challenge; Share my year on the last. Only the member's own counts:
// the app's "of the club's N sessions" line is left out (no head counts for customers, the owner 2026-11-13). The share
// picture is drawn as the slides open (a phone shares a file only from the tap itself), 1080 x 1920, no name; without file
// sharing the words go, else WhatsApp. `kinds`: each kind tried with its name in the page's language.
type Words = Pick<CommunityWords, "yrTitle" | "yrSoFar" | "yrOpen" | "yrRange" | "yrSince" | "yrSessions" | "yrSatOf" | "yrKinds" | "yrBusiest" | "yrBadges"
  | "yrFirstOnly" | "yrNext" | "yrShare" | "yrMy" | "yrShareMsg" | "prev" | "nextB" | "close">;

export default function YearCard({ y, locale, w, kinds, from }: { y: HubYear; locale: string; w: Words; kinds: { k: string; name: string }[]; from: string }) {
  const [at, setAt] = useState<number | null>(null);
  const file = useRef<File | null>(null);
  const openBtn = useRef<HTMLButtonElement>(null);
  const slide = useRef<HTMLDivElement>(null);
  const N = (n: number) => fmtNum(n, locale);
  const range = from ? fill(w.yrRange, from) : "";
  const first = hubDay(y.first, locale);
  const held = Math.max(y.satsHeld, y.saturdays);
  const slides = y.sessions <= 1
    ? [<p key="1" className="club-yr-big">{fill(w.yrFirstOnly, first)}</p>]
    : [
      <div key="1"><p className="club-yr-big">{fill(w.yrTitle, String(y.year))}</p>{range && <p className="club-hub-meta">{range}</p>}<p className="club-hub-meta">{fill(w.yrSince, first)}</p></div>,
      <div key="2"><p className="club-yr-num"><bdi>{N(y.sessions)}</bdi></p><p className="club-hub-meta">{w.yrSessions}</p><p className="club-hub-meta">{fill(w.yrSatOf, N(y.saturdays), N(held))}</p></div>,
      <div key="3"><p className="club-hub-k">{w.yrKinds}</p><ul className="club-yr-kinds">{kinds.map((k) => <li key={k.k}><KindIcon kind={k.k} size={18} /><span>{k.name}</span></li>)}</ul></div>,
      <div key="4"><p className="club-hub-k">{w.yrBusiest}</p><p className="club-yr-big">{y.busiest ? monthName(y.busiest, locale) : ""}</p><p className="club-hub-meta">{w.yrBadges}: <bdi>{N(y.badges)}</bdi></p></div>,
      <p key="5" className="club-yr-big">{w.yrNext}</p>,
    ];

  // the picture, made as the slides open
  useEffect(() => {
    if (at === null || file.current) return;
    let gone = false;
    (async () => {
      try {
        const cv = document.createElement("canvas"); cv.width = 1080; cv.height = 1920;
        const x = cv.getContext("2d"); if (!x) return;
        const fam = getComputedStyle(document.body).fontFamily || "sans-serif";
        try { await Promise.all(["700 120px", "600 52px", "400 44px"].map((f) => document.fonts.load(`${f} ${fam}`))); } catch { /* the fallback font */ }
        x.direction = isRtl(locale) ? "rtl" : "ltr"; x.textAlign = "center"; x.textBaseline = "alphabetic";
        x.fillStyle = SHARE_INK.bg; x.fillRect(0, 0, 1080, 1920);
        x.fillStyle = SHARE_INK.go; x.font = `600 52px ${fam}`; x.fillText("MicroMobility", 540, 260);
        x.fillStyle = SHARE_INK.hi; x.font = `700 64px ${fam}`; x.fillText(fill(w.yrMy, String(y.year)), 540, 520);
        if (range) { x.fillStyle = SHARE_INK.low; x.font = `400 44px ${fam}`; x.fillText(range, 540, 600); }
        x.fillStyle = SHARE_INK.go; x.font = `700 240px ${fam}`; x.fillText(ltrNum(y.sessions), 540, 980);
        x.fillStyle = SHARE_INK.hi; x.font = `600 56px ${fam}`; x.fillText(w.yrSessions, 540, 1080);
        x.font = `400 48px ${fam}`; x.fillStyle = SHARE_INK.mid;
        x.fillText(fill(w.yrSatOf, ltrNum(y.saturdays), ltrNum(held)), 540, 1260);
        if (y.busiest) x.fillText(`${w.yrBusiest}: ${monthName(y.busiest, locale)}`, 540, 1350);
        x.fillStyle = SHARE_INK.foot; x.font = `400 40px ${fam}`; x.fillText(SHARE_SITE, 540, 1760);
        const blob = await new Promise<Blob | null>((res) => cv.toBlob(res, "image/png"));
        if (blob && !gone) file.current = new File([blob], `micromobility-${y.year}.png`, { type: "image/png" });
      } catch { /* the words go instead */ }
    })();
    return () => { gone = true; };
  }, [at, locale, range, w, y, held]);

  // the focus follows: onto the slide as it changes, back to See your year on closing
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) return;
    if (at === null) openBtn.current?.focus({ preventScroll: true });
    else slide.current?.focus({ preventScroll: true });
  }, [at]);
  const go = (i: number | null) => { moved.current = true; setAt(i); };

  async function share() {
    const f = file.current;
    if (f && navigator.canShare && navigator.share) {
      try { if (navigator.canShare({ files: [f] })) { await navigator.share({ files: [f] }); return; } }
      catch (e) { if ((e as { name?: string })?.name === "AbortError") return; }
    }
    const text = plainText(fill(w.yrShareMsg, String(y.year), String(y.sessions), String(y.saturdays)));
    if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if ((e as { name?: string })?.name === "AbortError") return; } }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }

  if (at === null) {
    return (
      <section className="club-hub club-hub-yr" aria-labelledby="club-hub-yr-h">
        <h3 id="club-hub-yr-h"><svg className="mm-ic" viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={STAR} /></svg> {y.full ? fill(w.yrTitle, String(y.year)) : w.yrSoFar}</h3>
        <p className="club-yr-num"><bdi>{N(y.sessions)}</bdi></p>
        <p className="club-hub-meta">{w.yrSessions}{range && <> · {range}</>}</p>
        <button ref={openBtn} type="button" className="club-hub-btn club-hub-primary" onClick={() => go(0)}>{w.yrOpen}</button>
      </section>
    );
  }
  const i = Math.max(0, Math.min(slides.length - 1, at)), last = i === slides.length - 1;
  return (
    <section className="club-hub club-hub-yr club-yr-slides" aria-label={y.full ? fill(w.yrTitle, String(y.year)) : w.yrSoFar}>
      <div ref={slide} className="club-yr-slide" aria-live="polite" tabIndex={-1}>{slides[i]}</div>
      {slides.length > 1 && <div className="club-hub-dots" aria-hidden="true">{slides.map((_, k) => <span key={k} className={k === i ? "on" : undefined} />)}</div>}
      <div className="club-yr-nav">
        {i > 0 ? <button type="button" className="club-hub-btn" onClick={() => go(i - 1)}>{w.prev}</button> : <button type="button" className="club-hub-btn" onClick={() => go(null)}>{w.close}</button>}
        {last ? <button type="button" className="club-hub-btn club-hub-primary" onClick={() => void share()}>{w.yrShare}</button>
          : <button type="button" className="club-hub-btn club-hub-primary" onClick={() => go(i + 1)}>{w.nextB}</button>}
      </div>
      {last && <button type="button" className="club-hub-btn club-yr-close" onClick={() => go(null)}>{w.close}</button>}
    </section>
  );
}
