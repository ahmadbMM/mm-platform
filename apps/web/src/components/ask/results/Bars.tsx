import type { ReactNode } from "react";
import { askNum, askPct, choiceRows, pointRows, rankRows } from "@/lib/ask";
import { IconCheck } from "../icons";
import { Total } from "./Total";
import { cssVars, type ResultProps } from "./types";

// Horizontal bars: one hue for every bar (the palette's first), each growing from the same edge with its end rounded,
// thin, on a track a lighter step of the same hue. The name and the figures are written beside it in the text's own
// colours, so the list reads whole without the bars - it is its own alternative for a screen reader.
type Bar = { id: string; label: string; share: number; value: ReactNode; mark?: ReactNode };

function BarList({ bars, numbered = false }: { bars: Bar[]; numbered?: boolean }) {
  const Tag = numbered ? "ol" : "ul";
  return (
    <Tag className="ask-bars" style={cssVars({ "--ask-rows": bars.length })}>
      {bars.map((b, i) => (
        <li key={b.id} className="ask-bar">
          <span className="ask-bar-label">{numbered && <span className="ask-bar-no" aria-hidden="true">{i + 1}</span>}<span dir="auto">{b.label}</span>{b.mark}</span>
          <span className="ask-bar-value">{b.value}</span>
          <span className="ask-bar-track" aria-hidden="true"><span className="ask-bar-fill" style={{ inlineSize: `${Math.round(b.share * 1000) / 10}%` }} /></span>
        </li>
      ))}
    </Tag>
  );
}

/** Multiple choice: every option in the order staff wrote them, with how many picked it and their share. */
export function ChoiceBars({ q, result, locale, t }: ResultProps) {
  const { n, rows } = choiceRows(q.config, result, locale);
  return (
    <>
      <Total n={n} t={t} />
      {n > 0 && <BarList bars={rows.map((r) => ({
        id: r.id, label: r.label, share: r.share,
        value: <><span className="ask-bar-n">{r.n}</span><b>{askPct(r.share, locale)}</b></>,
        mark: r.correct ? <span className="ask-right"><IconCheck size={14} /><span className="mm-sr">{t.correct}</span></span> : undefined,
      }))} />}
    </>
  );
}

/** Ranking: the options by score, the best first, numbered. */
export function RankBars({ q, result, locale, t }: ResultProps) {
  const { n, rows } = rankRows(q.config, result, locale);
  return (
    <>
      <Total n={n} t={t} />
      {n > 0 && <BarList numbered bars={rows.map((r) => ({ id: r.id, label: r.label, share: r.share, value: null }))} />}
    </>
  );
}

/** Points: the options by their average, the most first; the bar is the average's part of the points a person has. */
export function PointBars({ q, result, locale, t }: ResultProps) {
  const { n, rows } = pointRows(q.config, result, locale);
  return (
    <>
      <Total n={n} t={t} />
      {n > 0 && <BarList bars={rows.map((r) => ({ id: r.id, label: r.label, share: r.share, value: <b>{askNum(r.avg, locale)}</b> }))} />}
    </>
  );
}
