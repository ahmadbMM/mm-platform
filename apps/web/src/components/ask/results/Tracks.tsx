import { askNum, askText, scaleRows, scalesConfig } from "@/lib/ask";
import { Total } from "./Total";
import { cssVars, type ResultProps } from "./types";

// Scales: each statement's average on a track from the lowest mark to the highest (the filled part and a dot where it
// falls; the track a lighter step of the same hue), the number beside it, and under it how many gave each mark as a
// row of small columns. The hidden list says the same in words.
export function ScaleTracks({ q, result, locale, t }: ResultProps) {
  const c = scalesConfig(q.config);
  const { n, min, max, rows } = scaleRows(q.config, result, locale);
  const lo = askText(locale, c.lo_en, c.lo_ar), hi = askText(locale, c.hi_en, c.hi_ar);
  if (n < 1) return <Total n={n} t={t} />;
  return (
    <>
      <Total n={n} t={t} />
      <ul className="ask-tracks" aria-hidden="true" style={cssVars({ "--ask-rows": rows.length })}>
        {rows.map((r) => (
          <li key={r.id} className="ask-track-row">
            <span className="ask-track-label" dir="auto">{r.label}</span>
            <b className="ask-track-avg">{r.avg === null ? "" : askNum(r.avg, locale)}</b>
            <span className="ask-track">
              {r.avg !== null && <><span className="ask-track-fill" style={{ inlineSize: `${r.at * 100}%` }} /><span className="ask-track-dot" style={{ insetInlineStart: `${r.at * 100}%` }} /></>}
            </span>
            <span className="ask-track-ends"><span><span className="mm-lat">{min}</span>{lo && <span dir="auto"> {lo}</span>}</span><span>{hi && <span dir="auto">{hi} </span>}<span className="mm-lat">{max}</span></span></span>
            <span className="ask-dist">
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
      <ul className="mm-sr">
        {rows.map((r) => (
          <li key={r.id}><span dir="auto">{r.label}</span>: {r.avg === null ? "" : `${t.average(askNum(r.avg, locale))}; `}{r.dist.map((count, i) => `${min + i}: ${count}`).join(", ")}</li>
        ))}
      </ul>
    </>
  );
}
