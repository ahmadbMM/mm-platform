"use client";

import { useEffect, useRef, useState } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { MK_SMALL_SIDE, isMkPhotoName, mkPhotoSrc } from "@/lib/market/core";
import { stepPhoto } from "@/lib/market/w1-gallery";
import MkIcon, { MkNoPhoto } from "../MkIcon";
import { T } from "../Market.text";
import { T as W } from "../w1.text";
import Viewer from "./Viewer";

// A listing's photos. One row that scrolls sideways and snaps, so a phone swipes through them (the next photo peeks
// in at the edge), with an arrow at each side and a row of dots under it that says which one is in view; from 900px wide one photo fills the frame
// and the others stand under it as thumbnails. A tap on a photo opens it large (./Viewer.tsx: pinch, double tap,
// arrows). The row mirrors on right-to-left pages - the next photo comes from the left - and a photo itself is never
// flipped. Every photo is shown whole (never cropped): what a seller photographed is what a buyer judges.
//   photos   the listing's photos as the database names them, in the seller's order (lib/market/core.ts mkPhotoSrc
//            turns each into the site's own address; a name that is neither kind is left out)
//   title    the listing's title: what the first photo shows, for a screen reader
export default function Gallery({ photos, title }: { photos: string[]; title: string }) {
  const t = useLocalize(T);
  const w = useLocalize(W);
  const shown = photos.filter((p) => mkPhotoSrc(p) !== null);
  const n = shown.length;
  const track = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const [view, setView] = useState<number | null>(null);

  // the photo in view, as the row is swiped
  useEffect(() => {
    const el = track.current;
    if (!el || n < 2 || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) setAt(Number((e.target as HTMLElement).dataset.i) || 0);
    }, { root: el, threshold: 0.6 });
    el.querySelectorAll("[data-i]").forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [n]);

  function go(i: number, smooth = true) {
    const el = track.current?.querySelector<HTMLElement>(`[data-i="${i}"]`);
    if (!el) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: smooth && !still ? "smooth" : "auto", block: "nearest", inline: "start" });
    setAt(i);
  }
  const srcSet = (p: string, src: string) => (isMkPhotoName(p) ? `${mkPhotoSrc(p, true)} ${MK_SMALL_SIDE}w, ${src} 1600w` : undefined);

  if (n === 0) {
    return <div className="mk-w1-gal"><div className="mk-w1-gal-main"><div className="mk-w1-gal-slide mk-w1-gal-none"><MkNoPhoto label={t.noPhoto} /></div></div></div>;
  }
  return (
    <div className={`mk-w1-gal${n > 1 ? " mk-w1-gal-many" : ""}${view !== null ? " mk-w1-gal-viewing" : ""}`} role="region" aria-roledescription="carousel" aria-label={w.photos}>
      <div className="mk-w1-gal-main">
        <div className="mk-w1-gal-track" ref={track}>
          {shown.map((p, i) => {
            const src = mkPhotoSrc(p) as string;
            return (
              <div key={`${p}-${i}`} className="mk-w1-gal-slide" data-i={i} role="group" aria-roledescription="slide" aria-label={w.photoOf(i + 1, n)}>
                <button type="button" onClick={() => setView(i)} aria-label={w.enlarge}>
                  <img src={src} srcSet={srcSet(p, src)} sizes="(max-width: 899px) 100vw, 760px" alt={i === 0 ? title : ""}
                    loading={i === 0 ? "eager" : "lazy"} fetchPriority={i === 0 ? "high" : undefined} decoding="async" draggable={false} />
                </button>
              </div>
            );
          })}
        </div>
        {n > 1 && (
          <>
            <button type="button" className="mk-w1-gal-arrow mk-w1-gal-prev" onClick={() => go(stepPhoto(at, n, -1))} disabled={at === 0} aria-label={w.prevPhoto}><MkIcon name="back" flip size={20} /></button>
            <button type="button" className="mk-w1-gal-arrow mk-w1-gal-next" onClick={() => go(stepPhoto(at, n, 1))} disabled={at >= n - 1} aria-label={w.nextPhoto}><MkIcon name="next" flip size={20} /></button>
          </>
        )}
        <span className="mk-w1-gal-zoom" aria-hidden="true"><MkIcon name="search" size={18} /></span>
      </div>
      {n > 1 && (
        <>
          <div className="mk-w1-gal-dots" aria-hidden="true">
            {shown.map((p, i) => <i key={`${p}-${i}`} data-on={i === at ? "" : undefined} />)}
          </div>
          <div className="mk-w1-gal-thumbs">
            {shown.map((p, i) => (
              <button key={`${p}-${i}`} type="button" aria-current={i === at ? "true" : undefined} aria-label={w.photoOf(i + 1, n)} onClick={() => go(i)}>
                <img src={mkPhotoSrc(p, true) as string} alt="" loading="lazy" decoding="async" draggable={false} />
              </button>
            ))}
          </div>
        </>
      )}
      {view !== null && <Viewer photos={shown} start={view} title={title} onClose={(i) => { setView(null); if (i !== at) go(i, false); }} />}
    </div>
  );
}
