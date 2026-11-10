// An amount as riders read it in the booking app (_sar): the riyal sign (U+20C1, drawn by /fonts/Riyal-*.woff2,
// booking.css .tk-amt) left of the number in every language, isolated left to right so an Arabic line cannot flip it;
// two decimals when the amount has a fraction (57.50), none when it is whole (75).
// Screen readers are not known to say the new sign (the research's row 18, 2026-11-10), so on screen it is drawn for
// the eye alone (aria-hidden) and a word they read follows it, out of sight: "SAR", "ريال" (`word`, the page's).

/** The number as the booking app writes it: "57.50", "75" (no grouping, Latin digits). */
export const riyalNum = (n: number) => {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};

/** The amount as text, where a sentence takes it ("Use my balance (⃁ 57.50)"). */
export const sarText = (n: number) => `⁦⃁ ${riyalNum(n)}⁩`;

/** The amount on screen: the sign for the eye, the word for a screen reader. */
export function Sar({ n, word, className = "tk-amt" }: { n: number; word: string; className?: string }) {
  return (
    <bdi className={className} dir="ltr"><span aria-hidden="true">{"⃁"}</span><span className="mm-sr">{word}</span> {riyalNum(n)}</bdi>
  );
}
