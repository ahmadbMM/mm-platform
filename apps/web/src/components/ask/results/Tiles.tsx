"use client";

import { useMemo, useRef } from "react";
import { choiceRows, cloudResult, pointRows } from "@/lib/ask";
import { floored, squarify } from "@/lib/ask-charts";
import { lookWords, seriesColor } from "@/lib/ask-look";
import { cloudKey, colorOf } from "@/lib/word-cloud";
import { Total } from "./Total";
import { useBox, valueLine } from "./parts";
import type { ResultProps } from "./types";

// Tiles (a treemap): one box cut into a tile a thing, each tile's area its share of the whole, the largest first.
// Every tile is written on - its name and its numbers, in white or ink, whichever reads on its colour - with a line of
// the card between tiles. A thing with a small share still gets a tile large enough for its name (the numbers stay the
// true ones). The tiles glide to their new shapes; a screen reader gets the same as a list.
type Tile = { id: string; label: string; value: number; line: string; fill: string; on: string };

function Treemap({ tiles, screen, least, narrowMost = 0 }: { tiles: Tile[]; screen: boolean; least: number; narrowMost?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const box = useBox(ref);
  // a narrow box draws fewer tiles when the chart asks (a word cloud's, until staff set how many): each keeps room for its name
  const few = !!box && box.width < 460 && narrowMost > 0 ? narrowMost : 0;
  const live = useMemo(() => {
    const all = tiles.filter((x) => x.value > 0).map((x, i) => ({ x, i })).sort((p, q) => q.x.value - p.x.value || p.i - q.i).map(({ x }) => x);
    return few ? all.slice(0, few) : all;
  }, [tiles, few]);
  const rects = useMemo(() => (box ? squarify(floored(live.map((x) => x.value), least), box.width, box.height) : []), [box, live, least]);
  const most = screen && box ? Math.max(26, box.height * 0.11) : 26, small = screen && box ? Math.max(10.5, box.height * 0.03) : 10.5;
  return (
    <div ref={ref} className="ask-tiles" aria-hidden="true">
      {box && live.map((tile, i) => {
        const r = rects[i];
        if (!r || r.w < 3 || r.h < 3) return null;
        const w = r.w - 2, h = r.h - 2;
        const pad = Math.max(3, Math.min(w, h) * 0.09);
        const inner = w - pad * 2, high = h - pad * 2;
        // The name is set at the size its longest word fits the tile's width, on as many lines as its words need -
        // smaller while it would not fit the tile's height with its numbers under it. A word too long for the tile
        // at the smallest size is cut with an ellipsis (the list beside the chart has it whole).
        const words = tile.label.trim().split(/\s+/).map((x) => [...x].length);
        const longest = Math.max(...words, 1);
        const wrap = (size: number) => {
          const perLine = Math.max(1, Math.floor(inner / (size * 0.62)));
          let lines = 1, run = 0;
          for (const n of words) { if (run && run + 1 + n > perLine) { lines++; run = n; } else run = run ? run + 1 + n : n; }
          return lines;
        };
        // (a letter is taken as 0.62 of its size wide: the site's bold faces run close to that)
        let size = Math.min(Math.max(small, Math.min(most, inner / (Math.min(longest, 14) * 0.62))), Math.max(small, high * 0.36));
        const extra = tile.line ? 0.86 : 0;
        while (size > small && (wrap(size) + extra) * size * 1.14 > high) size = Math.max(small, size * 0.92);
        const fits = longest * size * 0.62 <= inner + 0.5;
        const room = Math.floor(high / (size * 1.14));
        const named = inner >= size * 1.8 && room >= 1;
        const lines = Math.max(1, Math.min(fits ? wrap(size) : 1, room, 3));
        const figured = named && !!tile.line && high >= (lines + 0.8) * size * 1.14;
        return (
          <div key={tile.id} className="ask-tile" title={`${tile.label}${tile.line ? `: ${tile.line}` : ""}`}
            style={{ left: r.x + 1, top: r.y + 1, width: w, height: h, padding: pad, fontSize: size, background: tile.fill, color: tile.on }}>
            {named && <span className={`ask-tile-name${fits ? "" : " one"}`} dir="auto" style={fits ? { WebkitLineClamp: lines } : undefined}>{tile.label}</span>}
            {figured && <span className="ask-tile-val">{tile.line}</span>}
          </div>
        );
      })}
    </div>
  );
}

/** Multiple choice as tiles: each option's part of everything picked. An option nobody picked has no tile; it is
 *  named under the tiles. */
export function ChoiceTiles({ q, result, locale, t, look, screen, colors }: ResultProps) {
  const { n, rows } = choiceRows(q.config, result, locale);
  const picked = rows.reduce((a, r) => a + r.n, 0);
  const line = (count: number) => valueLine(look, count, picked ? count / picked : 0, locale);
  const tiles = rows.map((r, i) => { const c = seriesColor(colors, i); return { id: r.id, label: r.label, value: r.n, line: line(r.n), fill: c.fill, on: c.on }; });
  const none = rows.filter((r) => r.n === 0);
  return (
    <>
      <Total n={n} t={t} show={look.total && !screen} />
      {n > 0 && (
        <>
          <Treemap tiles={tiles} screen={screen} least={0.045} />
          {none.length > 0 && <p className="ask-rest" aria-hidden="true">{none.map((r) => <span key={r.id}><span dir="auto">{r.label}</span> <span className="mm-lat">0</span></span>)}</p>}
          <ul className="mm-sr">{rows.map((r) => <li key={r.id}><span dir="auto">{r.label}</span>{r.correct ? ` (${t.correct})` : ""}: {valueLine({ ...look, values: "both" }, r.n, picked ? r.n / picked : 0, locale)}</li>)}</ul>
        </>
      )}
    </>
  );
}

/** Points as tiles: each option's part of all the points given, with its average. */
export function PointTiles({ q, result, locale, t, look, screen, colors }: ResultProps) {
  const { n, rows } = pointRows(q.config, result, locale);
  const given = rows.reduce((a, r) => a + r.avg, 0);
  const tiles = rows.map((r, i) => { const c = seriesColor(colors, i); return { id: r.id, label: r.label, value: r.avg, line: valueLine(look, r.avg, given ? r.avg / given : 0, locale), fill: c.fill, on: c.on }; });
  const none = rows.filter((r) => r.avg === 0);
  return (
    <>
      <Total n={n} t={t} show={look.total && !screen} />
      {n > 0 && (
        <>
          <Treemap tiles={tiles} screen={screen} least={0.045} />
          {none.length > 0 && <p className="ask-rest" aria-hidden="true">{none.map((r) => <span key={r.id}><span dir="auto">{r.label}</span> <span className="mm-lat">0</span></span>)}</p>}
          <ul className="mm-sr">{rows.map((r) => <li key={r.id}><span dir="auto">{r.label}</span>: {valueLine({ ...look, values: "both" }, r.avg, given ? r.avg / given : 0, locale)}</li>)}</ul>
        </>
      )}
    </>
  );
}

/** A word cloud as tiles: the most sent words, each tile its part of them, in the colour the word keeps everywhere. */
export function CloudTiles({ result, locale, t, look, viz, screen, colors }: ResultProps) {
  const { n, words: sent } = useMemo(() => cloudResult(result), [result]);
  const words = useMemo(() => lookWords(sent, look, viz, locale), [sent, look, viz, locale]);
  const tiles = useMemo(() => words.map((x) => { const k = colorOf(cloudKey(x.w)); return { id: x.w, label: x.w, value: x.n, line: valueLine(look, x.n, n ? x.n / n : 0, locale), fill: colors.fills[k], on: colors.on[k] }; }), [words, look, n, locale, colors]);
  return (
    <>
      <Total n={n} t={t} show={look.total && !screen} />
      {words.length > 0 && (
        <>
          <Treemap tiles={tiles} screen={screen} least={0.03} narrowMost={look.limit === null ? 10 : 0} />
          <ul className="mm-sr">{words.map((x) => <li key={x.w} dir="auto">{x.w}{x.n > 1 ? ` (${x.n})` : ""}</li>)}</ul>
        </>
      )}
    </>
  );
}
