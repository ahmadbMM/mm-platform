"use client";

import { askNum, askText, scaleRows, scalesConfig, type ScaleRow } from "@/lib/ask";
import { radar } from "@/lib/ask-charts";
import { onColor, ramp } from "@/lib/ask-look";
import type { AskWords } from "../Ask.text";
import { Total } from "./Total";
import { Legend, sortRows, useTween } from "./parts";
import { cssVars, type ResultProps } from "./types";

// Scales, four ways. Tracks: each statement's average on a track from the lowest mark to the highest, with how many
// gave each mark under it. Radar: the averages as one shape on an axis a statement (three or more). Stacked: each
// statement's answers as one whole bar, cut by mark in steps of one hue. Heat: a table of statements by marks, each
// cell darker the more people gave that mark. Every one says its numbers in words: a hidden list, a key, or the table
// itself.

/** What a screen reader reads of a scales chart: each statement, its average, and how many gave each mark. */
function Spoken({ rows, min, t, locale }: { rows: ScaleRow[]; min: number; t: AskWords; locale: string }) {
  return (
    <ul className="mm-sr">
      {rows.map((r) => (
        <li key={r.id}><span dir="auto">{r.label}</span>: {r.avg === null ? "" : `${t.average(askNum(r.avg, locale))}; `}{r.dist.map((count, i) => `${min + i}: ${count}`).join(", ")}</li>
      ))}
    </ul>
  );
}
const byAverage = (r: ScaleRow) => r.avg ?? -1e9;
/** What the two ends of the scale mean, under or over a chart: the lowest mark and its words, the highest and its. */
function Ends({ min, max, lo, hi }: { min: number; max: number; lo: string; hi: string }) {
  return <span className="ask-track-ends"><span><span className="mm-lat">{min}</span>{lo && <span dir="auto"> {lo}</span>}</span><span>{hi && <span dir="auto">{hi} </span>}<span className="mm-lat">{max}</span></span></span>;
}

export function ScaleTracks({ q, result, locale, t, look, screen }: ResultProps) {
  const c = scalesConfig(q.config);
  const { n, min, max, rows: given } = scaleRows(q.config, result, locale);
  const rows = sortRows(given, look.sort, byAverage);
  const lo = askText(locale, c.lo_en, c.lo_ar), hi = askText(locale, c.hi_en, c.hi_ar);
  if (n < 1) return <Total n={n} t={t} />;
  return (
    <>
      <Total n={n} t={t} show={look.total && !screen} />
      <ul className="ask-tracks" aria-hidden="true" data-many={rows.length > 4 ? "" : undefined} style={cssVars({ "--ask-rows": rows.length, "--ask-half": Math.ceil(rows.length / 2) })}>
        {rows.map((r) => (
          <li key={r.id} className="ask-track-row">
            <span className="ask-track-label" dir="auto">{r.label}</span>
            <b className="ask-track-avg">{r.avg === null || look.values === "none" ? "" : askNum(r.avg, locale)}</b>
            <span className="ask-track">
              {r.avg !== null && <><span className="ask-track-fill" style={{ inlineSize: `${r.at * 100}%` }} /><span className="ask-track-dot" style={{ insetInlineStart: `${r.at * 100}%` }} /></>}
            </span>
            <Ends min={min} max={max} lo={lo} hi={hi} />
            <span className="ask-dist" data-wide={r.dist.length > 7 ? "" : undefined}>
              {r.dist.map((count, i) => (
                <span key={i} className="ask-dist-col" title={`${min + i}: ${count}`}>
                  <span className="ask-dist-bar" style={cssVars({ "--ask-h": r.most ? count / r.most : 0 })} data-none={count ? undefined : ""} />
                  <span className="ask-dist-mark">{min + i}</span>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <Spoken rows={rows} min={min} t={t} locale={locale} />
    </>
  );
}

/** The averages as one shape: an axis a statement, the lowest mark in the middle and the highest at the rim, a ring
 *  a mark between. Each axis carries a number; the key names it with its average. Fewer than three statements make no
 *  shape: they are drawn as tracks. */
export function ScaleRadar(p: ResultProps) {
  const { q, result, locale, t, look, screen, colors } = p;
  const c = scalesConfig(q.config);
  const { n, min, max, rows } = scaleRows(q.config, result, locale);
  const marks = useTween(rows.map((r) => r.avg ?? min));
  if (rows.length < 3) return <ScaleTracks {...p} />;
  if (n < 1) return <Total n={n} t={t} />;
  const lo = askText(locale, c.lo_en, c.lo_ar), hi = askText(locale, c.hi_en, c.hi_ar);
  const C = 110, R = 80;
  const { points, ends } = radar(marks, min, max, R, C, C);
  const rings = Array.from({ length: max - min }, (_, i) => radar(rows.map(() => min + i + 1), min, max, R, C, C).points);
  const out = radar(rows.map(() => max), min, max, R + 17, C, C).points;
  const poly = (pts: [number, number][]) => pts.map(([x, y]) => `${Math.round(x * 100) / 100},${Math.round(y * 100) / 100}`).join(" ");
  return (
    <>
      <Total n={n} t={t} show={look.total && !screen} />
      <div className="ask-ring-wrap">
        <div className="ask-radar" aria-hidden="true">
          <svg viewBox="0 0 220 220" focusable="false">
            {rings.map((pts, i) => <polygon key={i} className="ask-radar-ring" points={poly(pts)} />)}
            {ends.map(([x, y], i) => <line key={i} className="ask-radar-ring" x1={C} y1={C} x2={x} y2={y} />)}
            <polygon className="ask-radar-shape" points={poly(points)} />
            {points.map(([x, y], i) => <circle key={i} className="ask-radar-dot" cx={x} cy={y} r={4} />)}
            {out.map(([x, y], i) => <text key={i} className="ask-radar-no" x={x} y={y}>{i + 1}</text>)}
          </svg>
        </div>
        <div className="ask-radar-key">
          <Legend numbered plain colors={colors} rows={rows.map((r, i) => ({ id: r.id, label: r.label, index: i, value: r.avg === null || look.values === "none" ? null : <span className="ask-val"><b>{askNum(r.avg, locale)}</b></span> }))} />
          <Ends min={min} max={max} lo={lo} hi={hi} />
        </div>
      </div>
      <Spoken rows={rows} min={min} t={t} locale={locale} />
    </>
  );
}

/** Each statement's answers as one whole bar, cut by mark: the lowest mark the lightest step of the palette's hue
 *  and the highest the strongest, a line of the card between two steps. A step wide enough says its share inside. */
export function ScaleStacked({ q, result, locale, t, look, screen, colors }: ResultProps) {
  const c = scalesConfig(q.config);
  const { n, min, max, rows: given } = scaleRows(q.config, result, locale);
  const rows = sortRows(given, look.sort, byAverage);
  if (n < 1) return <Total n={n} t={t} />;
  const lo = askText(locale, c.lo_en, c.lo_ar), hi = askText(locale, c.hi_en, c.hi_ar);
  const steps = ramp(colors.mark, colors.surface, max - min + 1);
  return (
    <>
      <Total n={n} t={t} show={look.total && !screen} />
      <div className="ask-scale-key" aria-hidden="true">
        {lo && <span dir="auto">{lo}</span>}
        <span className="ask-scale-steps">{steps.map((fill, i) => <span key={i} className="ask-sw" style={{ background: fill, color: onColor(fill) }}>{min + i}</span>)}</span>
        {hi && <span dir="auto">{hi}</span>}
      </div>
      <ul className="ask-stacks" aria-hidden="true" data-many={rows.length > 5 ? "" : undefined} style={cssVars({ "--ask-rows": rows.length, "--ask-half": Math.ceil(rows.length / 2) })}>
        {rows.map((r) => {
          const all = r.dist.reduce((a, b) => a + b, 0);
          return (
            <li key={r.id} className="ask-stack-row">
              <span className="ask-track-label" dir="auto">{r.label}</span>
              <b className="ask-track-avg">{r.avg === null || look.values === "none" ? "" : askNum(r.avg, locale)}</b>
              <span className="ask-stack">
                {r.dist.map((count, i) => {
                  const share = all ? count / all : 0;
                  const said = look.values === "none" ? "" : look.values === "count" ? String(count) : `${Math.round(share * 100)}%`;
                  return (
                    <span key={i} className="ask-seg" title={`${min + i}: ${count}`} data-none={count ? undefined : ""} style={{ flexGrow: Math.round(share * 1000), background: steps[i], color: onColor(steps[i]) }}>
                      {share >= 0.1 && said && <span className="mm-lat">{said}</span>}
                    </span>
                  );
                })}
              </span>
            </li>
          );
        })}
      </ul>
      <Spoken rows={rows} min={min} t={t} locale={locale} />
    </>
  );
}

/** Statements by marks, as a table: a row a statement, a column a mark, each cell saying how many gave that mark and
 *  shaded in five steps of the palette's hue by how many that is beside the fullest cell. The table is the chart and
 *  its own alternative. */
export function ScaleHeat({ q, result, locale, t, look, screen, colors }: ResultProps) {
  const c = scalesConfig(q.config);
  const { n, min, max, rows: given } = scaleRows(q.config, result, locale);
  const rows = sortRows(given, look.sort, byAverage);
  if (n < 1) return <Total n={n} t={t} />;
  const lo = askText(locale, c.lo_en, c.lo_ar), hi = askText(locale, c.hi_en, c.hi_ar);
  const steps = ramp(colors.mark, colors.surface, 5);
  const most = Math.max(...rows.map((r) => r.most), 0);
  const marks = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <>
      <Total n={n} t={t} show={look.total && !screen} />
      <div className="ask-heat-box">
        <table className="ask-heat" data-wide={marks.length > 7 ? "" : undefined} style={cssVars({ "--ask-rows": rows.length })}>
          <thead>
            <tr><td />{marks.map((m) => <th key={m} scope="col" className="mm-lat">{m}</th>)}{look.values !== "none" && <td className="ask-heat-end" />}</tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const all = r.dist.reduce((a, b) => a + b, 0);
              return (
                <tr key={r.id}>
                  <th scope="row"><span dir="auto">{r.label}</span>{r.avg !== null && look.values !== "none" && <span className="ask-heat-avg">{t.average(askNum(r.avg, locale))}</span>}</th>
                  {r.dist.map((count, i) => {
                    const fill = count && most ? steps[Math.min(4, Math.max(0, Math.ceil((count / most) * 5) - 1))] : null;
                    const said = look.values === "percent" ? `${Math.round((all ? count / all : 0) * 100)}%` : String(count);
                    return (
                      <td key={i} className="mm-lat" style={fill ? { background: fill, color: onColor(fill) } : undefined} data-none={count ? undefined : ""}>
                        {look.values === "none" ? <span className="mm-sr">{said}</span> : said}
                      </td>
                    );
                  })}
                  {look.values !== "none" && <td className="ask-heat-end">{r.avg !== null && t.average(askNum(r.avg, locale))}</td>}
                </tr>
              );
            })}
          </tbody>
          {(lo || hi) && (
            <tfoot>
              <tr><td /><td colSpan={marks.length}><Ends min={min} max={max} lo={lo} hi={hi} /></td>{look.values !== "none" && <td className="ask-heat-end" />}</tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}
