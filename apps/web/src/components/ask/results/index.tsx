"use client";

import { useMemo, type ComponentType } from "react";
import type { AskQuestion, Look } from "@/lib/ask";
import { askColors, askPalette, askTheme, askViz, paletteVars, questionLook, surfaceOf } from "@/lib/ask-look";
import type { AskWords } from "../Ask.text";
import { ChoiceBars, CloudBars, CloudList, PointBars, RankBars } from "./Bars";
import { CloudBubbles } from "./Bubbles";
import { WordCloud } from "./Cloud";
import { ChoiceColumns } from "./Columns";
import { ChoiceDots } from "./Dots";
import { NumberGauge, NumberHistogram, NumberStrip } from "./Histogram";
import { RankLadder, RankPodium } from "./Podium";
import { ChoiceDonut, ChoicePie, PointDonut } from "./Ring";
import { AnswerCards, AnswerSpotlight, AnswerStream, AnswerWall, QuestionList, QuestionSpotlight } from "./Texts";
import { ChoiceTiles, CloudTiles, PointTiles } from "./Tiles";
import { ScaleHeat, ScaleRadar, ScaleStacked, ScaleTracks } from "./Tracks";
import type { ResultProps, VoteProps } from "./types";

// The charts' registry: for each kind of question, the charts its results can be drawn with, by the name staff pick
// (the question's `look.viz`, contract section A; lib/ask-look.ts ASK_VIZ lists the same names, and a test holds the
// two together). The FIRST of a kind is its default, drawn for a question with no pick or with one this site does not
// know. A new chart is one line here and its component - nothing else knows the list. A kind with no row (an info
// slide, a kind these pages do not draw) draws nothing.
export const RESULT_VIEWS: Record<string, Record<string, ComponentType<ResultProps>>> = {
  cloud: { cloud: WordCloud, bubbles: CloudBubbles, bars: CloudBars, tiles: CloudTiles, list: CloudList },
  open: { cards: AnswerCards, wall: AnswerWall, spotlight: AnswerSpotlight, stream: AnswerStream },
  qa: { list: QuestionList, spotlight: QuestionSpotlight },
  choice: { bars: ChoiceBars, columns: ChoiceColumns, donut: ChoiceDonut, pie: ChoicePie, dots: ChoiceDots, tiles: ChoiceTiles },
  scales: { tracks: ScaleTracks, radar: ScaleRadar, stacked: ScaleStacked, heat: ScaleHeat },
  ranking: { bars: RankBars, podium: RankPodium, ladder: RankLadder },
  points: { bars: PointBars, donut: PointDonut, tiles: PointTiles },
  number: { histogram: NumberHistogram, gauge: NumberGauge, strip: NumberStrip },
};

/** A question's results in its chart, in a box that carries the chart's colours (the question's palette, else the
 *  page's, else the brand's) as they are on this page's theme: --ask-mark, --ask-c0 ... --ask-c5 and their kin
 *  (lib/ask-look.ts paletteVars). The chart is handed the same colours and the question's look, read once here. */
export default function AskResults({ q, pageLook, result, locale, t, screen = false, votes = null }: {
  q: AskQuestion; pageLook: Look; result: unknown; locale: string; t: AskWords; screen?: boolean; votes?: VoteProps | null;
}) {
  const views = RESULT_VIEWS[q.kind];
  const viz = views ? askViz(q.look, Object.keys(views)) : null;
  const View = views && viz ? views[viz] : null;
  const palette = askPalette(q.look, pageLook), surface = surfaceOf(askTheme(pageLook));
  // read once for as long as the look stays the same thing: the charts lay themselves out again only when it changes
  const look = useMemo(() => questionLook(q.look), [q.look]);
  const colors = useMemo(() => askColors(palette, surface), [palette, surface]);
  const vars = useMemo(() => paletteVars(palette, surface) as React.CSSProperties, [palette, surface]);
  if (!View || !viz || result === undefined || result === null) return null;
  return (
    <div className="ask-res" data-kind={q.kind} data-viz={viz} data-palette={palette} data-size={look.size} style={vars}>
      <View q={q} result={result} locale={locale} t={t} screen={screen} votes={votes} look={look} viz={viz} colors={colors} />
    </div>
  );
}
