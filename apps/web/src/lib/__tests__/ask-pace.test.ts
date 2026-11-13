import { describe, expect, it } from "vitest";
import { askView, type AskFull } from "../ask";
import { ASK_REACTIONS, QUIZ_GRACE_MS, betterOffset, clockOf, isLivePaced, isReaction, liveQuestion, meLine, offsetOf, ownRight, quizSeconds, reactionsOf, withReaction } from "../ask-pace";

// What moves on an Ask page in stage 2 (lib/ask-pace.ts): the database's time, a quiz question's clock against it, a
// page staff pace, the viewer's own score, and the reactions.
const T0 = Date.parse("2026-11-13T10:00:00+03:00");
const iso = (ms: number) => new Date(ms).toISOString();
const quiz = (over: Record<string, unknown> = {}) => ({
  id: 21, pos: 1, kind: "quiz", title_en: "Which city?", title_ar: "", help_en: "", help_ar: "", image: null, config: { options: [{ id: "a", en: "Jeddah" }, { id: "b", en: "Riyadh" }], seconds: 20 },
  moderated: false, results: "live", open: true, reveal: false, started_at: iso(T0), look: {}, ...over,
});
const fullOf = (over: Record<string, unknown> = {}): AskFull => {
  const v = askView({
    state: "ok", signed: true, can_answer: true, now: iso(T0), rk: "rk1",
    page: { id: 1, slug: "quiz-night", title_en: "Quiz night", title_ar: "", intro_en: "", intro_ar: "", pace: "live", current_q: 21, opens_at: null, closes_at: null, round: 1, open: true, look: {} },
    questions: [quiz()], mine: {}, voted: [], reacted: {}, me: null,
    live: { ok: true, ver: 3, now: iso(T0), state: "ok", open: true, pace: "live", current_q: 21, round: 1, q: { "21": { open: true, reveal: false, started_at: iso(T0) } }, results: {}, reactions: {}, stats: null },
    ...over,
  });
  if (!v.full) throw new Error("no page");
  return v.full;
};
const own = (id: number, score: number | null) => ({ id, value: { o: ["a"] }, body: null, status: "approved", answered: false, score, votes: 0, created_at: iso(T0) });

describe("the database's time", () => {
  it("is read off a call: its `now`, taken as the moment half way between asking and hearing", () => {
    // this device runs 5 seconds behind: asked at 1000, heard at 1200, the database said 6100 in between
    expect(offsetOf(1000, 1200, iso(6100))).toEqual({ ms: 5000, rtt: 200, at: 1200 });
    // ... or ahead
    expect(offsetOf(10_000, 10_100, iso(7050))).toEqual({ ms: -3000, rtt: 100, at: 10_100 });
    expect(offsetOf(1000, 1200, null)).toBeNull();
    expect(offsetOf(1000, 1200, "soon")).toBeNull();
    expect(offsetOf(1200, 1000, iso(6100))).toBeNull();
  });
  it("keeps the reading whose call was quicker, until that one is over a minute old", () => {
    const quick = { ms: 5000, rtt: 80, at: 1000 }, slow = { ms: 5140, rtt: 600, at: 3000 };
    expect(betterOffset(null, slow)).toBe(slow);
    expect(betterOffset(quick, null)).toBe(quick);
    expect(betterOffset(quick, slow)).toBe(quick);
    expect(betterOffset(slow, { ...quick, at: 4000 })).toEqual({ ...quick, at: 4000 });
    expect(betterOffset(quick, { ...slow, at: 62_000 })).toEqual({ ...slow, at: 62_000 });
  });
});

describe("a quiz question's clock", () => {
  it("runs only for a quiz staff have put on screen: the question's own seconds, 20 or 30 when it says none", () => {
    expect(quizSeconds(quiz())).toBe(20);
    expect(quizSeconds(quiz({ config: { seconds: 45 } }))).toBe(45);
    expect(quizSeconds(quiz({ kind: "quiz_text", config: {} }))).toBe(30);
    expect(quizSeconds(quiz({ started_at: null }))).toBeNull(); // a page at its own pace: no clock
    expect(quizSeconds(quiz({ started_at: "not a time" }))).toBeNull();
    expect(quizSeconds(quiz({ kind: "choice" }))).toBeNull();
  });
  it("counts down to started_at + seconds against the DATABASE's time, whatever the device's clock says", () => {
    const q = quiz();
    expect(clockOf(q, T0)).toEqual({ total: 20, left: 20, share: 1, over: false });
    expect(clockOf(q, T0 + 5_000)).toEqual({ total: 20, left: 15, share: 0.75, over: false });
    expect(clockOf(q, T0 + 19_100)).toMatchObject({ left: 1, over: false }); // the last second shows as 1, not 0
    expect(clockOf(q, T0 + 20_000)).toEqual({ total: 20, left: 0, share: 0, over: true });
    expect(clockOf(q, T0 + 90_000)).toEqual({ total: 20, left: 0, share: 0, over: true });
    expect(clockOf(q, T0 - 3_000)).toEqual({ total: 20, left: 20, share: 1, over: false }); // read a moment before it began
    expect(clockOf(quiz({ started_at: null }), T0)).toBeNull();
    // a device 5 seconds behind the database, corrected by its offset, sees what the database sees
    const device = T0 + 12_000 - 5000, offset = offsetOf(device - 100, device + 100, iso(T0 + 12_000));
    expect(offset?.ms).toBe(5000);
    expect(clockOf(q, device + (offset?.ms ?? 0))).toMatchObject({ left: 8, over: false });
    expect(clockOf(q, device)).toMatchObject({ left: 13 }); // ... where its own clock alone would show five seconds too many
    expect(QUIZ_GRACE_MS).toBe(1500);
  });
});

describe("a page staff pace", () => {
  it("is told by the last poll, else by how the page was read", () => {
    expect(isLivePaced(fullOf())).toBe(true);
    expect(isLivePaced(fullOf({ live: null }))).toBe(true);
    const self = fullOf();
    expect(isLivePaced({ ...self, live: { ...self.live!, pace: "self" } })).toBe(false);
  });
  it("shows the question staff put on screen, and waits before the first", () => {
    expect(liveQuestion(fullOf())?.id).toBe(21);
    const f = fullOf();
    expect(liveQuestion({ ...f, live: { ...f.live!, current_q: null } })).toBeNull();          // nothing shown yet, or a new round
    expect(liveQuestion({ ...f, live: { ...f.live!, current_q: 99 } })).toBeNull();            // shown, but the page does not hold it yet (it reads itself again)
    expect(liveQuestion(fullOf({ questions: [quiz({ kind: "something-new" })] }))).toBeNull(); // a kind these pages do not know
  });
});

describe("the viewer's own score", () => {
  const two = [quiz({ id: 21, reveal: true }), quiz({ id: 22, pos: 2, kind: "quiz_text", reveal: true })];
  it("says nothing with nothing revealed: signed out, no quiz answer, or an answer staff have not revealed", () => {
    expect(meLine(fullOf())).toBeNull();
    expect(meLine(fullOf({ mine: { "21": [own(1, 900)] }, me: { score: 900, rank: 1, players: 5 } }))).toBeNull(); // answered, not revealed
    expect(meLine(fullOf({ signed: false, questions: two, mine: { "21": [own(1, 900)] } }))).toBeNull();
    expect(meLine(fullOf({ questions: two }))).toBeNull();
  });
  it("adds the viewer's points on revealed questions, with their place when every answer of theirs is revealed", () => {
    const all = fullOf({ questions: two, mine: { "21": [own(1, 900)], "22": [own(2, 0)] }, me: { score: 900, rank: 3, players: 40 } });
    expect(meLine(all)).toEqual({ score: 900, rank: 3, players: 40 });
  });
  it("gives the points without a place while an answer of theirs is still unrevealed - the place would tell on it", () => {
    const part = fullOf({ questions: [two[0], quiz({ id: 22, pos: 2, reveal: false })], mine: { "21": [own(1, 900)], "22": [own(2, 760)] }, me: { score: 1660, rank: 1, players: 40 } });
    expect(meLine(part)).toEqual({ score: 900, rank: null, players: null });
    // ... and while the page's own count is older than the reveal (it is read again on a reveal)
    const stale = fullOf({ questions: two, mine: { "21": [own(1, 900)], "22": [own(2, 500)] }, me: { score: 900, rank: 2, players: 40 } });
    expect(meLine(stale)).toEqual({ score: 1400, rank: null, players: null });
    expect(meLine(fullOf({ questions: two, mine: { "21": [own(1, 900)] }, me: null }))).toEqual({ score: 900, rank: null, players: null });
  });
  it("tells an answer right from wrong only once staff reveal the question", () => {
    expect(ownRight(quiz(), 900)).toBeNull();
    expect(ownRight(quiz({ reveal: true }), 900)).toBe(true);
    expect(ownRight(quiz({ reveal: true }), 0)).toBe(false);
    expect(ownRight(quiz({ reveal: true }), null)).toBeNull();
    expect(ownRight(quiz({ kind: "choice", reveal: true }), 1)).toBeNull();
  });
});

describe("reactions", () => {
  it("are the database's five, in the order they are drawn", () => {
    expect(ASK_REACTIONS).toEqual(["like", "love", "clap", "wow", "think"]);
    expect(isReaction("clap")).toBe(true);
    for (const v of ["laugh", "", null, 3]) expect(isReaction(v)).toBe(false);
  });
  it("show each of the five with how many gave it and whether the viewer did", () => {
    const f = fullOf({ reacted: { "21": ["love", "wave"], "9": ["like"] }, live: { ok: true, ver: 3, now: iso(T0), state: "ok", open: true, pace: "live", current_q: 21, round: 1, q: {}, results: {}, reactions: { "21": { like: 4, love: 1, boo: 9, clap: "2", wow: -1 } }, stats: null } });
    expect(reactionsOf(f, 21)).toEqual([{ kind: "like", n: 4, mine: false }, { kind: "love", n: 1, mine: true }, { kind: "clap", n: 2, mine: false }, { kind: "wow", n: 0, mine: false }, { kind: "think", n: 0, mine: false }]);
    expect(reactionsOf(f, 77).every((r) => r.n === 0 && !r.mine)).toBe(true);
  });
  it("give and take the viewer's own back on the page at once, and change nothing when it is already so", () => {
    const f = fullOf({ live: { ok: true, ver: 3, now: iso(T0), state: "ok", open: true, pace: "live", current_q: 21, round: 1, q: {}, results: {}, reactions: { "21": { like: 4 } }, stats: null } });
    const on = withReaction(f, 21, "like", true);
    expect(reactionsOf(on, 21)[0]).toEqual({ kind: "like", n: 5, mine: true });
    expect(withReaction(on, 21, "like", true)).toBe(on);
    const off = withReaction(on, 21, "like", false);
    expect(reactionsOf(off, 21)[0]).toEqual({ kind: "like", n: 4, mine: false });
    expect(withReaction(f, 21, "wow", false)).toBe(f);
    expect(reactionsOf(withReaction(f, 22, "think", true), 22)[4]).toEqual({ kind: "think", n: 1, mine: true });
    expect(f.live?.reactions["21"]).toEqual({ like: 4 }); // the page held before is not written over
  });
});
