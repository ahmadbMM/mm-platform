"use client";

import { useEffect, useRef, useState } from "react";
import { askNum, optionText, type AskQuestion } from "@/lib/ask";
import { axisName, gridConfig, gridResult, pinCells, pinResult, quizConfig, quizRows, quizTextResult, sentPin } from "@/lib/ask-kinds";
import { askImage } from "@/lib/ask-look";
import { IconCheck } from "../icons";
import { BarList, CloudList, Right } from "./Bars";
import { WordCloud } from "./Cloud";
import { ColumnChart } from "./Columns";
import { Total } from "./Total";
import { Legend, Values, seriesStyle } from "./parts";
import { cssVars, type ResultProps } from "./types";

// The results of the five kinds of stage 2 (contract H4 and H6).
//   grid       `scatter`: each item's averaged point on the same square it was placed on, as a numbered mark in its
//              colour, with a key that names it and says its two values
//   pin        `dots`: every pin a dot on the picture; `heat`: the picture under cells that say how many pins fell in
//              each; on reveal the right area is ringed; the viewer's own pin is drawn as a pin
//   quiz       `bars` / `columns`: drawn on reveal only - how many got it right, and the options (never sorted) with
//              the right one marked
//   quiz_text  `list` / `cloud`: on reveal how many were right and the accepted answers; the answers given most are
//              drawn when the database sends them (it sends them to staff only, as it stands)
//   form       nothing public but how many answered
// Nobody is named anywhere, and no score is shown: neither the page's functions nor the screen's carry any.

/** A grid's averaged points. */
export function GridScatter({ q, result, locale, t, look, screen, colors }: ResultProps) {
  const c = gridConfig(q.config);
  const { n, max, points, names } = gridResult(q.config, result, locale);
  const xName = axisName(locale, c, "x") || t.axisX, yName = axisName(locale, c, "y") || t.axisY;
  if (n < 1) return <Total n={n} t={t} />;
  return (
    <>
      <Total n={n} t={t} show={look.total && !screen} />
      <div className="ask-ring-wrap">
        <div className="ask-grid ask-grid-res" aria-hidden="true">
          <span className="ask-grid-y" dir="auto">{yName}</span>
          <div className="ask-grid-board"><div className="ask-grid-area">
            {points.map((p) => (
              <span key={p.id} className="ask-grid-mark set still" style={{ insetInlineStart: `${(p.x / max) * 100}%`, bottom: `${(p.y / max) * 100}%`, ...seriesStyle(colors, p.index) }}>
                <span className="mm-lat">{p.index + 1}</span>
              </span>
            ))}
          </div></div>
          <span className="ask-grid-x" dir="auto">{xName}</span>
        </div>
        <div className="ask-radar-key">
          {/* what the two numbers beside each name are: the two axes, in this order */}
          <p className="ask-key-head"><span dir="auto">{xName}</span><span aria-hidden="true"> · </span><span dir="auto">{yName}</span></p>
          <Legend numbered colors={colors} rows={names.map((o) => {
            const p = points.find((x) => x.id === o.id);
            return { id: o.id, label: o.label, index: o.index, value: p ? <span className="ask-val"><b>{askNum(p.x, locale)} · {askNum(p.y, locale)}</b></span> : null };
          })} />
        </div>
      </div>
    </>
  );
}

const HEAT_COLS = 10, HEAT_ROWS = 8;
function Pins({ q, result, t, look, screen, own, heat }: ResultProps & { heat: boolean }) {
  const { n, pins, correct } = pinResult(result);
  const image = askImage(q.image, 1280);
  const mine = sentPin(own?.value);
  const cells = heat ? pinCells(pins, HEAT_COLS, HEAT_ROWS) : null;
  // the picture's own shape (width over height), known once it has loaded: the big screen fits the picture into its
  // panel by it, so every pin stays on the spot it was dropped on
  const pic = useRef<HTMLImageElement>(null);
  const [shape, setShape] = useState<number | null>(null);
  const measure = () => { const el = pic.current; if (el && el.naturalWidth && el.naturalHeight) setShape(Math.round((el.naturalWidth / el.naturalHeight) * 1000) / 1000); };
  useEffect(() => { const id = requestAnimationFrame(measure); return () => cancelAnimationFrame(id); }, [image]);
  return (
    <>
      <Total n={n} t={t} show={look.total && !screen} />
      {image && (
        <div className="ask-pin ask-pin-res" style={shape ? cssVars({ "--ask-shape": shape }) : undefined}>
          <img ref={pic} src={image} alt="" decoding="async" onLoad={measure} />
          <div className="ask-pin-layer" aria-hidden="true">
            {cells
              ? <div className="ask-pin-heat" style={cssVars({ "--ask-cols": HEAT_COLS, "--ask-rows": HEAT_ROWS })}>
                  {cells.counts.map((count, i) => <span key={i} className="ask-pin-cell" data-step={count && cells.most ? Math.min(4, Math.max(0, Math.ceil((count / cells.most) * 5) - 1)) : undefined}>{count > 0 ? <span className="mm-lat">{count}</span> : null}</span>)}
                </div>
              : pins.map((p, i) => <span key={i} className="ask-pin-dot" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }} />)}
            {correct && <span className="ask-pin-ring" style={{ left: `${correct.x * 100}%`, top: `${correct.y * 100}%`, width: `${correct.r * 200}%` }} />}
            {mine && <span className="ask-pin-mark still" style={{ left: `${mine.x * 100}%`, top: `${mine.y * 100}%` }} />}
          </div>
          {mine && <span className="mm-sr">{t.yourAnswer}: {t.pinAt(Math.round(mine.x * 100), Math.round(mine.y * 100))}</span>}
        </div>
      )}
    </>
  );
}
/** Every pin a dot on the picture. */
export const PinDots = (p: ResultProps) => <Pins {...p} heat={false} />;
/** The picture under cells of how many pins fell in each. */
export const PinHeat = (p: ResultProps) => <Pins {...p} heat />;

/** How many got a revealed quiz question right. */
function GotRight({ right, n, t }: { right: number | null; n: number; t: ResultProps["t"] }) {
  return right === null || n < 1 ? null : <p className="ask-figure"><span>{t.gotRight(right, n)}</span></p>;
}
/** A quiz as bars: the options in the order staff wrote them. */
export function QuizBars({ q, result, locale, t, look, screen }: ResultProps) {
  const { n, rows, right } = quizRows(q.config, result, locale);
  return (
    <>
      <Total n={n} t={t} show={look.total && !screen} />
      <GotRight right={right} n={n} t={t} />
      {n > 0 && <BarList bars={rows.map((r) => ({ id: r.id, label: r.label, share: r.share, value: <Values look={look} count={r.n} share={r.share} locale={locale} />, mark: r.correct ? <Right t={t} /> : undefined }))} />}
    </>
  );
}
/** A quiz as columns. */
export function QuizColumns({ q, result, locale, t, look, screen, colors }: ResultProps) {
  const { n, rows, right } = quizRows(q.config, result, locale);
  return (
    <>
      <Total n={n} t={t} show={look.total && !screen} />
      <GotRight right={right} n={n} t={t} />
      {n > 0 && <ColumnChart rows={rows} look={look} locale={locale} t={t} screen={screen} colors={colors} />}
    </>
  );
}

function QuizText(p: ResultProps & { cloud: boolean }) {
  const { result, t, look, screen, cloud } = p;
  const r = quizTextResult(result);
  // the answers given most, drawn with the word cloud's own chart or its ranked list - when the database sends them
  const top = r.top.length ? { n: r.n, words: r.top } : null;
  const quiet = { ...look, total: false };
  return (
    <>
      <Total n={r.n} t={t} show={look.total && !screen} />
      <GotRight right={r.right} n={r.n} t={t} />
      {/* on the big screen with nothing else to draw, the accepted answers are the chart: large, for the room */}
      {r.correct.length > 0 && <p className={`ask-reveal${screen && !top ? " ask-reveal-big" : ""}`}><span className="ask-right" aria-hidden="true"><IconCheck size={14} /></span><span>{t.correct}</span> <b dir="auto">{r.correct.join(" · ")}</b></p>}
      {top && (cloud ? <WordCloud {...p} look={quiet} result={top} /> : <CloudList {...p} look={quiet} result={top} />)}
    </>
  );
}
/** A typed quiz, its answers given most as a ranked list. */
export const QuizTextList = (p: ResultProps) => <QuizText {...p} cloud={false} />;
/** A typed quiz, its answers given most as a word cloud. */
export const QuizTextCloud = (p: ResultProps) => <QuizText {...p} cloud />;

/** A form: how many answered, and nothing else. */
export function FormCount({ result, t, look, screen }: ResultProps) {
  const n = Math.max(0, Number((result as { n?: unknown } | null)?.n) || 0);
  return <Total n={n} t={t} show={look.total && !screen} />;
}

/** A quiz question's options as the big screen shows them before the reveal: the words alone, no counts. */
export function QuizOptions({ q, locale }: { q: AskQuestion; locale: string }) {
  return (
    <ul className="ask-quiz ask-quiz-show">
      {quizConfig(q.config).options.map((o) => <li key={o.id} className="ask-qopt"><span className="ask-qopt-text" dir="auto">{optionText(locale, o)}</span></li>)}
    </ul>
  );
}
