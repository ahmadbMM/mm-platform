"use client";

import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type WheelEvent as RWheelEvent } from "react";
import { useDialogFocus } from "@/components/site/use-dialog-focus";
import { useLocalize } from "@/i18n/TxProvider";
import { isRtl } from "@/i18n/locales";
import { sized, srcSet } from "@/lib/img";
import { clampPan, clampScale, keyStep, pinchScale, stepPhoto, swipeStep } from "@/lib/store-pdp";
import { T } from "./Store.text";
import { T as W } from "./w3a.text";
import { Ic } from "./bits";
import { StIcon } from "./icons";

// The product's photos large (F13): a dark viewer over the whole screen with the photo centred, a close button, the
// count and arrows; Escape and the close button end it, the keyboard stays inside (useDialogFocus) and goes back to the
// photo that opened it. Two fingers pinch the photo up to 4 times its size, a
// double tap (a double click) zooms in and out, a zoomed photo moves with one finger and never leaves the frame, and at
// its own size a swipe shows the next or the one before; the wheel and + / - zoom too. On a right-to-left page the
// next photo comes from the left, its arrow and its key the left one (A06-A). Bike photos are never flipped.
type Z = { s: number; x: number; y: number };
const FLAT: Z = { s: 1, x: 0, y: 0 };
type Pt = { x: number; y: number };
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

export default function PhotoViewer({ photos, start, locale, name, altOf, onClose }: {
  photos: string[]; start: number; locale: string; name: string; altOf: (src: string, i: number) => string; onClose: (at: number) => void;
}) {
  const t = useLocalize(T);
  const w = useLocalize(W);
  const rtl = isRtl(locale);
  const n = photos.length;
  const [at, setAt] = useState(Math.min(Math.max(0, start), n - 1));
  const [z, setZ] = useState<Z>(FLAT);
  const box = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const pts = useRef(new Map<number, Pt>());
  const g = useRef<{ dist: number; s: number; x: number; y: number; sx: number; sy: number; moved: boolean } | null>(null);
  const lastTap = useRef(0);
  const lastType = useRef("");
  const close = useRef(onClose);
  const atNow = useRef(at);
  useEffect(() => { close.current = onClose; atNow.current = at; });
  useDialogFocus(box, true);

  const show = (i: number) => { setAt(i); setZ(FLAT); };
  const zoomBy = (f: number) => setZ((q) => { const s = clampScale(q.s * f); const r = frame(); return s === 1 ? FLAT : { s, ...clampPan(q.x, q.y, s, r.w, r.h) }; });

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") { close.current(atNow.current); return; }
      if (e.key === "+" || e.key === "=") { zoomBy(1.4); return; }
      if (e.key === "-") { zoomBy(1 / 1.4); return; }
      const d = keyStep(e.key, rtl);
      if (d) { e.preventDefault(); setAt((a) => stepPhoto(a, n, d)); setZ(FLAT); }
    };
    document.addEventListener("keydown", k);
    const was = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = was; };
  }, [rtl, n]); // eslint-disable-line react-hooks/exhaustive-deps -- zoomBy reads only the frame and the state setter

  function frame() {
    const r = stage.current?.getBoundingClientRect();
    return { w: r?.width || 1, h: r?.height || 1 };
  }
  function down(e: RPointerEvent<HTMLDivElement>) {
    lastType.current = e.pointerType;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* an old browser */ }
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const ps = [...pts.current.values()];
    g.current = { dist: ps.length >= 2 ? dist(ps[0], ps[1]) : 0, s: z.s, x: z.x, y: z.y, sx: e.clientX, sy: e.clientY, moved: ps.length >= 2 };
  }
  function move(e: RPointerEvent<HTMLDivElement>) {
    const st = g.current;
    if (!st || !pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const ps = [...pts.current.values()], r = frame();
    if (ps.length >= 2) {
      if (!st.dist) { st.dist = dist(ps[0], ps[1]); st.s = z.s; return; }
      const s = pinchScale(st.s, st.dist, dist(ps[0], ps[1]));
      st.moved = true;
      setZ((q) => (s === 1 ? FLAT : { s, ...clampPan(q.x, q.y, s, r.w, r.h) }));
      return;
    }
    const dx = e.clientX - st.sx, dy = e.clientY - st.sy;
    if (Math.abs(dx) + Math.abs(dy) > 8) st.moved = true;
    if (z.s > 1) setZ({ s: z.s, ...clampPan(st.x + dx, st.y + dy, z.s, r.w, r.h) });
  }
  function up(e: RPointerEvent<HTMLDivElement>) {
    const st = g.current;
    pts.current.delete(e.pointerId);
    if (!st) return;
    if (pts.current.size > 0) {
      // one finger left after a pinch: it carries on moving the photo from where it is
      const [q] = [...pts.current.values()];
      g.current = { dist: 0, s: z.s, x: z.x, y: z.y, sx: q.x, sy: q.y, moved: true };
      return;
    }
    g.current = null;
    if (e.type === "pointercancel") return;
    if (!st.moved) {
      if (e.pointerType === "mouse") return; // a mouse zooms with a double click
      const now = Date.now();
      if (now - lastTap.current < 320) { lastTap.current = 0; setZ(z.s > 1 ? FLAT : { s: 2.5, x: 0, y: 0 }); }
      else lastTap.current = now;
      return;
    }
    if (z.s === 1) {
      const d = swipeStep(e.clientX - st.sx, e.clientY - st.sy, rtl);
      if (d) show(stepPhoto(at, n, d));
    }
  }
  function wheel(e: RWheelEvent<HTMLDivElement>) {
    if (Math.abs(e.deltaY) < 1) return;
    zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15);
  }

  const src = photos[at];
  const alt = altOf(src, at) || name;
  return (
    <div className="st-viewer" ref={box} role="dialog" aria-modal="true" aria-label={name}>
      <div className="st-viewer-head">
        <span className="st-viewer-n" aria-live="polite" dir="ltr">{at + 1} / {n}</span>
        <button type="button" className="st-viewer-x" onClick={() => onClose(at)} aria-label={t.close}><Ic name="close" size={22} /></button>
      </div>
      <div className="st-viewer-stage" ref={stage} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onDoubleClick={() => {
          // a mouse's double click alone: a phone's double tap was zoomed by up(), and the dblclick the browser then
          // fires would zoom it straight back out (bug hunt 2026-11-18)
          if (lastType.current !== "mouse") return;
          setZ(z.s > 1 ? FLAT : { s: 2.5, x: 0, y: 0 });
        }} onWheel={wheel}>
        <img key={src} src={sized(src, 1280)} srcSet={srcSet(src)} sizes="100vw" alt={alt} draggable={false}
          style={{ transform: `translate3d(${z.x}px, ${z.y}px, 0) scale(${z.s})` }} className={z.s > 1 ? "zoomed" : undefined} />
      </div>
      {n > 1 && (
        <>
          <button type="button" className="st-viewer-arrow prev" onClick={() => show(stepPhoto(at, n, -1))} disabled={at === 0} aria-label={w.prevPhoto}><StIcon name="prev" flip size={24} /></button>
          <button type="button" className="st-viewer-arrow next" onClick={() => show(stepPhoto(at, n, 1))} disabled={at >= n - 1} aria-label={w.nextPhoto}><StIcon name="next" flip size={24} /></button>
        </>
      )}
    </div>
  );
}
