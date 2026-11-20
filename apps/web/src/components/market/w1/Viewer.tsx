"use client";

import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type WheelEvent as RWheelEvent } from "react";
import { useDialogFocus } from "@/components/site/use-dialog-focus";
import { isRtl } from "@/i18n/locales";
import { useLocalize, useTxLocale } from "@/i18n/TxProvider";
import { mkPhotoSrc } from "@/lib/market/core";
import { W1_ZOOM_MAX, W1_ZOOM_TAP, clampPan, clampScale, keyStep, pinchScale, stepPhoto, swipeStep } from "@/lib/market/w1-gallery";
import MkIcon from "../MkIcon";
import { T } from "../Market.text";
import { T as W } from "../w1.text";
import W1Icon from "./W1Icon";

// A listing's photos large: a dark viewer over the whole screen with the photo in its middle, the count, a close
// button, zoom buttons and an arrow at each side. It is a dialog: the keyboard stays inside it (useDialogFocus) and
// goes back to the photo that opened it; Escape and the close button end it. Two fingers pinch the photo up to four
// times its size, a double tap or a double click zooms in and out, a zoomed photo moves with one finger and never
// leaves the frame, and at its own size a swipe shows the next photo or the one before; the wheel and + / - zoom too.
// On a right-to-left page the next photo comes from the left, with its arrow and its key. A photo is never flipped.
// The arithmetic is lib/market/w1-gallery.ts.
type Z = { s: number; x: number; y: number };
const FLAT: Z = { s: 1, x: 0, y: 0 };
type Pt = { x: number; y: number };
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
/** The zoom `f` times what it is, the photo kept inside its frame (the stage's box). */
function zoomed(q: Z, f: number, el: HTMLElement | null): Z {
  const s = clampScale(q.s * f);
  if (s === 1) return FLAT;
  const r = el?.getBoundingClientRect();
  return { s, ...clampPan(q.x, q.y, s, r?.width || 1, r?.height || 1) };
}

export default function Viewer({ photos, start, title, onClose }: { photos: string[]; start: number; title: string; onClose: (at: number) => void }) {
  const t = useLocalize(T);
  const w = useLocalize(W);
  const rtl = isRtl(useTxLocale());
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

  const frame = () => {
    const r = stage.current?.getBoundingClientRect();
    return { w: r?.width || 1, h: r?.height || 1 };
  };
  const show = (i: number) => { setAt(i); setZ(FLAT); };
  const zoomBy = (f: number) => setZ((q) => zoomed(q, f, stage.current));
  const toggle = () => setZ((q) => (q.s > 1 ? FLAT : { s: W1_ZOOM_TAP, x: 0, y: 0 }));

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") { close.current(atNow.current); return; }
      if (e.key === "+" || e.key === "=") { setZ((q) => zoomed(q, 1.4, stage.current)); return; }
      if (e.key === "-") { setZ((q) => zoomed(q, 1 / 1.4, stage.current)); return; }
      const d = keyStep(e.key, rtl);
      if (d) { e.preventDefault(); setAt((a) => stepPhoto(a, n, d)); setZ(FLAT); }
    };
    document.addEventListener("keydown", k);
    const was = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = was; };
  }, [rtl, n]);

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
      if (now - lastTap.current < 320) { lastTap.current = 0; toggle(); } else lastTap.current = now;
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

  const src = mkPhotoSrc(photos[at]) ?? "";
  return (
    <div className="mk-w1-view" ref={box} role="dialog" aria-modal="true" aria-label={w.photos}>
      <div className="mk-w1-view-head">
        <span className="mk-w1-view-n" aria-live="polite" dir="ltr">{at + 1} / {n}</span>
        <span className="mk-w1-view-tools">
          <button type="button" className="mk-w1-view-btn" onClick={() => zoomBy(1 / 1.4)} disabled={z.s <= 1} aria-label={w.zoomOut}><W1Icon name="minus" size={20} /></button>
          <button type="button" className="mk-w1-view-btn" onClick={() => zoomBy(1.4)} disabled={z.s >= W1_ZOOM_MAX} aria-label={w.zoomIn}><MkIcon name="plus" size={20} /></button>
          <button type="button" className="mk-w1-view-btn" onClick={() => onClose(at)} aria-label={t.close}><MkIcon name="close" size={22} /></button>
        </span>
      </div>
      <div className="mk-w1-view-stage" ref={stage} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={wheel}
        onDoubleClick={() => { if (lastType.current === "mouse") toggle(); /* a phone's double tap was zoomed by up() already */ }}>
        <img key={src} src={src} alt={title} draggable={false} className={z.s > 1 ? "mk-w1-zoomed" : undefined}
          style={{ transform: `translate3d(${z.x}px, ${z.y}px, 0) scale(${z.s})` }} />
      </div>
      {n > 1 && (
        <>
          <button type="button" className="mk-w1-view-btn mk-w1-view-arrow mk-w1-view-prev" onClick={() => show(stepPhoto(at, n, -1))} disabled={at === 0} aria-label={w.prevPhoto}><MkIcon name="back" flip size={24} /></button>
          <button type="button" className="mk-w1-view-btn mk-w1-view-arrow mk-w1-view-next" onClick={() => show(stepPhoto(at, n, 1))} disabled={at >= n - 1} aria-label={w.nextPhoto}><MkIcon name="next" flip size={24} /></button>
        </>
      )}
    </div>
  );
}
