"use client";

import { useMemo, useState } from "react";
import {
  answerState, askErrorKey, askText, isQuiz, isWritten, resultsShown, writtenConfig,
  type AskFull, type AskQuestion as Question, type SendAnswer, type Shaped,
} from "@/lib/ask";
import { pinResult, pinTarget, rightWords } from "@/lib/ask-kinds";
import { askImage } from "@/lib/ask-look";
import type { AskReaction } from "@/lib/ask-pace";
import type { AskWords } from "./Ask.text";
import { AskClock, useClock } from "./AskClock";
import { AnswerForm } from "./AskInputs";
import { AskReactions } from "./AskReactions";
import { IconCheck, IconClose } from "./icons";
import AskResults from "./results";
import type { VoteProps } from "./results/types";

// One question of a page, as a card: what it asks, where it is answered (the form of its kind; one "Sign in to
// answer" button for a visitor who is signed out), the viewer's own written answers with where each stands, and its
// results once this viewer may see them (lib/ask.ts resultsShown). Nothing here names anyone. `thanks`: the line
// staff wrote for after an answer, shown here while this is the question the reader answered last.
//
// Stage 2: a quiz question staff have put on screen carries its clock (`offsetMs`: how far this device's clock
// stands from the database's; no clock is drawn until that is known), and at 0 its form locks. Once staff reveal a
// question the right answer is said - on the form where there is one, else in a line - and a quiz answer says whether
// it was right, with its points. `reactions`: the page's look turned the five reaction buttons on.
export type QuestionActions = {
  send: (question: number, value: Record<string, unknown>) => Promise<SendAnswer>;
  unsend: (question: number, answer: number) => Promise<boolean>;
  vote: (question: number, answer: number, on: boolean) => Promise<boolean>;
  react: (question: number, kind: AskReaction, on: boolean) => void;
  signIn: () => void;
};

/** The right answer of a revealed question, in a line - where neither the form nor the chart on the card says it. */
function RightAnswer({ q, locale, t, result, onForm, onChart }: { q: Question; locale: string; t: AskWords; result: unknown; onForm: boolean; onChart: boolean }) {
  // a typed quiz's chart and a number's say it themselves; a choice's and a quiz's options say it, on the form or the chart
  const said = onChart || ((q.kind === "choice" || q.kind === "quiz") && onForm) ? "" : rightWords(q, locale, result);
  return said ? <p className="ask-reveal"><span className="ask-right" aria-hidden="true"><IconCheck size={14} /></span><span>{t.correct}</span> <b dir="auto">{said}</b></p> : null;
}

export default function AskQuestionCard({ q, full, locale, t, act, thanks = "", offsetMs = null, reactions = false }: {
  q: Question; full: AskFull; locale: string; t: AskWords; act: QuestionActions; thanks?: string;
  /** What to add to this device's clock to have the database's (null: not known yet). */
  offsetMs?: number | null;
  reactions?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [voting, setVoting] = useState<number | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);
  const answer = answerState(q, full);
  const mine = useMemo(() => full.mine[String(q.id)] ?? [], [full.mine, q.id]);
  const labelId = `ask-q-${q.id}`;
  const title = askText(locale, q.title_en, q.title_ar), help = askText(locale, q.help_en, q.help_ar);
  // a page of one question is often made with the page's own words as the question's (staff's quick start): the page's
  // heading has said them, so the card keeps them for a screen reader only
  const same = title.trim() === askText(locale, full.page.title_en, full.page.title_ar).trim();
  const written = isWritten(q.kind);
  const result = full.live?.results[String(q.id)];
  const takesVotes = (q.kind === "open" || q.kind === "qa") && writtenConfig(q.kind, q.config).votes;
  // a quiz question's clock runs while it takes answers; when it has run out nothing more can be sent
  const clock = useClock(q, offsetMs);
  const ticking = clock !== null && q.open && !q.reveal && isQuiz(q.kind) && full.page.open;
  const late = ticking && clock.over;

  async function submit(shaped: Shaped): Promise<boolean> {
    if (!shaped.ok) { setErr(t.errors[shaped.error] || t.errors.generic); return false; }
    setBusy(true);
    setErr("");
    const a = await act.send(q.id, shaped.value);
    setBusy(false);
    if (!a.ok) setErr(t.errors[askErrorKey(a.error)] || t.errors.generic);
    return a.ok;
  }
  async function takeBack(answerId: number) {
    if (removing !== null) return;
    setRemoving(answerId);
    setErr("");
    if (!(await act.unsend(q.id, answerId))) setErr(t.tryLater);
    setRemoving(null);
  }
  const mineIds = useMemo(() => new Set(mine.map((m) => m.id)), [mine]);
  const votedIds = useMemo(() => new Set(full.voted), [full.voted]);
  const votes: VoteProps | null = !takesVotes ? null : {
    mine: mineIds, voted: votedIds, can: full.signed && !full.preview, busy: voting,
    onVote: async (answerId, on) => {
      if (voting !== null) return;
      setVoting(answerId);
      setErr("");
      if (!(await act.vote(q.id, answerId, on))) setErr(t.tryLater);
      setVoting(null);
    },
  };
  const sent = written ? null : mine[0] ?? null;
  // the page is open but this question takes no more answers: said with one small mark
  const shut = !q.open && full.page.open && q.kind !== "info" && !full.preview;
  const shown = resultsShown(q, full);
  const state = answer;
  // A pin already dropped is drawn on the results' own picture, where there is one: the picture stands once.
  const formed = (state === "open" || state === "change" || state === "done" || state === "shut") && !(q.kind === "pin" && (state === "done" || state === "shut") && shown);
  const target = q.kind === "pin" && q.reveal ? pinTarget(q.config.correct) ?? pinResult(result).correct : null;
  // a pin question's picture is the pin's own ground (or the results'); it stands alone only when neither is there
  const image = q.kind === "pin" && (formed || shown) ? null : askImage(q.image, 960);

  return (
    <section className="ask-q" aria-labelledby={labelId} data-kind={q.kind}>
      {same && !shut ? <h2 id={labelId} className="mm-sr">{title}</h2> : (
        <header className="ask-q-head">
          <h2 id={labelId} dir="auto" className={same ? "mm-sr" : undefined}>{title}</h2>
          {shut && <span className="ask-chip">{t.closed}</span>}
        </header>
      )}
      {help && <p className="ask-q-help" dir="auto">{help}</p>}
      {image && <img className="ask-q-img" src={image} alt="" loading="lazy" decoding="async" />}
      {ticking && <AskClock clock={clock} t={t} />}
      {state === "signin" && <button type="button" className="ask-btn ask-btn-line" onClick={act.signIn}>{t.signinToAnswer}</button>}
      {formed && (
        // a form drawn again from the answer on file whenever that answer changes (sent from another phone, replaced)
        <AnswerForm key={sent ? `${sent.id}:${sent.created_at}:${JSON.stringify(sent.value)}` : "new"} q={q} locale={locale} t={t} busy={busy} labelId={labelId} state={state} sent={sent} onSubmit={submit}
          late={late} target={target} />
      )}
      {err && <p className="ask-err" role="alert">{err}</p>}
      {thanks && !err && <p className="ask-thanks" role="status" dir="auto">{thanks}</p>}
      <RightAnswer q={q} locale={locale} t={t} result={result} onForm={formed} onChart={shown} />
      {written && mine.length > 0 && (
        <ul className="ask-mine">
          {mine.map((m) => (
            <li key={m.id} className="ask-mine-row" data-status={m.status}>
              <span id={`ask-a-${m.id}`} className="ask-mine-text" dir="auto">{m.body}</span>
              {m.status !== "approved" && (
                <span className="ask-mine-state">
                  <span className={`ask-chip ${m.status === "pending" ? "ask-chip-wait" : "ask-chip-no"}`}>{m.status === "pending" ? t.waiting : t.rejected}</span>
                  {m.status === "pending" && full.signed && !full.preview && (
                    <button type="button" className="ask-x" aria-label={t.remove} aria-describedby={`ask-a-${m.id}`} disabled={removing === m.id} onClick={() => takeBack(m.id)}><IconClose size={14} /></button>
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {shown && <AskResults q={q} pageLook={full.page.look} result={result} locale={locale} t={t} votes={votes} own={sent} />}
      {reactions && <AskReactions full={full} question={q.id} t={t} onReact={act.react} onSignIn={act.signIn} />}
    </section>
  );
}
