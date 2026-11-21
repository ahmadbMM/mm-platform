import type { ReactNode } from "react";
import { w4Inline, type W4Block, type W4Rules } from "@/lib/market/w4-rules";

// The Marketplace's rules as the page draws them (W4), from the blocks of lib/market/w4-rules.ts: numbered sections,
// each an address on the page (#safety), with paragraphs, lists, small headings and the grouped list of what may not
// be sold. Plain text throughout, never markup: a sentence's [words](address) parts become links only for the kinds
// of address w4Inline allows (this site's pages, a place on this page, an email, a WhatsApp chat). Staff's own words
// (the way to pay the commission) are shown exactly as written, in their own direction.

function line(text: string): ReactNode {
  return w4Inline(text).map((b, i) => {
    if (!b.href) return b.text;
    // this site's addresses carry no language (lib/links.ts localHref), so a page's link is its plain address
    if (b.href.startsWith("/") || b.href.startsWith("#")) return <a key={i} href={b.href}>{b.text}</a>;
    if (b.href.startsWith("mailto:")) return <a key={i} href={b.href}><bdi dir="ltr">{b.text}</bdi></a>;
    return <a key={i} href={b.href} target="_blank" rel="noopener noreferrer">{b.text}</a>;
  });
}

function Block({ b }: { b: W4Block }) {
  if ("p" in b) return <p>{line(b.p)}</p>;
  if ("plain" in b) return <p className="mk-w4-how mk-user" dir="auto">{b.plain}</p>;
  if ("h" in b) return <h3>{b.h}</h3>;
  if ("ul" in b) return <ul>{b.ul.map((x, i) => <li key={i}>{line(x)}</li>)}</ul>;
  return (
    <div className="mk-w4-groups">
      {b.groups.map((g, i) => (
        <div className="mk-w4-group" key={i}>
          <h3>{g.title}</h3>
          <ul>{g.items.map((x, j) => <li key={j}>{x}</li>)}</ul>
        </div>
      ))}
    </div>
  );
}

/** The contents: one link per section, in order. */
export function RulesContents({ rules }: { rules: W4Rules }) {
  return <ol>{rules.sections.map((s) => <li key={s.id}><a href={`#${s.id}`}>{s.title}</a></li>)}</ol>;
}

export default function RulesBody({ rules }: { rules: W4Rules }) {
  return (
    <>
      <p className="mk-w4-lead">{rules.intro}</p>
      {rules.sections.map((s, i) => (
        <section key={s.id} id={s.id} className={`mk-w4-rule mk-w4-rule-${s.id}`} aria-labelledby={`${s.id}-h`}>
          <h2 id={`${s.id}-h`}><span className="mk-w4-n" aria-hidden="true">{i + 1}</span>{s.title}</h2>
          {s.blocks.map((b, k) => <Block key={k} b={b} />)}
        </section>
      ))}
    </>
  );
}
