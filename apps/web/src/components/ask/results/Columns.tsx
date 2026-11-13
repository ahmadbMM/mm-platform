"use client";

import { choiceRows, type BarRow } from "@/lib/ask";
import { Total } from "./Total";
import { Right } from "./Bars";
import { Legend, Values, sortRows } from "./parts";
import { cssVars, type ResultProps } from "./types";

// Multiple choice as columns: one hue, thin columns standing on one line with rounded tops, each with its numbers
// over it. Names are written under their columns where the card is wide enough for them; where it is not, each column
// carries a number and the key under the plot names it, with the same numbers again. The key is always there for a
// screen reader: it is the list of the chart.
export function ChoiceColumns({ q, result, locale, t, look, screen, colors }: ResultProps) {
  const { n, rows } = choiceRows(q.config, result, locale);
  return (
    <>
      <Total n={n} t={t} show={look.total && !screen} />
      {n > 0 && <ColumnChart rows={sortRows(rows, look.sort, (r) => r.n)} look={look} locale={locale} t={t} screen={screen} colors={colors} />}
    </>
  );
}

/** The columns themselves, for rows already in the order they are drawn (a quiz's stay as staff wrote them). */
export function ColumnChart({ rows: given, look, locale, t, screen, colors }: Pick<ResultProps, "look" | "locale" | "t" | "screen" | "colors"> & { rows: BarRow[] }) {
  // `index`: a column's place in the plot, which is also the number it and its row of the key carry
  const rows = given.map((r, index) => ({ ...r, index }));
  const top = Math.max(...rows.map((r) => r.n), 0);
  // Names stand under their own columns from the width at which each has room - its longest word on one line and
  // the whole of it on three - and numbers do under that, with the key to name them. A few short names always fit.
  const chars = (text: string) => [...text].length;
  const room = Math.max(...rows.map((r) => Math.max(...r.label.split(/\s+/).map(chars), chars(r.label) / 3)), 1) * 8 + 14;
  const need = rows.length * room;
  // (the big screen's type and width grow together: there the names fit or they do not, whatever its size)
  const direct = rows.length * Math.max(...rows.map((r) => chars(r.label)), 0) <= 40 ? 0 : screen ? (need <= 780 ? 0 : null) : [440, 620, 900, 1300].find((w) => w >= need) ?? null;
  return (
    <>
      <div className="ask-cols" aria-hidden="true" data-direct={direct ?? undefined} style={cssVars({ "--ask-n": rows.length })}>
        <div className="ask-cols-plot">
          {rows.map((r) => (
            <span key={r.id} className="ask-col">
              <Values look={look} count={r.n} share={r.share} locale={locale} />
              <span className="ask-col-bar" style={cssVars({ "--ask-h": top ? r.n / top : 0 })} data-none={r.n ? undefined : ""} />
            </span>
          ))}
        </div>
        <div className="ask-cols-foot">
          {rows.map((r) => <span key={r.id} className="ask-col-name"><span className="ask-sw plain">{r.index + 1}</span><span className="ask-col-text" dir="auto">{r.label}</span>{r.correct && <Right t={t} />}</span>)}
        </div>
      </div>
      <Legend numbered plain colors={colors} rows={rows.map((r) => ({ id: r.id, label: r.label, index: r.index, value: <Values look={look} count={r.n} share={r.share} locale={locale} />, mark: r.correct ? <Right t={t} /> : undefined }))} />
    </>
  );
}
