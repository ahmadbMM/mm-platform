"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cloudResult } from "@/lib/ask";
import { lookWords } from "@/lib/ask-look";
import { layoutCloud } from "@/lib/word-cloud";
import { Total } from "./Total";
import type { ResultProps } from "./types";

// The word cloud: every answer once, sized by how many sent it (lib/word-cloud.ts lays it out for the box's width,
// and on the big screen for its height too). The words are measured in the page's own font, again once its files
// have loaded. Each word keeps its colour (one of the palette's six, from its text) and glides to its new place as
// the cloud changes. The look sets how many words there are, their case, and whether some stand on their side. On a
// page the box grows when the cloud needs more room and never shrinks under the reader. A screen reader gets the same
// answers as a list, with how many sent each.
let canvas: HTMLCanvasElement | null = null;
const rulers = new Map<string, (text: string) => number>();
/** A ruler for a font: a text's width at 100px. `fonts` counts the times the page's font files have come in - a new
 *  count is a new ruler, since what was measured before them was measured in a stand-in face. */
function rulerFor(font: string, fonts: number): (text: string) => number {
  const name = `${fonts}|${font}`;
  let ruler = rulers.get(name);
  if (ruler) return ruler;
  canvas ??= document.createElement("canvas");
  const pen = canvas.getContext("2d");
  if (!pen) return (s) => [...s].length * 55;
  const seen = new Map<string, number>();
  ruler = (s) => {
    let w = seen.get(s);
    if (w === undefined) {
      pen.font = `700 100px ${font}`;
      seen.set(s, (w = pen.measureText(s).width));
    }
    return w;
  };
  rulers.set(name, ruler);
  return ruler;
}

type Box = { width: number; height: number; font: string; fonts: number };

export function WordCloud({ result, t, screen, look, viz, locale }: ResultProps) {
  const { n, words: sent } = useMemo(() => cloudResult(result), [result]);
  const words = useMemo(() => lookWords(sent, look, viz, locale), [sent, look, viz, locale]);
  const area = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);

  // The cloud's box, and its font once the page's fonts have loaded (the words are measured in it). The box is there
  // only once there is a word to draw, so it is measured from then. Its height is the layout's own on a page (not
  // measured: the layout sets it), and the screen's on the big screen.
  const some = words.length > 0;
  useEffect(() => {
    const el = area.current;
    if (!el || !some) return;
    const read = (fontsLoaded: boolean) => setBox((b) => {
      const width = Math.floor(el.clientWidth), height = screen ? Math.floor(el.clientHeight) : 0, font = getComputedStyle(el).fontFamily;
      const fonts = (b?.fonts ?? 0) + (fontsLoaded ? 1 : 0);
      return b && b.width === width && b.height === height && b.font === font && b.fonts === fonts ? b : { width, height, font, fonts };
    });
    read(false);
    const watch = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => read(false));
    watch?.observe(el);
    document.fonts?.ready.then(() => read(true)).catch(() => {});
    return () => watch?.disconnect();
  }, [some, screen]);

  const width = box?.width ?? 0, height = box?.height ?? 0, font = box?.font ?? "", fonts = box?.fonts ?? 0;
  const mixed = look.angle === "mixed";
  const laid = useMemo(() => {
    if (!width || !words.length) return null;
    return layoutCloud(words, width, rulerFor(font, fonts), screen ? { height, mixed } : { mixed });
  }, [words, width, height, font, fonts, screen, mixed]);
  // the tallest the cloud has been at this width: the box under the reader only ever grows
  const [most, setMost] = useState({ width: 0, height: 0 });
  const laidHeight = laid?.height ?? 0;
  useEffect(() => {
    if (!laidHeight || screen) return;
    const id = requestAnimationFrame(() => setMost((m) => {
      const tall = m.width === width ? Math.max(m.height, laidHeight) : laidHeight;
      return m.width === width && m.height === tall ? m : { width, height: tall };
    }));
    return () => cancelAnimationFrame(id);
  }, [laidHeight, width, screen]);
  const drawn = Math.max(laidHeight, most.width === width ? most.height : 0);

  return (
    <>
      <Total n={n} t={t} show={look.total && !screen} />
      {some && (
        <>
          <div ref={area} className="ask-cloud" aria-hidden="true" style={laid && !screen ? { height: drawn } : undefined}>
            {laid?.items.map((p) => (
              <span key={p.w} dir="auto" className={`ask-w ask-c${p.color}${p.turned ? " turned" : ""}`}
                style={{ fontSize: p.size, width: p.width, height: p.height, lineHeight: `${p.turned ? p.width : p.height}px`, transform: `translate(${p.x}px, ${p.y + (drawn - laid.height) / 2}px)` }}>{p.w}</span>
            ))}
          </div>
          <ul className="mm-sr">
            {words.map((x) => <li key={x.w} dir="auto">{x.w}{x.n > 1 ? ` (${x.n})` : ""}</li>)}
          </ul>
        </>
      )}
    </>
  );
}
