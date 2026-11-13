import { askNum, askText, numberConfig, numberResult } from "@/lib/ask";
import { IconCheck } from "../icons";
import { Total } from "./Total";
import { cssVars, type ResultProps } from "./types";

// A number: the average as the figure, and the answers as a histogram - thin columns with rounded caps standing on
// one line, each with its count over it, and a mark under the line where the average falls. The hidden list gives every bin.
export function NumberHistogram({ q, result, locale, t }: ResultProps) {
  const r = numberResult(result);
  const c = numberConfig(q.config);
  const unit = askText(locale, c.unit_en, c.unit_ar);
  if (r.n < 1) return <Total n={r.n} t={t} />;
  const from = r.bins.length ? r.bins[0].lo : null, to = r.bins.length ? r.bins[r.bins.length - 1].hi : null;
  const at = (v: number | null) => (v === null || from === null || to === null || !(to > from) ? null : Math.min(1, Math.max(0, (v - from) / (to - from))));
  const withUnit = (v: number) => `${askNum(v, locale)}${unit ? ` ${unit}` : ""}`;
  const avgAt = at(r.avg), rightAt = at(r.correct);
  return (
    <>
      <Total n={r.n} t={t} />
      <p className="ask-figure">
        {r.avg !== null && <span dir="auto">{t.average(withUnit(r.avg))}</span>}
        {r.correct !== null && <span className="ask-figure-right"><IconCheck size={15} /><span>{t.correct}</span> <b dir="auto">{withUnit(r.correct)}</b></span>}
      </p>
      {r.bins.length > 0 && (
        <div className="ask-hist" aria-hidden="true">
          <div className="ask-hist-plot">
            {r.bins.map((b, i) => (
              <span key={i} className="ask-hist-col">
                <span className="ask-hist-n">{b.n > 0 ? b.n : ""}</span>
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
      <ul className="mm-sr">
        {r.bins.map((b, i) => <li key={i}>{askNum(b.lo, locale, 2)} - {askNum(b.hi, locale, 2)}: {b.n}</li>)}
      </ul>
    </>
  );
}
