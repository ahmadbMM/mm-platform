"use client";

import { useEffect, useRef, useState } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { sized, srcSet } from "@/lib/img";
import { photoAlt, type StoreProduct } from "@/lib/store-core";
import { stepPhoto } from "@/lib/store-pdp";
import { T } from "./Store.text";
import { T as W } from "./w3a.text";
import { NoPhoto } from "./bits";
import { StIcon } from "./icons";
import PhotoViewer from "./PhotoViewer";

// A product's photos (D10, D12-C, F13, F18, X10). One row of square photos that scrolls sideways and snaps: on a phone
// each photo is the column's width less 32px, so the next one peeks in, with dots and small tap arrows under and over
// it; from 900px wide one photo fills the frame and a column of thumbnails stands beside it (the reading side). The
// row mirrors on right-to-left pages (A06-A: the next photo comes from the left), the photos never. A tap on a photo
// opens the dark viewer (PhotoViewer: arrows, pinch and zoom). `photos` are those of the colour picked (photosFor), and
// each is described by what staff wrote about it (photoAlt), the first by the product's name when they wrote nothing.
//   While the viewer is open the gallery is lifted over the page (.viewing): from 900px this column stays in view
// (position: sticky), and a sticky column paints everything inside it at its own level, which left the viewer under the
// site's fixed header (its close button hidden) and under the buy column beside it.
export default function ProductGallery({ p, photos, locale, name }: { p: StoreProduct; photos: string[]; locale: string; name: string }) {
  const t = useLocalize(T);
  const w = useLocalize(W);
  const track = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const [view, setView] = useState<number | null>(null);
  const n = photos.length;

  // the photo in view, as the row is swiped or scrolled
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
  const altOf = (src: string, i: number) => photoAlt(p, src, locale) || (i === 0 ? name : "");

  return (
    <div className={`st-gal${n > 1 ? " many" : ""}${view !== null ? " viewing" : ""}`} role="region" aria-roledescription="carousel" aria-label={w.photos}>
      {n > 1 && (
        <div className="st-gal-thumbs">
          <div>
            {photos.map((u, i) => (
              <button key={u + i} type="button" aria-current={i === at ? "true" : undefined} aria-label={t.photo(i + 1, n)} onClick={() => go(i)}>
                <img src={sized(u, 640)} alt="" loading="lazy" decoding="async" />
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="st-gal-main">
        <div className="st-gal-track" ref={track}>
          {n > 0 ? photos.map((u, i) => {
            const alt = altOf(u, i);
            return (
              <div key={u + i} className="st-gal-slide" data-i={i} role="group" aria-roledescription="slide" aria-label={t.photo(i + 1, n)}>
                <button type="button" onClick={() => setView(i)} aria-label={w.enlarge(alt || name)}>
                  <img src={sized(u, 1280)} srcSet={srcSet(u)} sizes="(max-width: 900px) 92vw, 46vw" alt={alt}
                    loading={i === 0 ? undefined : "lazy"} fetchPriority={i === 0 ? "high" : undefined} decoding="async" />
                </button>
              </div>
            );
          }) : <div className="st-gal-slide"><NoPhoto /></div>}
        </div>
        {n > 1 && (
          <>
            <button type="button" className="st-gal-arrow prev" onClick={() => go(stepPhoto(at, n, -1))} disabled={at === 0} aria-label={w.prevPhoto}><StIcon name="prev" flip size={20} /></button>
            <button type="button" className="st-gal-arrow next" onClick={() => go(stepPhoto(at, n, 1))} disabled={at >= n - 1} aria-label={w.nextPhoto}><StIcon name="next" flip size={20} /></button>
          </>
        )}
        {n > 0 && <span className="st-gal-zoom" aria-hidden="true"><StIcon name="zoom" size={18} /></span>}
      </div>
      {n > 1 && (
        <div className="st-gal-dots">
          {photos.map((u, i) => (
            <button key={u + i} type="button" aria-current={i === at ? "true" : undefined} aria-label={t.photo(i + 1, n)} onClick={() => go(i)}><i /></button>
          ))}
        </div>
      )}
      {view !== null && (
        <PhotoViewer photos={photos} start={view} locale={locale} name={name} altOf={altOf}
          onClose={(i) => { setView(null); if (i !== at) go(i, false); }} />
      )}
    </div>
  );
}
