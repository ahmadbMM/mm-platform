"use client";

import { useMemo, type ReactNode } from "react";
import { choiceRows, cloudResult, pointRows, rankRows } from "@/lib/ask";
import { lookWords } from "@/lib/ask-look";
import { IconCheck } from "../icons";
import type { AskWords } from "../Ask.text";
import { Total } from "./Total";
import { Values, sortRows, useFlip } from "./parts";
import { cssVars, type ResultProps } from "./types";

// Horizontal bars: one hue for every bar (the palette's mark), each growing from the same edge with its end rounded,
// thin, on a track a lighter step of the same hue - or bare, where the longest bar is the measure (top words). The
// name and the numbers are written beside it in the text's own colours, so the list reads whole without the bars: it
// is its own alternative for a screen reader. A row slides to its new place when the order changes.
type Bar = { id: string; label: string; share: number; value: ReactNode; mark?: ReactNode };

export function BarList({ bars, numbered = false, bare = false }: { bars: Bar[]; numbered?: boolean; bare?: boolean }) {
  const ref = useFlip<HTMLOListElement & HTMLUListElement>(bars.map((b) => b.id).join("\n"));
  const Tag = numbered ? "ol" : "ul";
  return (
    <Tag ref={ref} className={`ask-bars${bare ? " bare" : ""}`} data-many={bars.length > 6 ? "" : undefined} style={cssVars({ "--ask-rows": bars.length, "--ask-half": Math.ceil(bars.length / 2) })}>
      {bars.map((b, i) => (
        <li key={b.id} data-flip={b.id} className="ask-bar">
          <span className="ask-bar-label">{numbered && <span className="ask-bar-no" aria-hidden="true">{i + 1}</span>}<span dir="auto">{b.label}</span>{b.mark}</span>
          {b.value}
          <span className="ask-bar-track" aria-hidden="true"><span className="ask-bar-fill" style={{ inlineSize: `${Math.round(b.share * 1000) / 10}%` }} /></span>
        </li>
      ))}
    </Tag>
  );
}

/** The mark beside a right answer, once staff show it. */
export const Right = ({ t }: { t: AskWords }) => <span className="ask-right"><IconCheck size={14} /><span className="mm-sr">{t.correct}</span></span>;

/** Multiple choice: every option with how many picked it and their share of the people who answered. */
export function ChoiceBars({ q, result, locale, t, look, screen }: ResultProps) {
  const { n, rows } = choiceRows(q.config, result, locale);
  return (
    <>
      <Total n={n} t={t} show={look.total && !screen} />
      {n > 0 && <BarList bars={sortRows(rows, look.sort, (r) => r.n).map((r) => ({
        id: r.id, label: r.label, share: r.share,
        value: <Values look={look} count={r.n} share={r.share} locale={locale} />,
        mark: r.correct ? <Right t={t} /> : undefined,
      }))} />}
    </>
  );
}

/** Ranking: the options by score, the best first, numbered; each bar is its score beside the best one's. */
export function RankBars({ q, result, locale, t, look, screen }: ResultProps) {
  const { n, rows } = rankRows(q.config, result, locale);
  const all = rows.reduce((a, r) => a + r.score, 0);
  return (
    <>
      <Total n={n} t={t} show={look.total && !screen} />
      {n > 0 && <BarList numbered bare bars={rows.map((r) => ({ id: r.id, label: r.label, share: r.share, value: <Values look={look} count={r.score} share={all ? r.score / all : 0} locale={locale} /> }))} />}
    </>
  );
}

/** Points: each option's average, and the bar its part of the points a person has. */
export function PointBars({ q, result, locale, t, look, screen }: ResultProps) {
  const { n, rows } = pointRows(q.config, result, locale);
  return (
    <>
      <Total n={n} t={t} show={look.total && !screen} />
      {n > 0 && <BarList bars={sortRows(rows, look.sort, (r) => r.avg).map((r) => ({ id: r.id, label: r.label, share: r.share, value: <Values look={look} count={r.avg} share={r.share} locale={locale} /> }))} />}
    </>
  );
}

/** A word cloud's top words as bars: the most sent first, each beside the most sent one, with how many sent it and
 *  its share of everything sent. */
export function CloudBars({ result, locale, t, look, viz, screen }: ResultProps) {
  const { n, words: sent } = useMemo(() => cloudResult(result), [result]);
  const words = useMemo(() => lookWords(sent, look, viz, locale), [sent, look, viz, locale]);
  const top = words[0]?.n ?? 0;
  return (
    <>
      <Total n={n} t={t} show={look.total && !screen} />
      {words.length > 0 && <BarList numbered bare bars={words.map((x) => ({ id: x.w, label: x.w, share: top ? x.n / top : 0, value: <Values look={look} count={x.n} share={n ? x.n / n : 0} locale={locale} /> }))} />}
    </>
  );
}

/** A word cloud as a ranked list: the words in order, each with how many sent it - no marks, only type. */
export function CloudList({ result, locale, t, look, viz, screen }: ResultProps) {
  const { n, words: sent } = useMemo(() => cloudResult(result), [result]);
  const words = useMemo(() => lookWords(sent, look, viz, locale), [sent, look, viz, locale]);
  const ref = useFlip<HTMLOListElement>(words.map((x) => x.w).join("\n"));
  // the big screen's columns: two for a short list, more as it grows, each read downwards
  const cols = words.length <= 12 ? 2 : words.length <= 36 ? 3 : 4;
  return (
    <>
      <Total n={n} t={t} show={look.total && !screen} />
      {words.length > 0 && (
        <ol ref={ref} className="ask-rank-list" style={cssVars({ "--ask-rows": words.length, "--ask-cols": cols, "--ask-half": Math.ceil(words.length / cols) })}>
          {words.map((x, i) => (
            <li key={x.w} data-flip={x.w}>
              <span className="ask-bar-no" aria-hidden="true">{i + 1}</span>
              <span className="ask-rank-word"><span dir="auto">{x.w}</span></span>
              <Values look={look} count={x.n} share={n ? x.n / n : 0} locale={locale} />
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
