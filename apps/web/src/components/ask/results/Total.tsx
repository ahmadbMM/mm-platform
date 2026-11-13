import type { AskWords } from "../Ask.text";

/** How many answered, above a chart - or, with none yet, that in the chart's place. A question whose look turns the
 *  total off, and the big screen (which says it along the bottom), keep only the "none yet". */
export function Total({ n, t, show = true }: { n: number; t: AskWords; show?: boolean }) {
  if (n < 1) return <p className="ask-none">{t.noAnswers}</p>;
  if (!show) return null;
  return <p className="ask-total">{n === 1 ? t.oneAnswer : t.answers(n)}</p>;
}
