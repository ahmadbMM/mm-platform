"use client";

import { askNum, rankRows } from "@/lib/ask";
import { between } from "@/lib/ask-charts";
import { Total } from "./Total";
import { Values, useFlip, valueLine } from "./parts";
import { cssVars, type ResultProps } from "./types";

// Ranking, two more ways. Podium: the best three on steps - the first in the middle and the tallest, each step as
// high as its score beside the first's, its place written on it and its name and numbers over it - and the rest
// listed under (beside, on the big screen). Ladder: every option in order, each with the place people gave it on average, marked on a line from
// the first place to the last. One hue throughout.

export function RankPodium({ q, result, locale, t, look, screen }: ResultProps) {
  const { n, rows } = rankRows(q.config, result, locale);
  const all = rows.reduce((a, r) => a + r.score, 0);
  const part = (score: number) => (all ? score / all : 0);
  const top = rows.slice(0, 3), rest = rows.slice(3);
  // on the steps: second, first, third
  const order = top.length === 3 ? [1, 0, 2] : top.map((_, i) => i);
  return (
    <>
      <Total n={n} t={t} show={look.total && !screen} />
      {n > 0 && (
        <>
          <div className="ask-podium-box" aria-hidden="true">
            <div className="ask-podium" style={cssVars({ "--ask-n": top.length })}>
              {order.map((k) => {
                const r = top[k];
                return (
                  <div key={r.id} className="ask-step">
                    <span className="ask-step-name" dir="auto" title={r.label}>{r.label}</span>
                    <Values look={look} count={r.score} share={part(r.score)} locale={locale} />
                    <span className="ask-step-block" style={cssVars({ "--ask-h": 0.28 + 0.72 * r.share })}><span className="mm-lat">{k + 1}</span></span>
                  </div>
                );
              })}
            </div>
            {rest.length > 0 && (
              <ul className="ask-rest-list" style={cssVars({ "--ask-rows": rest.length })}>
                {rest.map((r, i) => <li key={r.id}><span className="ask-bar-no">{i + 4}</span><span className="ask-rank-word"><span dir="auto">{r.label}</span></span><Values look={look} count={r.score} share={part(r.score)} locale={locale} /></li>)}
              </ul>
            )}
          </div>
          <ol className="mm-sr">{rows.map((r) => <li key={r.id}><span dir="auto">{r.label}</span>: {valueLine({ ...look, values: "both" }, r.score, part(r.score), locale)}</li>)}</ol>
        </>
      )}
    </>
  );
}

export function RankLadder({ q, result, locale, t, look, screen }: ResultProps) {
  const { n, rows } = rankRows(q.config, result, locale);
  const ref = useFlip<HTMLOListElement>(rows.map((r) => r.id).join("\n"));
  const last = rows.length;
  return (
    <>
      <Total n={n} t={t} show={look.total && !screen} />
      {n > 0 && (
        <>
          <ol ref={ref} className="ask-ladder" data-many={rows.length > 6 ? "" : undefined} style={cssVars({ "--ask-rows": rows.length, "--ask-half": Math.ceil(rows.length / 2) })}>
            {rows.map((r, i) => (
              <li key={r.id} data-flip={r.id} className="ask-rung">
                <span className="ask-bar-label"><span className="ask-bar-no" aria-hidden="true">{i + 1}</span><span dir="auto">{r.label}</span></span>
                {r.place !== null && look.values !== "none" && <span className="ask-val"><b>{t.average(askNum(r.place, locale))}</b></span>}
                <span className="ask-rung-track" aria-hidden="true">
                  {r.place !== null && <span className="ask-track-dot" style={{ insetInlineStart: `${between(r.place, 1, last) * 100}%` }} />}
                </span>
              </li>
            ))}
          </ol>
          <p className="ask-track-ends ask-ladder-ends" aria-hidden="true"><span className="mm-lat">1</span><span className="mm-lat">{last}</span></p>
        </>
      )}
    </>
  );
}
