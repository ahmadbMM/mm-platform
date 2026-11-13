"use client";

import "./share-image.css";
import { useEffect, useRef, useState } from "react";
import Medal from "./Medal";
import { shareWords } from "./BadgeShare.words";
import { isRtl } from "@/i18n/locales";
import { paintShare, plainText, shareTint, SHARE_H, SHARE_MARK, SHARE_W, type ShareAssets, type ShareSubject } from "@/lib/share-picture";

// Share a badge or a title as a picture (the booking app's badge-share.js, new features build F12, 2026-11-13): the
// pop-up that follows Share in an earned badge's pop-up (BadgeGrid.tsx) or under the title on /club (ShareButton): the
// picture, a switch to add the rider's first name (off every time it opens), and one button. The picture is drawn here,
// in the browser (lib/share-picture.ts). Both pictures, without the name and with it, are made as the pop-up opens, so
// the button can hand one over in the tap itself: a phone opens its share sheet only from the tap. The button hands the
// picture alone to the share sheet (no words beside it: some iPhones drop the file when text travels with it); where a
// browser cannot share files it reads Save image and saves the picture. Nothing is said after either (no toast).

type Pic = { file: File; url: string; alt: string };

/** The booking app's share icon: an arrow up out of a tray (as the ticket's Share). */
export const ShareIc = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M12 15V4" /><path d="M8 7.5L12 3.5l4 4" /><path d="M7 11H5.6A1.6 1.6 0 0 0 4 12.6v6.8A1.6 1.6 0 0 0 5.6 21h12.8a1.6 1.6 0 0 0 1.6-1.6v-6.8a1.6 1.6 0 0 0-1.6-1.6H17" />
  </svg>
);

/** Can this browser hand a picture file to its share sheet (asked with the file itself once it is made). */
function canShareFiles(f?: File): boolean {
  try {
    return typeof navigator !== "undefined" && !!navigator.share && !!navigator.canShare
      && navigator.canShare({ files: [f ?? new File([new Blob([""], { type: "image/png" })], "x.png", { type: "image/png" })] });
  } catch { return false; }
}

function loadImg(src: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((res) => {
    const im = new Image();
    let done = false;
    const end = (v: HTMLImageElement | null) => { if (!done) { done = true; res(v); } };
    im.onload = () => end(im.naturalWidth ? im : null);
    im.onerror = () => end(null);
    setTimeout(() => end(null), 4000);
    im.src = src;
  });
}
// The site's mark, fetched once; a failed fetch is asked again next time. Without it the name stands alone.
let markP: Promise<HTMLImageElement | null> | null = null;
function loadMark() {
  if (!markP) markP = loadImg(SHARE_MARK).then((im) => { if (!im) markP = null; return im; });
  return markP;
}

// The medal as the site draws it (Medal.tsx). Its colours come from the stylesheet, which a picture of the svg cannot
// read: each shape's computed paint is written onto a copy as attributes, and the copy goes as a data: address (a
// picture from one does not close the canvas to reading). The probe draws a green badge in the brand green, for the
// picture's dark ground (share-image.css).
const PAINT = ["fill", "fill-opacity", "stroke", "stroke-opacity", "stroke-width", "stroke-linecap", "stroke-linejoin", "opacity", "font-family", "font-weight"];
function medalSrc(svg: SVGSVGElement | null): string {
  if (!svg) return "";
  try {
    const copy = svg.cloneNode(true) as SVGSVGElement;
    const to = Array.from(copy.querySelectorAll("*"));
    Array.from(svg.querySelectorAll("*")).forEach((el, i) => {
      const c = to[i];
      if (!c || el.closest("defs")) return;
      const cs = getComputedStyle(el);
      for (const p of PAINT) { const v = cs.getPropertyValue(p); if (v && !v.includes("url(")) c.setAttribute(p, v); } // a gradient keeps its own attribute
      c.removeAttribute("class");
    });
    copy.removeAttribute("class"); copy.setAttribute("width", "520"); copy.setAttribute("height", "520");
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(copy))}`;
  } catch { return ""; }
}

// What every picture of one subject shares: the body font with its weights loaded, the mark, the medal, the colour.
async function makeAssets(sub: ShareSubject, svg: SVGSVGElement | null, fam: string): Promise<ShareAssets> {
  try { await Promise.all(["700 84px", "600 48px", "400 44px"].map((w) => document.fonts.load(`${w} ${fam}`, sub.label + sub.name))); } catch { /* drawn in the font there is */ }
  const [mark, medal] = await Promise.all([loadMark(), sub.medal ? loadImg(medalSrc(svg)) : Promise.resolve(null)]);
  return { fam, mark, medal, tint: shareTint(sub.medal ? sub.medal.color : sub.chip?.color) };
}

async function draw(sub: ShareSubject, first: string, a: ShareAssets, rtl: boolean): Promise<Pic | null> {
  const cv = document.createElement("canvas");
  cv.width = SHARE_W; cv.height = SHARE_H;
  const x = cv.getContext("2d");
  if (!x) return null;
  const said = paintShare(x, sub, first, a, rtl);
  let blob: Blob | null = null;
  try { blob = await new Promise<Blob | null>((res) => cv.toBlob(res, "image/png")); } catch { blob = null; }
  if (!blob) { // a browser that will not read back a canvas holding the pictures: drawn again without them
    return a.mark || a.medal ? draw(sub, first, { ...a, mark: null, medal: null }, rtl) : null;
  }
  return { file: new File([blob], `${sub.file}.png`, { type: "image/png" }), url: URL.createObjectURL(blob), alt: said.map(plainText).join(" · ") };
}

function save(f: Pic) {
  const a = document.createElement("a");
  a.href = f.url; a.download = f.file.name; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
}

/** The share pop-up, open while it is mounted (the parent mounts it on a tap and unmounts it on `onDone`, when it
 *  closes: Close, Escape or a tap outside). `first`: the rider's first name, "" for no switch. */
export default function ShareImage({ sub, first, locale, onDone }: { sub: ShareSubject; first: string; locale: string; onDone: () => void }) {
  const w = shareWords(locale), rtl = isRtl(locale);
  const dlg = useRef<HTMLDialogElement>(null);
  const probe = useRef<HTMLSpanElement>(null);
  const shut = useRef<HTMLButtonElement>(null);
  const [named, setNamed] = useState(false);
  const [pics, setPics] = useState<(Pic | null)[]>([null, null]);
  const [err, setErr] = useState(false);
  const [run, setRun] = useState(0);
  const [can] = useState(() => canShareFiles());
  // the pictures' addresses, let go a minute after the pop-up closes, so a save still starting keeps its file
  const [held] = useState<string[]>(() => []);
  useEffect(() => {
    const d = dlg.current;
    if (d && !d.open) d.showModal();
    shut.current?.focus({ preventScroll: true });
    return () => { const L = held.splice(0); setTimeout(() => L.forEach((u) => { try { URL.revokeObjectURL(u); } catch { /* gone */ } }), 60000); };
  }, [held]);
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const fam = (dlg.current && getComputedStyle(dlg.current).fontFamily) || "sans-serif";
        const a = await makeAssets(sub, probe.current?.querySelector("svg") ?? null, fam);
        for (let i = 0; i < (first ? 2 : 1); i++) {
          const p = await draw(sub, i ? first : "", a, rtl);
          if (!live) { if (p) URL.revokeObjectURL(p.url); return; } // closed, or made again, meanwhile
          if (!p) throw new Error("no picture");
          held.push(p.url);
          setPics((l) => l.map((y, j) => (j === i ? p : y)));
        }
      } catch { if (live) setErr(true); }
    })();
    return () => { live = false; };
  }, [sub, first, rtl, run, held]);

  const pic = pics[named ? 1 : 0] ?? null;
  // inside the tap, with the file already made: nothing is awaited before navigator.share
  function send() {
    const f = pic;
    if (!f) return;
    if (canShareFiles(f.file)) {
      try {
        navigator.share({ files: [f.file] }).catch((e: unknown) => { if ((e as { name?: string } | null)?.name !== "AbortError") save(f); }); // closed the sheet: nothing
        return;
      } catch { /* saved below */ }
    }
    save(f);
  }
  const again = () => { setErr(false); setPics([null, null]); setRun((n) => n + 1); };

  return (
    <>
      <span className="shr-probe" aria-hidden="true" ref={probe}>{sub.medal && <Medal icon={sub.medal.icon} color={sub.medal.color} />}</span>
      <dialog ref={dlg} className="shr-dlg" aria-label={w.share} onClose={onDone}
        onClick={(e) => { if (e.target === e.currentTarget) dlg.current?.close(); }}>
        <div className="shr-view">
          {err ? (
            <div className="shr-err" role="alert"><span>{w.err}</span><button type="button" className="shr-x" onClick={again}>{w.retry}</button></div>
          ) : pic ? <img src={pic.url} width={SHARE_W} height={SHARE_H} alt={pic.alt} />
            : <div className="shr-wait" role="status" aria-label={w.making} />}
        </div>
        {first && (
          <label className="shr-sw">
            <input type="checkbox" role="switch" checked={named} onChange={(e) => setNamed(e.target.checked)} />
            <span className="shr-sw-box" aria-hidden="true" />
            <span className="shr-sw-txt">{w.name}</span>
          </label>
        )}
        <div className="shr-acts">
          <button type="button" className="shr-go" disabled={!pic || err} onClick={send}>{can && <ShareIc />}<span>{can ? w.share : w.save}</span></button>
          <button type="button" className="shr-x" ref={shut} onClick={() => dlg.current?.close()}>{w.close}</button>
        </div>
      </dialog>
    </>
  );
}

/** Share and its pop-up, for a subject the page knows when it is drawn (the title on /club). */
export function ShareButton({ sub, first, locale, className = "" }: { sub: ShareSubject; first: string; locale: string; className?: string }) {
  const [n, setN] = useState(0);
  const btn = useRef<HTMLButtonElement>(null);
  const w = shareWords(locale);
  return (
    <>
      <button type="button" ref={btn} className={`shr-btn ${className}`.trim()} onClick={() => setN((k) => k + 1)}><ShareIc /><span>{w.share}</span></button>
      {n > 0 && <ShareImage key={n} sub={sub} first={first} locale={locale} onDone={() => { setN(0); btn.current?.focus({ preventScroll: true }); }} />}
    </>
  );
}
