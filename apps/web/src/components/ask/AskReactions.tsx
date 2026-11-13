"use client";

import type { AskFull } from "@/lib/ask";
import { pageOpen } from "@/lib/ask";
import { reactionsOf, type AskReaction } from "@/lib/ask-pace";
import type { AskWords } from "./Ask.text";
import { IconClap, IconLike, IconLove, IconThink, IconWow } from "./icons";

// The five reactions to a question (contract H4: only on a page whose look turns them on). Each is a toggle of the
// viewer's own - one of each a person - with how many gave it beside it; a visitor who is signed out is taken to the
// sign-in, as by every other control that answers. The marks are drawn (icons.tsx), each named for a screen reader.
// A page that takes no more answers shows the counts and takes none.
const MARK: Record<AskReaction, (p: { size?: number }) => React.ReactNode> = { like: IconLike, love: IconLove, clap: IconClap, wow: IconWow, think: IconThink };

export function AskReactions({ full, question, t, onReact, onSignIn }: {
  full: AskFull; question: number; t: AskWords; onReact: (question: number, kind: AskReaction, on: boolean) => void; onSignIn: () => void;
}) {
  const rows = reactionsOf(full, question);
  const open = pageOpen(full) && !full.preview;
  // a closed page with no reactions has nothing to show here
  if (!open && rows.every((r) => !r.n)) return null;
  return (
    <div className="ask-reacts">
      {rows.map((r) => {
        const Mark = MARK[r.kind];
        return (
          <button key={r.kind} type="button" className={`ask-react${r.mine ? " on" : ""}`} aria-pressed={r.mine} aria-label={r.n ? `${t.react[r.kind]} (${r.n})` : t.react[r.kind]}
            disabled={!open || (full.signed && !full.canAnswer)} onClick={() => (full.signed ? onReact(question, r.kind, !r.mine) : onSignIn())}>
            <Mark size={20} />
            {r.n > 0 && <span className="mm-lat" aria-hidden="true">{r.n}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** The reaction counts of the question on the big screen: only those somebody gave, and nothing to press. */
export function ScreenReactions({ full, question, t }: { full: AskFull; question: number; t: AskWords }) {
  const rows = reactionsOf(full, question).filter((r) => r.n > 0);
  if (!rows.length) return null;
  return (
    <ul className="ask-scr-reacts">
      {rows.map((r) => {
        const Mark = MARK[r.kind];
        return <li key={r.kind}><Mark size={28} /><span className="mm-sr">{t.react[r.kind]}</span><b className="mm-lat">{r.n}</b></li>;
      })}
    </ul>
  );
}
