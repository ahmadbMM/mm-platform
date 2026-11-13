"use client";

import { useId, useRef } from "react";
import { routeDrawing, routeGpx, type RoutePoint } from "@/lib/route-track";
import { appleTouch } from "./TicketParts";

// "Route details" on My Account's ticket (lib/route-track.ts; the booking app's _rtBtn and route-page.js, 2026-11-13, new
// features F11): one button in the route's block, which opens the route's own page in a centred pop-up (a native dialog,
// as TicketDir's): the route's name, its line drawn from the stored points (north up, no base map), the distance, the
// surface and the level, the turn points in order, then Save GPX file (only with a line), Open the map (only with the
// Routes page's map link) and Close. The box takes the focus without a scroll, so the pop-up opens at its top. Save GPX
// writes the file here from the line: an iPhone or iPad hands it to its share sheet where it takes a file (a Home Screen
// app has no downloads), anything else downloads it; nothing is said after. Its words come ready in the page's language
// from the ticket (RoutePage.words.ts and the ticket's own).
export type RouteTurnView = { km: number; kmText: string; name: string };
export type RoutePageView = {
  name: string; file: string; href: string | null; pts: RoutePoint[]; turns: RouteTurnView[]; facts: [string, string, boolean][];
};
type Words = { open: string; title: string; turns: string; gpx: string; lineAlt: string; map: string; close: string };

export default function TicketRoutePage({ page, words }: { page: RoutePageView; words: Words }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const id = useId();
  const draw = routeDrawing(page.pts, page.turns.map((x) => x.km));

  function open() {
    const d = dlg.current;
    if (!d) return;
    d.showModal();
    d.scrollTop = 0;
    box.current?.focus({ preventScroll: true });
  }
  const close = () => dlg.current?.close();

  async function save() {
    if (page.pts.length < 2) return;
    const xml = routeGpx(page.name, page.pts, page.turns);
    if (appleTouch() && navigator.canShare) {
      try {
        const f = new File([xml], page.file, { type: "application/gpx+xml" });
        if (navigator.canShare({ files: [f] })) { await navigator.share({ files: [f] }); return; }
      } catch (e) {
        if ((e as { name?: string } | null)?.name === "AbortError") return; // the sheet was closed
      }
    }
    const url = URL.createObjectURL(new Blob([xml], { type: "application/gpx+xml" }));
    const a = document.createElement("a");
    a.href = url; a.download = page.file;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  return (
    <>
      <button type="button" className="tk-rt-a tk-rt-open" onClick={open}>{words.open}</button>
      <dialog ref={dlg} className="tk-dlg tk-rtp-dlg" aria-labelledby={`${id}-t`} onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}>
        <div ref={box} className="tk-dlg-in tk-rtp-in" tabIndex={-1}>
          <p className="tk-rtp-k">{words.title}</p>
          <h2 id={`${id}-t`} className="tk-dlg-t"><bdi>{page.name}</bdi></h2>
          {draw && (
            <svg className="tk-rtp-map" viewBox={`0 0 ${draw.w} ${draw.h}`} direction="ltr" role="img" aria-label={words.lineAlt} focusable="false">
              <path d={draw.d} />
              <circle className="tk-rtp-st" cx={draw.start[0]} cy={draw.start[1]} r="5.5" />
              {draw.marks.map(([x, y], i) => (
                <g key={i}><circle className="tk-rtp-tn" cx={x} cy={y} r="8" /><text x={x} y={Math.round((y + 3.5) * 10) / 10} textAnchor="middle">{i + 1}</text></g>
              ))}
            </svg>
          )}
          {page.facts.length > 0 && (
            <dl className="tk-rtp-facts">
              {page.facts.map(([k, v, num]) => <div key={k}><dt>{k}</dt><dd>{num ? <bdi>{v}</bdi> : v}</dd></div>)}
            </dl>
          )}
          {page.turns.length > 0 && (
            <div className="tk-rtp-sec">
              <h3 className="tk-rtp-h" id={`${id}-h`}>{words.turns}</h3>
              <ol className="tk-rtp-turns" aria-labelledby={`${id}-h`}>
                {page.turns.map((x, i) => (
                  <li key={i}><span className="tk-rtp-n" aria-hidden="true">{i + 1}</span><span className="tk-rtp-tname" dir="auto">{x.name}</span><bdi className="tk-rtp-km">{x.kmText}</bdi></li>
                ))}
              </ol>
            </div>
          )}
          <div className="tk-dlg-acts">
            {page.pts.length > 1 && <button type="button" className="tk-rtp-gpx" onClick={save}>{words.gpx}</button>}
            {page.href && <a className="tk-dlg-a" href={page.href} target="_blank" rel="noopener">{words.map}</a>}
            <button type="button" className="tk-rtp-close" onClick={close}>{words.close}</button>
          </div>
        </div>
      </dialog>
    </>
  );
}
