import { Fragment } from "react";
import { latinRuns, type CmText } from "@/lib/store-pdp";
import type { W3aText } from "./w3a.text";

// The product page's small shared pieces (store build 2026-11-15, chain w3a).

/** A product text on a right-to-left page with each Latin run (a model name, a brand) isolated in <bdi>, so "DA54 MAX"
 *  keeps its order inside Arabic (O11-B); on a left-to-right page the text as it is. */
export function Bidi({ text, rtl }: { text: string; rtl: boolean }) {
  if (!rtl || !/[A-Za-z]/.test(text)) return <>{text}</>;
  // a text with no Arabic letter at all (an English tagline shown on an Arabic page) is one run, its full stop included
  if (!/[\u0600-\u06ff\u0750-\u077f\ufb50-\ufdff\ufe70-\ufeff]/.test(text)) return <bdi>{text}</bdi>;
  return <>{latinRuns(text).map((r, i) => (r.latin ? <bdi key={i}>{r.text}</bdi> : <Fragment key={i}>{r.text}</Fragment>))}</>;
}

/** A rider height (or a chest, a waist) in the page's words: "165-174 cm", "190+ cm", "Up to 160 cm". */
export function cmWords(t: W3aText, c: CmText | null): string {
  if (!c) return "";
  return c.kind === "range" ? t.cmRange(c.min, c.max) : c.kind === "from" ? t.cmFrom(c.min) : t.cmUpTo(c.max);
}
