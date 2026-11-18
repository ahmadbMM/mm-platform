"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { itemsResult, type AskItem } from "@/lib/ask";
import type { QuestionLook } from "@/lib/ask-look";
import type { AskWords } from "../Ask.text";
import { IconCheck, IconNext, IconVote } from "../icons";
import { Total } from "./Total";
import { useFresh } from "./parts";
import { cssVars, type ResultProps, type VoteProps } from "./types";

// Written answers as their own words - never who wrote them. Open answers: cards, a wall of notes, one at a time
// (spotlight), or one column with the newest first (stream). Q&A: a list (unanswered first, the most upvoted first
// among them), or the same with the top question large. Each is a list a screen reader reads as it is; the spotlight,
// which shows one answer, has the whole list beside it for one. An answer that arrives while the page is open is
// marked for a moment. The look's `limit` shows only the first so many; without one, every answer the database sends.

const shown = (items: AskItem[], look: QuestionLook) => (look.limit ? items.slice(0, look.limit) : items);
/** How long an answer the spotlight shows: its type is smaller the longer it is (ask.css), and past 500 characters
 *  (an answer may run to 2,000) the big screen shows its first lines. */
const lenOf = (t: string) => { const n = [...t].length; return n > 500 ? "x" : n > 200 ? "l" : n > 80 ? "m" : undefined; };
const names = (items: AskItem[]) => items.map((x) => String(x.id));

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

function useItems({ q, result, look }: Pick<ResultProps, "q" | "result" | "look">) {
  const { n, items: all } = useMemo(() => itemsResult(q.kind, result), [q.kind, result]);
  const items = useMemo(() => shown(all, look), [all, look]);
  return { n, items, fresh: useFresh(names(items)) };
}

/** Open answers: a card each. */
export function AnswerCards(p: ResultProps) {
  const { t, votes, look, screen } = p;
  const { n, items, fresh } = useItems(p);
  return (
    <>
      <Total n={n} t={t} show={look.total && !screen} />
      {items.length > 0 && (
        <ul className="ask-cards" style={cssVars({ "--ask-rows": items.length })}>
          {items.map((x) => <li key={x.id} className="ask-card" data-new={fresh.has(String(x.id)) ? "" : undefined}><p dir="auto">{x.t}</p><Votes item={x} votes={votes} t={t} /></li>)}
        </ul>
      )}
    </>
  );
}

/** Open answers as a wall of notes: columns of notes of their own heights, each in a soft tint of one of the palette's
 *  colours, a few a little askew. */
export function AnswerWall(p: ResultProps) {
  const { t, votes, look, screen } = p;
  const { n, items, fresh } = useItems(p);
  return (
    <>
      <Total n={n} t={t} show={look.total && !screen} />
      {items.length > 0 && (
        <ul className="ask-wall">
          {items.map((x) => (
            <li key={x.id} className={`ask-note ask-tint${x.id % 6}${x.id % 3 === 1 ? " tilt-a" : x.id % 3 === 2 ? " tilt-b" : ""}`} data-new={fresh.has(String(x.id)) ? "" : undefined}>
              <p dir="auto">{x.t}</p><Votes item={x} votes={votes} t={t} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Open answers in one column, the newest at the top. */
export function AnswerStream(p: ResultProps) {
  const { t, votes, look, screen } = p;
  const { n, items, fresh } = useItems(p);
  const newest = useMemo(() => [...items].sort((a, b) => b.id - a.id), [items]);
  return (
    <>
      <Total n={n} t={t} show={look.total && !screen} />
      {newest.length > 0 && (
        <ul className="ask-stream">
          {newest.map((x) => <li key={x.id} className="ask-stream-row" data-new={fresh.has(String(x.id)) ? "" : undefined}><p dir="auto">{x.t}</p><Votes item={x} votes={votes} t={t} /></li>)}
        </ul>
      )}
    </>
  );
}

/** Open answers one at a time, large. On a page the reader steps through them; on the big screen they take turns by
 *  themselves, and an answer that has just arrived comes on at once. */
export function AnswerSpotlight(p: ResultProps) {
  const { t, votes, look, screen } = p;
  const { n, items } = useItems(p);
  // The answer shown, held by its id, and the place it stood: an upvote reorders the list (the most upvoted first), and
  // the reader stays on the answer they were reading (bug hunt 2026-11-18: held by its place, another answer slid under
  // them); the place counts only once that answer is gone.
  const [at, setAt] = useState<{ id: number | null; index: number }>(() => ({ id: items[0]?.id ?? null, index: 0 }));
  const count = items.length;
  const held = at.id === null ? -1 : items.findIndex((x) => x.id === at.id);
  const i = count ? (held >= 0 ? held : Math.min(at.index, count - 1)) : 0;
  const go = (k: number) => { if (count) { const j = ((k % count) + count) % count; setAt({ id: items[j].id, index: j }); } };
  const turn = useRef(() => {});
  useEffect(() => { turn.current = () => go(i + 1); });
  useEffect(() => {
    if (!screen || count < 2) return;
    const id = setInterval(() => turn.current(), 7000);
    return () => clearInterval(id);
  }, [screen, count]);
  const ids = items.map((x) => x.id).join(",");
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    const now = ids === "" ? [] : ids.split(",");
    if (!seen.current) { seen.current = new Set(now); return; }
    const known = seen.current;
    const first = now.findIndex((id) => !known.has(id));
    now.forEach((id) => known.add(id));
    if (first < 0 || !screen) return;
    const id = requestAnimationFrame(() => setAt({ id: Number(now[first]), index: first }));
    return () => cancelAnimationFrame(id);
  }, [ids, screen]);
  const x = items[i];
  return (
    <>
      <Total n={n} t={t} show={look.total && !screen} />
      {x && (
        <>
          <figure className="ask-spot">
            <blockquote key={x.id} className="ask-spot-text" dir="auto" data-len={lenOf(x.t)}>{x.t}</blockquote>
            <figcaption className="ask-spot-foot">
              <Votes item={x} votes={votes} t={t} />
              {count > 1 && (screen ? <span className="ask-spot-at mm-lat" aria-hidden="true">{i + 1} / {count}</span> : (
                <span className="ask-pager">
                  <button type="button" className="ask-icon-btn ask-prev" aria-label={t.back} onClick={() => go(i - 1)}><IconNext size={20} /></button>
                  <span className="ask-spot-at mm-lat">{i + 1} / {count}</span>
                  <button type="button" className="ask-icon-btn" aria-label={t.forward} onClick={() => go(i + 1)}><IconNext size={20} /></button>
                </span>
              ))}
            </figcaption>
          </figure>
          <ul className="mm-sr">{items.map((y) => <li key={y.id} dir="auto">{y.t}</li>)}</ul>
        </>
      )}
    </>
  );
}

function QaRows({ items, fresh, votes, t, spot = false }: { items: AskItem[]; fresh: ReadonlySet<string>; votes: VoteProps | null; t: AskWords; spot?: boolean }) {
  return (
    <ul className={`ask-qa${spot ? " spot" : ""}`} style={cssVars({ "--ask-rows": items.length })}>
      {items.map((x) => (
        <li key={x.id} className={`ask-qa-row${x.a ? " done" : ""}`} data-new={fresh.has(String(x.id)) ? "" : undefined}>
          <p dir="auto">{x.t}</p>
          {x.a && <span className="ask-chip ask-chip-done"><IconCheck size={13} />{t.answered}</span>}
          <Votes item={x} votes={votes} t={t} />
        </li>
      ))}
    </ul>
  );
}

/** Q&A: the questions people asked, one a row, with the mark staff give one they answered. */
export function QuestionList(p: ResultProps) {
  const { t, votes, look, screen } = p;
  const { n, items, fresh } = useItems(p);
  return (
    <>
      <Total n={n} t={t} show={look.total && !screen} />
      {items.length > 0 && <QaRows items={items} fresh={fresh} votes={votes} t={t} />}
    </>
  );
}

/** Q&A with the top question large: the one to answer next (not answered yet, the most upvoted), then the rest. */
export function QuestionSpotlight(p: ResultProps) {
  const { t, votes, look, screen } = p;
  const { n, items, fresh } = useItems(p);
  return (
    <>
      <Total n={n} t={t} show={look.total && !screen} />
      {items.length > 0 && <QaRows spot items={items} fresh={fresh} votes={votes} t={t} />}
    </>
  );
}
