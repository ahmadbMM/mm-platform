import type { AskWords } from "../Ask.text";

/** How many answered, above a chart - or, with none yet, that in the chart's place. */
export function Total({ n, t }: { n: number; t: AskWords }) {
  if (n < 1) return <p className="ask-none">{t.noAnswers}</p>;
  return <p className="ask-total">{n === 1 ? t.oneAnswer : t.answers(n)}</p>;
}
