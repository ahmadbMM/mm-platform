"use client";

import type { ReactNode } from "react";
import { choiceRows, pointRows } from "@/lib/ask";
import { onCircle, sector, shares } from "@/lib/ask-charts";
import { seriesColor, type AskColors } from "@/lib/ask-look";
import { Right } from "./Bars";
import { Total } from "./Total";
import { Legend, Values, sortRows, useTween } from "./parts";
import type { ResultProps } from "./types";

// A ring (donut) or a full circle (pie): the whole is everything picked, each part an option's share of it, starting
// at the top and going clockwise. Each part has its own colour of the palette, a line of the card between it and the
// next, and a number - the same number its row of the key carries, beside its name and its figures, so no part is told
// by colour alone. The parts ease to their new sizes as answers come in.
type Part = { id: string; label: string; index: number; value: number; text: ReactNode; mark?: ReactNode };

function Ring({ parts, pie, colors, mid }: { parts: Part[]; pie: boolean; colors: AskColors; mid: string | null }) {
  const lens = useTween(shares(parts.map((p) => p.value)));
  const r1 = 97, r0 = pie ? 0 : 60, at = pie ? 62 : (r0 + r1) / 2;
  const segs = parts.map((p, i) => ({ p, no: i + 1, len: lens[i] ?? 0, from: lens.slice(0, i).reduce((a, b) => a + b, 0) })).filter((s) => s.len > 0.0005);
  return (
    <div className="ask-ring-wrap">
      <div className={`ask-ring${pie ? " pie" : ""}`} aria-hidden="true">
        <svg viewBox="0 0 200 200" focusable="false">
          {segs.map((s) => <path key={s.p.id} d={sector(100, 100, r0, r1, s.from, s.len)} fill={seriesColor(colors, s.p.index).fill} />)}
          {segs.length > 1 && segs.map((s) => {
            const [x0, y0] = onCircle(100, 100, Math.max(0, r0 - 1), s.from), [x1, y1] = onCircle(100, 100, r1 + 1, s.from);
            return <line key={s.p.id} className="ask-ring-gap" x1={x0} y1={y0} x2={x1} y2={y1} />;
          })}
          {segs.map((s) => {
            if (s.len < 0.055) return null;
            const [x, y] = onCircle(100, 100, at, s.from + s.len / 2);
            return <text key={s.p.id} className="ask-ring-no" x={x} y={y} fill={seriesColor(colors, s.p.index).on}>{s.no}</text>;
          })}
        </svg>
        {!pie && mid && <span className="ask-ring-mid">{mid}</span>}
      </div>
      <Legend numbered colors={colors} rows={parts.map((p, i) => ({ id: p.id, label: p.label, index: p.index, no: i + 1, value: p.text, mark: p.mark }))} />
    </div>
  );
}

function ChoiceRing({ q, result, locale, t, look, screen, colors, pie }: ResultProps & { pie: boolean }) {
  const { n, rows } = choiceRows(q.config, result, locale);
  const picked = rows.reduce((a, r) => a + r.n, 0);
  const parts = sortRows(rows.map((r, index) => ({ ...r, index })), look.sort, (r) => r.n).map((r) => ({
    id: r.id, label: r.label, index: r.index, value: r.n, mark: r.correct ? <Right t={t} /> : undefined,
    text: <Values look={look} count={r.n} share={picked ? r.n / picked : 0} locale={locale} />,
  }));
  const said = look.total && n > 0 ? (n === 1 ? t.oneAnswer : t.answers(n)) : null;
  return (
    <>
      <Total n={n} t={t} show={look.total && !screen && pie} />
      {n > 0 && <Ring parts={parts} pie={pie} colors={colors} mid={said} />}
    </>
  );
}
/** Multiple choice as a ring, with how many answered in its middle. */
export const ChoiceDonut = (p: ResultProps) => <ChoiceRing {...p} pie={false} />;
/** Multiple choice as a full circle. */
export const ChoicePie = (p: ResultProps) => <ChoiceRing {...p} pie />;

/** Points as a ring: each option's part of all the points given, with its average. */
export function PointDonut({ q, result, locale, t, look, colors }: ResultProps) {
  const { n, rows } = pointRows(q.config, result, locale);
  const given = rows.reduce((a, r) => a + r.avg, 0);
  const parts = sortRows(rows.map((r, index) => ({ ...r, index })), look.sort, (r) => r.avg).map((r) => ({
    id: r.id, label: r.label, index: r.index, value: r.avg, text: <Values look={look} count={r.avg} share={given ? r.avg / given : 0} locale={locale} />,
  }));
  return (
    <>
      <Total n={n} t={t} show={false} />
      {n > 0 && <Ring parts={parts} pie={false} colors={colors} mid={look.total ? (n === 1 ? t.oneAnswer : t.answers(n)) : null} />}
    </>
  );
}
