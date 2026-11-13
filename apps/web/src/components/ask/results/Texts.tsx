import { itemsResult, type AskItem } from "@/lib/ask";
import type { AskWords } from "../Ask.text";
import { IconCheck, IconVote } from "../icons";
import { Total } from "./Total";
import { cssVars, type ResultProps, type VoteProps } from "./types";

// Written answers as their own words: open answers as cards, Q&A as a list (unanswered first, the most upvoted first
// among them). Nothing but the text and its votes - never who wrote it.

/** An answer's votes: a button for a signed-in viewer on someone else's answer, the bare count otherwise. */
function Votes({ item, votes, t }: { item: AskItem; votes: VoteProps | null; t: AskWords }) {
  if (!votes) return null;
  if (!votes.can || votes.mine.has(item.id)) {
    return <span className="ask-votes"><IconVote size={14} /><span aria-hidden="true">{item.v}</span><span className="mm-sr">{t.votes(item.v)}</span></span>;
  }
  const on = votes.voted.has(item.id);
  return (
    <button type="button" className={`ask-vote${on ? " on" : ""}`} aria-pressed={on} aria-label={t.upvote(item.v)} disabled={votes.busy === item.id} onClick={() => votes.onVote(item.id, !on)}>
      <IconVote size={14} /><span aria-hidden="true">{item.v}</span>
    </button>
  );
}

/** Open answers: a card each. */
export function AnswerCards({ q, result, t, votes }: ResultProps) {
  const { n, items } = itemsResult(q.kind, result);
  return (
    <>
      <Total n={n} t={t} />
      {items.length > 0 && (
        <ul className="ask-cards" style={cssVars({ "--ask-rows": items.length })}>
          {items.map((x) => <li key={x.id} className="ask-card"><p dir="auto">{x.t}</p><Votes item={x} votes={votes} t={t} /></li>)}
        </ul>
      )}
    </>
  );
}

/** Q&A: the questions people asked, one a row, with the mark staff give one they answered. */
export function QuestionList({ q, result, t, votes }: ResultProps) {
  const { n, items } = itemsResult(q.kind, result);
  return (
    <>
      <Total n={n} t={t} />
      {items.length > 0 && (
        <ul className="ask-qa" style={cssVars({ "--ask-rows": items.length })}>
          {items.map((x) => (
            <li key={x.id} className={`ask-qa-row${x.a ? " done" : ""}`}>
              <p dir="auto">{x.t}</p>
              {x.a && <span className="ask-chip ask-chip-done"><IconCheck size={13} />{t.answered}</span>}
              <Votes item={x} votes={votes} t={t} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
