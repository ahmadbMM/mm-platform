import { isDrawn, isQuiz, type AskFull, type AskQuestion } from "./ask";
import { quizConfig, quizTextConfig } from "./ask-kinds";

// What moves on an Ask page in stage 2 (contract H5 and H6): a page staff pace shows one question at a time; a quiz
// question shown by staff has a clock, counted against the DATABASE's time (never the device's); the viewer's own
// score and place, said only for what staff have revealed; and the reactions. Pure, like lib/ask.ts.

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ------------------------------------------------------------------ the server's time */

/** How far the database's clock stands from this device's: `ms` is what to add to Date.now() to have the database's
 *  time. `rtt`: how long the call that told it took (the answer is the truer the shorter that was); `at`: when. */
export type Offset = { ms: number; rtt: number; at: number };
/** One reading of the database's clock: its `now`, taken as the moment half way between asking and hearing. */
export function offsetOf(sentAt: number, gotAt: number, serverNow: string | null | undefined): Offset | null {
  const t = serverNow ? Date.parse(serverNow) : NaN;
  if (Number.isNaN(t) || !(gotAt >= sentAt)) return null;
  return { ms: Math.round(t - (sentAt + gotAt) / 2), rtt: gotAt - sentAt, at: gotAt };
}
/** Which of two readings to keep: the one whose call was quicker - unless the one held is over a minute old, when
 *  the newer takes its place (a device's clock drifts, and may be set). */
export function betterOffset(held: Offset | null, next: Offset | null): Offset | null {
  if (!next) return held;
  if (!held) return next;
  return next.rtt <= held.rtt || next.at - held.at > 60_000 ? next : held;
}

/* ------------------------------------------------------------------ a quiz question's clock */

/** How long the database still takes an answer after the clock's end (ask_send: "late" past it). The page does not
 *  count on it: its inputs lock at 0. */
export const QUIZ_GRACE_MS = 1500;
/** The seconds a quiz question's clock runs, or null for a question with no clock: any other kind, and a quiz staff
 *  have not put on screen (`started_at` empty - a page at its own pace: no clock, and a right answer is 1000). */
export function quizSeconds(q: Pick<AskQuestion, "kind" | "config" | "started_at">): number | null {
  if (!isQuiz(q.kind) || !q.started_at || Number.isNaN(Date.parse(q.started_at))) return null;
  return q.kind === "quiz" ? quizConfig(q.config).seconds : quizTextConfig(q.config).seconds;
}
export type Clock = {
  /** The seconds the clock runs in all, and those left (whole seconds, rounded up: 0 only once it is over). */
  total: number; left: number;
  /** What is left as a share of the whole, 1 to 0, for the bar. */
  share: number;
  over: boolean;
};
/** A quiz question's clock at a moment of the DATABASE's time (ms since the epoch), or null when it has none. */
export function clockOf(q: Pick<AskQuestion, "kind" | "config" | "started_at">, serverNowMs: number): Clock | null {
  const total = quizSeconds(q);
  if (total === null) return null;
  const leftMs = Date.parse(q.started_at as string) + total * 1000 - serverNowMs;
  return { total, left: clamp(Math.ceil(leftMs / 1000), 0, total), share: clamp(leftMs / (total * 1000), 0, 1), over: leftMs <= 0 };
}

/* ------------------------------------------------------------------ a page staff pace */

/** Whether staff show one question at a time (by the last poll, else as the page was read). */
export const isLivePaced = (full: AskFull): boolean => (full.live?.pace ?? full.page.pace) === "live";
/** The question on screen on a page staff pace: `current_q`, when the page holds it and draws its kind. Null before
 *  staff show the first (and after a new round): the page waits. */
export function liveQuestion(full: AskFull): AskQuestion | null {
  const id = full.live ? full.live.current_q : full.page.current_q;
  return id === null ? null : full.questions.find((q) => q.id === id && isDrawn(q.kind)) ?? null;
}

/* ------------------------------------------------------------------ the viewer's own score */

/** The viewer's own quiz line: their points, and their place among how many. Only what staff have revealed is said:
 *  `score` adds the viewer's points on revealed questions, and the place (the database counts it over every answer)
 *  is given only when nothing of theirs is still unrevealed - so the line never tells whether an answer was right
 *  before staff do. Null with nothing to say: signed out, no quiz question, or no revealed answer of theirs. */
export type MeLine = { score: number; rank: number | null; players: number | null };
export function meLine(full: AskFull): MeLine | null {
  if (!full.signed) return null;
  let shown = 0, hidden = 0, any = false;
  for (const q of full.questions) {
    if (!isQuiz(q.kind)) continue;
    for (const m of full.mine[String(q.id)] ?? []) {
      if (q.reveal) { shown += m.score ?? 0; any = true; } else hidden++;
    }
  }
  if (!any) return null;
  const whole = !hidden && full.me !== null && full.me.score === shown;
  return { score: shown, rank: whole ? full.me!.rank : null, players: whole ? full.me!.players : null };
}
/** Whether one of the viewer's quiz answers was right, once staff reveal the question: its points are above 0. Null
 *  before the reveal, and for an answer with no score. */
export const ownRight = (q: Pick<AskQuestion, "kind" | "reveal">, score: number | null | undefined): boolean | null =>
  !isQuiz(q.kind) || !q.reveal || score === null || score === undefined ? null : score > 0;

/* ------------------------------------------------------------------ reactions */

/** The five reactions, in the order they are drawn (the database's own names). */
export const ASK_REACTIONS = ["like", "love", "clap", "wow", "think"] as const;
export type AskReaction = (typeof ASK_REACTIONS)[number];
export const isReaction = (v: unknown): v is AskReaction => (ASK_REACTIONS as readonly unknown[]).includes(v);

/** A question's reactions as the page draws them: each of the five with how many gave it and whether the viewer did. */
export function reactionsOf(full: AskFull, question: number): { kind: AskReaction; n: number; mine: boolean }[] {
  const counts = full.live?.reactions[String(question)] ?? {};
  const mine = full.reacted[String(question)] ?? [];
  return ASK_REACTIONS.map((kind) => ({ kind, n: Math.max(0, counts[kind] ?? 0), mine: mine.includes(kind) }));
}
/** The viewer's reaction given or taken back, on the page at once (the next poll brings the database's counts). */
export function withReaction(full: AskFull, question: number, kind: AskReaction, on: boolean): AskFull {
  const id = String(question);
  const had = (full.reacted[id] ?? []).includes(kind);
  if (had === on) return full;
  const reacted = { ...full.reacted, [id]: on ? [...(full.reacted[id] ?? []), kind] : (full.reacted[id] ?? []).filter((k) => k !== kind) };
  if (!full.live) return { ...full, reacted };
  const counts = { ...(full.live.reactions[id] ?? {}) };
  counts[kind] = Math.max(0, (counts[kind] ?? 0) + (on ? 1 : -1));
  return { ...full, reacted, live: { ...full.live, reactions: { ...full.live.reactions, [id]: counts } } };
}
