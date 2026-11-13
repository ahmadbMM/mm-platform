"use client";

import { useMemo, useRef } from "react";
import { cloudResult } from "@/lib/ask";
import { floored, packCircles } from "@/lib/ask-charts";
import { lookWords } from "@/lib/ask-look";
import { cloudKey, colorOf } from "@/lib/word-cloud";
import { Total } from "./Total";
import { fitSize, useBox, valueLine } from "./parts";
import type { ResultProps } from "./types";

// A word cloud as packed circles: a circle a word, its area the word's share of what was sent, the most sent in the
// middle. The word and how many sent it are written inside, in white or ink, whichever reads on the circle's colour -
// the colour the word keeps in every chart. Circles never touch. A narrow box draws fewer of them (unless staff set
// how many), so each can still carry its word. They glide as the counts change; a screen reader gets a list.
export function CloudBubbles({ result, locale, t, look, viz, screen, colors }: ResultProps) {
  const { n, words: sent } = useMemo(() => cloudResult(result), [result]);
  const ref = useRef<HTMLDivElement>(null);
  const some = sent.length > 0;
  const box = useBox(ref, some);
  const narrow = !!box && box.width < 480;
  const words = useMemo(() => {
    const all = lookWords(sent, look, viz, locale);
    return look.limit === null && narrow ? all.slice(0, 14) : all;
  }, [sent, look, viz, locale, narrow]);
  const width = box?.width ?? 0, height = box?.height ?? 0;
  const laid = useMemo(() => {
    if (!width || !height || !words.length) return null;
    const radii = floored(words.map((x) => x.n), 0.022).map((a) => Math.sqrt(a) * 100);
    const pack = packCircles(radii, width / height, 1.4);
    if (!pack.width || !pack.height) return null;
    const k = Math.min(width / pack.width, height / pack.height);
    const dx = (width - pack.width * k) / 2, dy = (height - pack.height * k) / 2;
    return pack.circles.map((c, i) => ({ word: words[i], x: dx + c.x * k, y: dy + c.y * k, r: c.r * k }));
  }, [words, width, height]);
  const least = screen ? Math.max(11, height * 0.028) : 10.5;
  return (
    <>
      <Total n={n} t={t} show={look.total && !screen} />
      {some && (
        <>
          <div ref={ref} className="ask-bubbles" aria-hidden="true">
            {laid?.map(({ word, x, y, r }) => {
              const k = colorOf(cloudKey(word.w));
              const line = valueLine(look, word.n, n ? word.n / n : 0, locale);
              // a name of several words may take two lines, sized by its longest word; one word keeps to one line
              const parts = word.w.trim().split(/\s+/), all = [...word.w].length;
              const longest = Math.max(...parts.map((x) => [...x].length));
              const two = parts.length > 1 && all > 8;
              const size = fitSize(Math.min(two ? Math.max(longest, Math.ceil(all / 2)) : all, 11), r * 1.66, least, Math.max(least, r * 0.46));
              const named = r * 2 >= size * (two ? 3.3 : 2.6);
              const figured = named && !!line && r * 2 >= size * (two ? 4.3 : 3.3);
              return (
                <span key={word.w} className="ask-bub" title={`${word.w}${line ? `: ${line}` : ""}`}
                  style={{ width: r * 2, height: r * 2, transform: `translate(${x - r}px, ${y - r}px)`, fontSize: size, background: colors.fills[k], color: colors.on[k] }}>
                  {named && <span className={`ask-bub-name${two ? " two" : ""}`} dir="auto">{word.w}</span>}
                  {figured && <span className="ask-bub-val">{line}</span>}
                </span>
              );
            })}
          </div>
          <ul className="mm-sr">{words.map((x) => <li key={x.w} dir="auto">{x.w}{x.n > 1 ? ` (${x.n})` : ""}</li>)}</ul>
        </>
      )}
    </>
  );
}
