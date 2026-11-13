"use client";

import { askNum, askText, numberConfig, numberResult, type NumberResult } from "@/lib/ask";
import { between, dial, onDial } from "@/lib/ask-charts";
import type { AskWords } from "../Ask.text";
import { IconCheck } from "../icons";
import { Total } from "./Total";
import { useTween } from "./parts";
import { cssVars, type ResultProps } from "./types";

// A number, three ways. Histogram: the average as the figure and the answers as thin columns standing on one line,
// each with its count over it, and a mark under the line where the average falls. Gauge: the average on a half dial
// from the question's lowest number to its highest. Strip: one line from the lowest to the highest - a dot a group of
// answers, larger the more gave it, the band between the lowest and the highest given, and the average marked. Each
// says its numbers in words beside the picture, and a hidden list gives every group.

const unitOf = (q: ResultProps["q"], locale: string) => { const c = numberConfig(q.config); return { c, unit: askText(locale, c.unit_en, c.unit_ar) }; };
const withUnit = (v: number, unit: string, locale: string) => `${askNum(v, locale)}${unit ? ` ${unit}` : ""}`;

/** The right answer, once staff show it. */
function RightFigure({ value, t }: { value: string; t: AskWords }) {
  return <span className="ask-figure-right"><IconCheck size={15} /><span>{t.correct}</span> <b dir="auto">{value}</b></span>;
}
/** What a screen reader reads of a number's chart: the least and the most given, and every group with its count. */
function Spoken({ r, unit, t, locale }: { r: NumberResult; unit: string; t: AskWords; locale: string }) {
  return (
    <ul className="mm-sr">
      {r.min !== null && <li>{t.lowest(withUnit(r.min, unit, locale))}</li>}
      {r.max !== null && <li>{t.highest(withUnit(r.max, unit, locale))}</li>}
      {r.bins.map((b, i) => <li key={i}>{askNum(b.lo, locale, 2)} - {askNum(b.hi, locale, 2)}: {b.n}</li>)}
    </ul>
  );
}

export function NumberHistogram({ q, result, locale, t, look, screen }: ResultProps) {
  const r = numberResult(result);
  const { unit } = unitOf(q, locale);
  if (r.n < 1) return <Total n={r.n} t={t} />;
  const from = r.bins.length ? r.bins[0].lo : null, to = r.bins.length ? r.bins[r.bins.length - 1].hi : null;
  const at = (v: number | null) => (v === null || from === null || to === null || !(to > from) ? null : between(v, from, to));
  const avgAt = at(r.avg), rightAt = at(r.correct);
  return (
    <>
      <Total n={r.n} t={t} show={look.total && !screen} />
      <p className="ask-figure">
        {r.avg !== null && <span dir="auto">{t.average(withUnit(r.avg, unit, locale))}</span>}
        {r.correct !== null && <RightFigure value={withUnit(r.correct, unit, locale)} t={t} />}
      </p>
      {r.bins.length > 0 && (
        <div className="ask-hist" aria-hidden="true">
          <div className="ask-hist-plot">
            {r.bins.map((b, i) => (
              <span key={i} className="ask-hist-col">
                <span className="ask-hist-n">{b.n > 0 && look.values !== "none" ? (look.values === "percent" ? `${Math.round((b.n / r.n) * 100)}%` : b.n) : ""}</span>
                <span className="ask-hist-bar" style={cssVars({ "--ask-h": r.most ? b.n / r.most : 0 })} data-none={b.n ? undefined : ""} />
              </span>
            ))}
          </div>
          <div className="ask-hist-marks">
            {avgAt !== null && <span className="ask-hist-avg" style={{ insetInlineStart: `${avgAt * 100}%` }} />}
            {rightAt !== null && <span className="ask-hist-avg ask-hist-right" style={{ insetInlineStart: `${rightAt * 100}%` }} />}
          </div>
          <div className="ask-hist-axis"><span>{from === null ? "" : askNum(from, locale, 2)}</span><span>{to === null ? "" : askNum(to, locale, 2)}</span></div>
        </div>
      )}
      <Spoken r={r} unit={unit} t={t} locale={locale} />
    </>
  );
}

export function NumberGauge({ q, result, locale, t, look, screen }: ResultProps) {
  const r = numberResult(result);
  const { c, unit } = unitOf(q, locale);
  const [at] = useTween([r.avg === null ? 0 : between(r.avg, c.min, c.max)]);
  if (r.n < 1) return <Total n={r.n} t={t} />;
  const [x, y] = onDial(100, 100, 84, at);
  const right = r.correct === null ? null : between(r.correct, c.min, c.max);
  return (
    <>
      <Total n={r.n} t={t} show={look.total && !screen} />
      <div className="ask-gauge">
        <svg viewBox="0 0 200 112" aria-hidden="true" focusable="false">
          <path className="ask-gauge-track" d={dial(100, 100, 84, 0, 1)} />
          <path className="ask-gauge-fill" d={dial(100, 100, 84, 0, at)} />
          {right !== null && (() => { const [x0, y0] = onDial(100, 100, 72, right), [x1, y1] = onDial(100, 100, 96, right); return <line className="ask-gauge-right" x1={x0} y1={y0} x2={x1} y2={y1} />; })()}
          {r.avg !== null && <circle className="ask-gauge-dot" cx={x} cy={y} r={9} />}
        </svg>
        {r.avg !== null && look.values !== "none" && <p className="ask-gauge-mid" dir="auto">{t.average(withUnit(r.avg, unit, locale))}</p>}
        <p className="ask-hist-axis" aria-hidden="true"><span>{askNum(c.min, locale, 2)}</span><span>{askNum(c.max, locale, 2)}</span></p>
      </div>
      {r.correct !== null && <p className="ask-figure"><RightFigure value={withUnit(r.correct, unit, locale)} t={t} /></p>}
      <Spoken r={r} unit={unit} t={t} locale={locale} />
    </>
  );
}

export function NumberStrip({ q, result, locale, t, look, screen }: ResultProps) {
  const r = numberResult(result);
  const { c, unit } = unitOf(q, locale);
  if (r.n < 1) return <Total n={r.n} t={t} />;
  const at = (v: number) => between(v, c.min, c.max) * 100;
  const groups = r.bins.filter((b) => b.n > 0);
  // every group says its count while there is room for the numbers; past that only the fullest do
  const cut = groups.length <= 12 ? 0 : [...groups].sort((a, b) => b.n - a.n)[2]?.n ?? 0;
  return (
    <>
      <Total n={r.n} t={t} show={look.total && !screen} />
      <div className="ask-strip" aria-hidden="true">
        <div className="ask-strip-line">
          {r.min !== null && r.max !== null && <span className="ask-strip-band" style={{ insetInlineStart: `${at(r.min)}%`, inlineSize: `${Math.max(0, at(r.max) - at(r.min))}%` }} />}
          {groups.map((b, i) => (
            <span key={i} className="ask-strip-dot" style={{ insetInlineStart: `${at((b.lo + b.hi) / 2)}%`, ...cssVars({ "--ask-d": Math.sqrt(r.most ? b.n / r.most : 0) }) }}>
              {look.values !== "none" && b.n >= cut && <span className="ask-strip-n">{look.values === "percent" ? `${Math.round((b.n / r.n) * 100)}%` : b.n}</span>}
            </span>
          ))}
          {r.avg !== null && <span className="ask-strip-avg" style={{ insetInlineStart: `${at(r.avg)}%` }} />}
          {r.correct !== null && <span className="ask-strip-avg ask-strip-right" style={{ insetInlineStart: `${at(r.correct)}%` }} />}
        </div>
        <div className="ask-hist-axis"><span>{askNum(c.min, locale, 2)}</span><span>{askNum(c.max, locale, 2)}</span></div>
      </div>
      <ul className="ask-strip-key">
        {r.avg !== null && <li><span className="ask-strip-glyph avg" aria-hidden="true" /><b dir="auto">{t.average(withUnit(r.avg, unit, locale))}</b></li>}
        {r.min !== null && r.max !== null && <li><span className="ask-strip-glyph band" aria-hidden="true" /><span dir="auto">{t.lowest(withUnit(r.min, unit, locale))}</span><span dir="auto">{t.highest(withUnit(r.max, unit, locale))}</span></li>}
        {r.correct !== null && <li><RightFigure value={withUnit(r.correct, unit, locale)} t={t} /></li>}
      </ul>
      <ul className="mm-sr">{r.bins.map((b, i) => <li key={i}>{askNum(b.lo, locale, 2)} - {askNum(b.hi, locale, 2)}: {b.n}</li>)}</ul>
    </>
  );
}
