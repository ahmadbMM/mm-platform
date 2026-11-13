"use client";

import { choiceRows } from "@/lib/ask";
import { dotCounts } from "@/lib/ask-charts";
import { seriesColor } from "@/lib/ask-look";
import { Right } from "./Bars";
import { Total } from "./Total";
import { Legend, Values, sortRows } from "./parts";
import type { ResultProps } from "./types";

// Multiple choice as a hundred dots, ten by ten: each dot is one part in a hundred of everything picked, in its
// option's colour, the options one after another from the first dot. The key beside it names each colour with its
// figures (and is the list a screen reader reads). A dot changes colour gently as the shares move.
export function ChoiceDots({ q, result, locale, t, look, screen, colors }: ResultProps) {
  const { n, rows: given } = choiceRows(q.config, result, locale);
  const rows = sortRows(given.map((r, index) => ({ ...r, index })), look.sort, (r) => r.n);
  const picked = rows.reduce((a, r) => a + r.n, 0);
  const dots = dotCounts(rows.map((r) => r.n));
  const cells: number[] = [];
  rows.forEach((r, i) => { for (let k = 0; k < dots[i]; k++) cells.push(r.index); });
  return (
    <>
      <Total n={n} t={t} show={look.total && !screen} />
      {n > 0 && (
        <div className="ask-dots-wrap">
          <div className="ask-dots" aria-hidden="true">
            {Array.from({ length: 100 }, (_, i) => <span key={i} className="ask-dot" style={cells[i] === undefined ? undefined : { background: seriesColor(colors, cells[i]).fill }} />)}
          </div>
          <Legend dots colors={colors} rows={rows.map((r) => ({
            id: r.id, label: r.label, index: r.index, mark: r.correct ? <Right t={t} /> : undefined,
            value: <Values look={look} count={r.n} share={picked ? r.n / picked : 0} locale={locale} />,
          }))} />
        </div>
      )}
    </>
  );
}
