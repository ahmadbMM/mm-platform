import { mkNum } from "@/lib/market/core";

// A price in the Marketplace, written as the site writes every amount (components/booking/Sar.tsx): the riyal sign
// (U+20C1, drawn by the one-glyph "MM Riyal" font, market.css .mk-amt) left of the number in every language, isolated
// left to right so an Arabic line cannot flip it, the sign for the eye alone and a word a screen reader says out of
// sight (`word`: the page's "SAR" / "ريال", Market.text.ts `sar`). Where it differs from Sar: a price here is always
// whole riyals and may run to six figures, so its thousands are grouped ("12,500"), which Sar does not do.
// lib/market/core.ts mkAmtText(n) is the same amount as plain text, for a sentence.
export default function MkAmt({ n, word, className = "" }: { n: number; word: string; className?: string }) {
  return (
    <bdi className={`mk-amt${className ? ` ${className}` : ""}`} dir="ltr"><span aria-hidden="true">{"⃁"}</span><span className="mm-sr">{word}</span> {mkNum(n)}</bdi>
  );
}
