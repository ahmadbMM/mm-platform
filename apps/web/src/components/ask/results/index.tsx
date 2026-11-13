"use client";

import type { ComponentType } from "react";
import { askPalette, askViz, paletteVars, type AskQuestion, type Look } from "@/lib/ask";
import type { AskWords } from "../Ask.text";
import { ChoiceBars, PointBars, RankBars } from "./Bars";
import { WordCloud } from "./Cloud";
import { NumberHistogram } from "./Histogram";
import { AnswerCards, QuestionList } from "./Texts";
import { ScaleTracks } from "./Tracks";
import type { ResultProps, VoteProps } from "./types";

// The charts' registry: for each kind of question, the charts its results can be drawn with, by the name staff pick
// (the question's `look.viz`, contract section A). The FIRST of a kind is its default, drawn for a question with no
// pick or with one that is not built yet. A new chart is one line here and its component - nothing else knows the
// list. A kind with no row (an info slide, a kind these pages do not draw) draws nothing.
export const RESULT_VIEWS: Record<string, Record<string, ComponentType<ResultProps>>> = {
  cloud: { cloud: WordCloud },
  open: { cards: AnswerCards },
  qa: { list: QuestionList },
  choice: { bars: ChoiceBars },
  scales: { tracks: ScaleTracks },
  ranking: { bars: RankBars },
  points: { bars: PointBars },
  number: { histogram: NumberHistogram },
};

/** A question's results in its chart, in a box that carries the chart's colours (the question's palette, else the
 *  page's, else the brand's) as --ask-c0 ... --ask-c5. */
export default function AskResults({ q, pageLook, result, locale, t, screen = false, votes = null }: {
  q: AskQuestion; pageLook: Look; result: unknown; locale: string; t: AskWords; screen?: boolean; votes?: VoteProps | null;
}) {
  const views = RESULT_VIEWS[q.kind];
  const viz = views ? askViz(q.look, Object.keys(views)) : null;
  const View = views && viz ? views[viz] : null;
  if (!View || result === undefined || result === null) return null;
  const palette = askPalette(q.look, pageLook);
  return (
    <div className="ask-res" data-kind={q.kind} data-viz={viz} data-palette={palette} style={paletteVars(palette) as React.CSSProperties}>
      <View q={q} result={result} locale={locale} t={t} screen={screen} votes={votes} />
    </div>
  );
}
