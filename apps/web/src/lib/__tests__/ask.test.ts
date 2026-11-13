import { describe, expect, it } from "vitest";
import { T } from "../../components/ask/Ask.text";
import { RESULT_VIEWS } from "../../components/ask/results";
import {
  ASK_DRAWN, ASK_ERRORS, ASK_PALETTES, POLL_MS, REREAD_MS,
  answerState, applyLive, applySame, askBack, askErrorKey, askLang, askList, askLive, askNum, askPalette, askPct, askScreen, askSent, askSlugOk, askText, askTheme, askView, askViz, askWhen,
  charCount, choiceConfig, choiceRows, cloudResult, hasPending, isDrawn, isWritten, itemsResult, numberConfig, numberResult, optionsOf, pageOpen, paletteVars, pointRows, pointsConfig, pollDelay, rankRows,
  rereadDue, resultsShown, scaleRows, scalesConfig, screenAt, screenStep, sentMarks, sentNumber, sentOrder, sentPicks, shapeChoice, shapeNumber, shapePoints, shapeRanking, shapeScales, shapeWritten,
  withMine, withVote, withoutMine, writtenConfig, type AskFull, type AskQuestion,
} from "../ask";

// "Ask" (micromobility.sa/ask): the logic the pages stand on (lib/ask.ts). The payloads here are made up to the
// contract's shapes - the database's functions are read through these and nothing else.
const opt = (id: string, en: string, ar = "") => ({ id, en, ar });
const OPTIONS = [opt("a", "Pony rides", "ركوب المهر"), opt("b", "Kites", "طائرات ورقية"), opt("c", "Bonfire")];
const question = (over: Record<string, unknown> = {}) => ({
  id: 11, pos: 1, kind: "cloud", title_en: "Your ideas", title_ar: "أفكاركم", help_en: "", help_ar: "", image: null, config: { max_len: 40, per_person: 3 },
  moderated: true, results: "live", open: true, reveal: false, started_at: null, look: {}, ...over,
});
const page = (over: Record<string, unknown> = {}) => ({
  id: 1, slug: "farm-ideas", code: "482913", title_en: "What would you like to see at the farm?", title_ar: "ماذا تحب أن ترى في المزرعة؟", intro_en: "A private farm.", intro_ar: "",
  audience: "link", pace: "self", current_q: null, opens_at: null, closes_at: "2026-11-18T21:00:00+03:00", round: 1, open: true, look: {}, ...over,
});
const live = (over: Record<string, unknown> = {}) => ({
  ok: true, ver: 7, now: "2026-11-13T10:00:00+03:00", state: "ok", open: true, pace: "self", current_q: null, round: 1,
  q: { "11": { open: true, reveal: false, started_at: null } }, results: { "11": { n: 3, people: 2, words: [{ w: "Kites", n: 2 }, { w: "BBQ", n: 1 }] } }, reactions: {}, stats: { answers: 3, people: 2 }, ...over,
});
const payload = (over: Record<string, unknown> = {}) => ({
  state: "ok", signed: true, can_answer: true, now: "2026-11-13T10:00:00+03:00", rk: "rk1", page: page(), questions: [question()], mine: {}, voted: [], reacted: {}, me: null, live: live(), ...over,
});
const fullOf = (over: Record<string, unknown> = {}): AskFull => {
  const v = askView(payload(over));
  if (!v.full) throw new Error("no page");
  return v.full;
};
const mine = (id: number, status = "pending", value: unknown = { t: "Kites" }) => ({ id, value, body: "Kites", status, answered: false, score: null, votes: 0, created_at: "2026-11-13T10:00:00+03:00" });

describe("addresses and words", () => {
  it("knows a page's link part: lower-case letters, digits and single dashes, 3 to 40 characters", () => {
    for (const s of ["farm-ideas", "q4-2026", "abc", "a".repeat(40)]) expect(askSlugOk(s), s).toBe(true);
    for (const s of ["ab", "Farm-Ideas", "farm_ideas", "-farm", "farm-", "farm--ideas", "a".repeat(41), "farm ideas", "", null, 12]) expect(askSlugOk(s), String(s)).toBe(false);
  });
  it("shows what staff wrote: the Arabic to Arabic readers, the English to everyone else, each falling back to the other", () => {
    expect(askText("ar", "Your ideas", "أفكاركم")).toBe("أفكاركم");
    expect(askText("ar", "Your ideas", "")).toBe("Your ideas");
    expect(askText("en", "Your ideas", "أفكاركم")).toBe("Your ideas");
    expect(askText("en", "", "أفكاركم")).toBe("أفكاركم");
    // every other language reads the English: staff's words are never translated
    for (const l of ["fr", "ur", "zh"]) expect(askText(l, "Your ideas", "أفكاركم"), l).toBe("Your ideas");
    expect(askText("ur", "  ", " أفكاركم ")).toBe("أفكاركم");
    expect(askText("en", null, undefined)).toBe("");
  });
  it("sends an answer's language as one of the site's, English otherwise", () => {
    expect(askLang("ar")).toBe("ar");
    expect(askLang("bn")).toBe("bn");
    expect(askLang("xx")).toBe("en");
    expect(askLang(undefined)).toBe("en");
  });
  it("writes a time in Jeddah's time and the reader's language, with Latin digits in every language", () => {
    expect(askWhen("2026-11-18T21:00:00+03:00", "en")).toBe("Wed 18 Nov, 21:00");
    expect(askWhen("2026-11-18T18:00:00Z", "en")).toBe("Wed 18 Nov, 21:00"); // the same moment, said in UTC
    for (const l of ["ar", "ur", "hi", "ne", "bn", "zh", "ja", "ru", "fr"]) {
      const s = askWhen("2026-11-18T21:00:00+03:00", l);
      expect(s, l).toMatch(/18/);
      expect(s, l).not.toMatch(/[٠-٩۰-۹०-९০-৯]/);
    }
    expect(askWhen(null, "en")).toBe("");
    expect(askWhen("not a date", "en")).toBe("");
  });
  it("writes numbers and shares the reader's way, in Latin digits, with the one percent sign the site uses", () => {
    expect(askNum(3.44, "en")).toBe("3.4");
    expect(askNum(3, "en")).toBe("3");
    expect(askNum(25.8, "de")).toBe("25,8");
    expect(askNum(25.8, "ar")).toBe("25.8");
    expect(askPct(0.4, "en")).toBe("40%");
    expect(askPct(0.4, "ar")).toMatch(/40/);
    expect(askPct(0.4, "ar")).toContain("%");
    expect(askPct(0.4, "ar")).not.toMatch(/[٠-٩٪]/);
    expect(askPct(1.7, "en")).toBe("100%");
    expect(askPct(-1, "en")).toBe("0%");
  });
});

describe("the look", () => {
  it("reads the page's theme in one place: one of the four, the light page otherwise", () => {
    expect(askTheme({})).toBe("light");
    for (const t of ["light", "dark", "green", "sand"]) expect(askTheme({ theme: t })).toBe(t);
    expect(askTheme({ theme: "neon" })).toBe("light");
    expect(askTheme({ theme: 3 })).toBe("light");
  });
  it("takes a question's chart colours from its own palette, else the page's, else the brand's", () => {
    expect(askPalette({}, {})).toBe("brand");
    expect(askPalette({ palette: "ocean" }, { palette: "berry" })).toBe("ocean");
    expect(askPalette({}, { palette: "berry" })).toBe("berry");
    expect(askPalette({ palette: "rainbow" }, { palette: "mono" })).toBe("mono");
    expect(askPalette({ palette: "toString" }, {})).toBe("brand");
    for (const colors of Object.values(ASK_PALETTES)) {
      expect(colors).toHaveLength(6);
      for (const c of colors) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(paletteVars("brand")).toEqual({ "--ask-c0": "#077a4b", "--ask-c1": "#1a1919", "--ask-c2": "#0b6e8a", "--ask-c3": "#b4500b", "--ask-c4": "#9c1f5c", "--ask-c5": "#4a4fc4" });
  });
  it("draws a question with the chart staff picked when it is built, with the kind's first otherwise", () => {
    expect(askViz({}, ["cloud", "bubbles"])).toBe("cloud");
    expect(askViz({ viz: "bubbles" }, ["cloud", "bubbles"])).toBe("bubbles");
    expect(askViz({ viz: "treemap" }, ["cloud", "bubbles"])).toBe("cloud");
    expect(askViz({ viz: 4 }, ["bars"])).toBe("bars");
    expect(askViz({}, [])).toBeNull();
  });
  it("has a chart for every kind that shows results, and none for a kind that shows none", () => {
    for (const kind of ASK_DRAWN) {
      if (kind === "info") expect(RESULT_VIEWS[kind]).toBeUndefined();
      else expect(askViz({}, Object.keys(RESULT_VIEWS[kind] ?? {})), kind).toBeTruthy();
    }
    for (const kind of ["grid", "pin", "form", "quiz", "quiz_text"]) {
      expect(isDrawn(kind), kind).toBe(false);
      expect(RESULT_VIEWS[kind], kind).toBeUndefined();
    }
    expect(isWritten("cloud") && isWritten("open") && isWritten("qa")).toBe(true);
    expect(isWritten("choice")).toBe(false);
  });
});

describe("a question's settings", () => {
  it("keeps the options that have an id and a text, each id once", () => {
    expect(optionsOf({ options: [...OPTIONS, opt("a", "Twice"), { id: "BAD", en: "x" }, { id: "d", en: " ", ar: "" }, null, "e"] })).toEqual(OPTIONS);
    expect(optionsOf(null)).toEqual([]);
    expect(optionsOf({ options: "a" })).toEqual([]);
  });
  it("gives each kind its defaults, and holds a setting inside its limits", () => {
    expect(writtenConfig("cloud", {})).toEqual({ maxLen: 25, perPerson: 3, votes: false });
    expect(writtenConfig("open", {})).toEqual({ maxLen: 200, perPerson: 1, votes: false });
    expect(writtenConfig("qa", {})).toEqual({ maxLen: 200, perPerson: 3, votes: true });
    expect(writtenConfig("cloud", { max_len: 40, per_person: 10 })).toEqual({ maxLen: 40, perPerson: 10, votes: false });
    expect(writtenConfig("open", { max_len: 9999, per_person: 0, votes: true })).toEqual({ maxLen: 500, perPerson: 1, votes: true });
    expect(choiceConfig({ options: OPTIONS, max_picks: 9, change: true, correct: ["b", "zz"] })).toEqual({ options: OPTIONS, maxPicks: 3, change: true, correct: ["b"] });
    expect(choiceConfig({ options: OPTIONS })).toMatchObject({ maxPicks: 1, change: false, correct: [] });
    expect(scalesConfig({ options: OPTIONS })).toMatchObject({ min: 1, max: 5, skip: false, lo_en: "", hi_ar: "" });
    expect(scalesConfig({ options: OPTIONS, min: 0, max: 99 })).toMatchObject({ min: 0, max: 10 });
    expect(scalesConfig({ options: OPTIONS, min: 7, max: 1 })).toMatchObject({ min: 1, max: 3 });
    expect(pointsConfig({ options: OPTIONS })).toMatchObject({ total: 100 });
    expect(pointsConfig({ options: OPTIONS, total: 5000 })).toMatchObject({ total: 1000 });
    expect(numberConfig({})).toEqual({ min: 0, max: 100, step: 1, unit_en: "", unit_ar: "", correct: null });
    expect(numberConfig({ min: 10, max: 2, step: 0, unit_en: "km" })).toMatchObject({ min: 2, max: 10, step: 1, unit_en: "km" });
  });
});

describe("an answer's value, shaped for its kind", () => {
  it("a written answer: spaces folded; refused when empty, too long or a link", () => {
    expect(shapeWritten("cloud", { max_len: 40 }, "  Face   painting ")).toEqual({ ok: true, value: { t: "Face painting" } });
    expect(shapeWritten("cloud", {}, "   ")).toEqual({ ok: false, error: "empty" });
    expect(shapeWritten("cloud", {}, "!!!")).toEqual({ ok: false, error: "empty" }); // a cloud's entry is stored without its punctuation
    expect(shapeWritten("open", {}, "!!!")).toEqual({ ok: true, value: { t: "!!!" } });
    expect(shapeWritten("cloud", { max_len: 5 }, "Kites!")).toEqual({ ok: false, error: "long" });
    expect(shapeWritten("cloud", { max_len: 5 }, "طائرة")).toEqual({ ok: true, value: { t: "طائرة" } });
    expect(shapeWritten("qa", {}, "see https://example.com")).toEqual({ ok: false, error: "link" });
    expect(shapeWritten("qa", {}, "www.example.com")).toEqual({ ok: false, error: "link" });
    expect(shapeWritten("qa", {}, "Is 9.30 a.m. too early?")).toMatchObject({ ok: true });
    expect(shapeWritten("open", {}, null)).toEqual({ ok: false, error: "empty" });
    expect(charCount("طائرة")).toBe(5);
    expect(charCount("a\u{2000b}")).toBe(2); // a character outside the basic plane is one, not two
  });
  it("multiple choice: one to max_picks of the question's own options, in the order staff wrote them", () => {
    const one = { options: OPTIONS }, two = { options: OPTIONS, max_picks: 2 };
    expect(shapeChoice(one, ["b"])).toEqual({ ok: true, value: { o: ["b"] } });
    expect(shapeChoice(two, ["c", "a", "c"])).toEqual({ ok: true, value: { o: ["a", "c"] } });
    expect(shapeChoice(one, [])).toEqual({ ok: false, error: "empty" });
    expect(shapeChoice(one, ["a", "b"])).toEqual({ ok: false, error: "invalid" });
    expect(shapeChoice(one, ["zz"])).toEqual({ ok: false, error: "invalid" });
    expect(shapeChoice(one, "a")).toEqual({ ok: false, error: "empty" });
  });
  it("scales: a whole mark from min to max for every statement, or for some where one may be skipped", () => {
    const c = { options: OPTIONS, min: 1, max: 5 };
    expect(shapeScales(c, { a: 1, b: 5, c: 3 })).toEqual({ ok: true, value: { s: { a: 1, b: 5, c: 3 } } });
    expect(shapeScales(c, { a: 1, b: 5 })).toEqual({ ok: false, error: "empty" });
    expect(shapeScales({ ...c, skip: true }, { a: 1 })).toEqual({ ok: true, value: { s: { a: 1 } } });
    expect(shapeScales({ ...c, skip: true }, {})).toEqual({ ok: false, error: "empty" });
    expect(shapeScales(c, { a: 0, b: 5, c: 3 })).toEqual({ ok: false, error: "invalid" });
    expect(shapeScales(c, { a: 2.5, b: 5, c: 3 })).toEqual({ ok: false, error: "invalid" });
    expect(shapeScales({ ...c, min: 0 }, { a: 0, b: 5, c: 3, zz: 9 })).toEqual({ ok: true, value: { s: { a: 0, b: 5, c: 3 } } });
  });
  it("ranking: every option once, the best first", () => {
    const c = { options: OPTIONS };
    expect(shapeRanking(c, ["c", "a", "b"])).toEqual({ ok: true, value: { r: ["c", "a", "b"] } });
    for (const bad of [["a", "b"], ["a", "a", "b"], ["a", "b", "zz"], [], "abc"]) expect(shapeRanking(c, bad), String(bad)).toEqual({ ok: false, error: "invalid" });
  });
  it("points: whole numbers from 0 for every option, 1 to the total placed in all", () => {
    const c = { options: OPTIONS, total: 100 };
    expect(shapePoints(c, { a: 60, c: 40 })).toEqual({ ok: true, value: { p: { a: 60, b: 0, c: 40 } } });
    expect(shapePoints(c, { a: 1 })).toEqual({ ok: true, value: { p: { a: 1, b: 0, c: 0 } } });
    expect(shapePoints(c, {})).toEqual({ ok: false, error: "empty" });
    expect(shapePoints(c, { a: 60, b: 41 })).toEqual({ ok: false, error: "invalid" });
    expect(shapePoints(c, { a: -1, b: 5 })).toEqual({ ok: false, error: "invalid" });
    expect(shapePoints(c, { a: 1.5 })).toEqual({ ok: false, error: "invalid" });
  });
  it("a number: from min to max, on one of the question's steps, however its digits are typed", () => {
    const c = { min: 0, max: 10, step: 1 };
    expect(shapeNumber(c, "3")).toEqual({ ok: true, value: { n: 3 } });
    expect(shapeNumber(c, 10)).toEqual({ ok: true, value: { n: 10 } });
    expect(shapeNumber(c, "٣")).toEqual({ ok: true, value: { n: 3 } });
    expect(shapeNumber(c, "")).toEqual({ ok: false, error: "empty" });
    for (const bad of ["11", "-1", "2.5", "three", "1e1", "3 4"]) expect(shapeNumber(c, bad), bad).toEqual({ ok: false, error: "invalid" });
    expect(shapeNumber({ min: 0, max: 5, step: 0.5 }, "2,5")).toEqual({ ok: true, value: { n: 2.5 } });
    expect(shapeNumber({ min: 0, max: 1, step: 0.1 }, "0.3")).toEqual({ ok: true, value: { n: 0.3 } });
    expect(shapeNumber({ min: -5, max: 5, step: 5 }, "-5")).toEqual({ ok: true, value: { n: -5 } });
    expect(shapeNumber({ min: 10, max: 100, step: 10 }, "25")).toEqual({ ok: false, error: "invalid" });
  });
  it("reads an answer back for its form", () => {
    expect(sentPicks({ o: ["a", 2, "c"] })).toEqual(["a", "c"]);
    expect(sentOrder({ r: ["c", "a"] })).toEqual(["c", "a"]);
    expect(sentMarks({ s: { a: 3, b: "x" } }, "s")).toEqual({ a: 3 });
    expect(sentMarks({ p: { a: 60 } }, "p")).toEqual({ a: 60 });
    expect(sentNumber({ n: 42 })).toBe(42);
    expect(sentPicks(null)).toEqual([]);
    expect(sentNumber(undefined)).toBeNull();
  });
  it("names a refusal by the contract's code, and anything else as the general one - each with words in both languages", () => {
    for (const code of ASK_ERRORS) {
      expect(askErrorKey(code), code).toBe(code);
      expect(T.en.errors[code], code).toBeTruthy();
      expect(T.ar.errors[code], code).toBeTruthy();
    }
    expect([...ASK_ERRORS].sort()).toEqual(["answered", "audience", "closed", "empty", "invalid", "late", "limit", "link", "long", "signin", "throttled"]);
    expect(askErrorKey("busy")).toBe("throttled"); // the site's own "too many requests"
    for (const other of ["origin", "boom", "", null, undefined, 4]) expect(askErrorKey(other), String(other)).toBe("generic");
    expect(T.en.errors.generic && T.ar.errors.generic).toBeTruthy();
  });
});

describe("what the database answers", () => {
  it("ask_list: the open pages, and whether the viewer was taken as signed in", () => {
    const l = askList({ signed: true, pages: [{ slug: "farm-ideas", title_en: "Farm", title_ar: "", intro_en: "", intro_ar: "", opens_at: null, closes_at: "2026-11-18T21:00:00+03:00", questions: 1, answered: 0 }, { slug: "BAD" }, { slug: "empty-title", title_en: " " }, null] });
    expect(l).toEqual({ signed: true, pages: [{ slug: "farm-ideas", title_en: "Farm", title_ar: "", closes_at: "2026-11-18T21:00:00+03:00" }] });
    expect(askList(null)).toEqual({ signed: false, pages: [] });
    expect(askList({ pages: "x" })).toEqual({ signed: false, pages: [] });
  });
  it("ask_page: every state, as the page draws it", () => {
    expect(askView({ state: "none" })).toEqual({ state: "none", head: null, full: null });
    // a page for accounts says nothing of itself to a visitor who is not signed in
    expect(askView({ state: "signin" })).toEqual({ state: "signin", head: null, full: null });
    expect(askView({ state: "signin", page: { slug: "x", title_en: "Secret" } })).toEqual({ state: "signin", head: null, full: null });
    expect(askView({ state: "audience" })).toEqual({ state: "audience", head: null, full: null });
    expect(askView({ state: "soon", page: { slug: "s", title_en: "Soon", title_ar: "قريباً", opens_at: "2026-12-01T09:00:00+03:00" } })).toEqual({ state: "soon", head: { title_en: "Soon", title_ar: "قريباً", opens_at: "2026-12-01T09:00:00+03:00" }, full: null });
    expect(askView({ state: "closed", page: { slug: "c", title_en: "Done", title_ar: "" } })).toEqual({ state: "closed", head: { title_en: "Done", title_ar: "", opens_at: null }, full: null });
    const closed = askView(payload({ state: "closed", can_answer: false, page: page({ open: false }) }));
    expect(closed.state).toBe("closed");
    expect(closed.full?.canAnswer).toBe(false);
    expect(closed.full?.questions).toHaveLength(1);
    const ok = askView(payload());
    expect(ok.state).toBe("ok");
    expect(ok.full).toMatchObject({ signed: true, canAnswer: true, preview: false, rk: "rk1", voted: [], page: { id: 1, slug: "farm-ideas", round: 1, open: true, look: {} } });
    // the database still sends a page's 6-digit code; no page asks for one any more, so it is not carried
    expect(ok.full?.page).not.toHaveProperty("code");
    expect(ok.full?.questions[0]).toMatchObject({ id: 11, kind: "cloud", results: "live", open: true, moderated: true, look: {} });
    expect(ok.full?.live).toMatchObject({ ver: 7, state: "ok", open: true, stats: { answers: 3, people: 2 } });
  });
  it("reads anything that is not a page as none: no answer, another shape, a page without its link", () => {
    for (const raw of [null, undefined, "x", 4, [], {}, { state: "weird" }, { state: "ok" }, { state: "ok", page: { id: 1, slug: "BAD SLUG" }, questions: [] }, { state: "soon" }, { state: "closed" }]) {
      expect(askView(raw).state, JSON.stringify(raw)).toBe("none");
    }
  });
  it("keeps what it can of a page that came half-formed, and never trusts a field's type", () => {
    const v = askView(payload({
      signed: "yes", can_answer: "yes", rk: 5, voted: [3, "4", "x", null],
      page: page({ closes_at: "soon", round: "2", look: "dark", current_q: "9" }),
      questions: [question({ id: "12", pos: 2, kind: "choice", results: "everyone", image: "javascript:alert(1)", config: null, look: [1] }), question({ id: 13, pos: 1, image: "https://cdn.example/x.jpg" }), { kind: "cloud" }, null],
      mine: { "12": [mine(5, "odd"), { value: {} }], x: "y" }, live: "none",
    }));
    const f = v.full!;
    expect(f.signed).toBe(false);
    expect(f.canAnswer).toBe(false);
    expect(f.rk).toBe("");
    expect(f.voted).toEqual([3, 4]);
    expect(f.page).toMatchObject({ closes_at: null, round: 2, look: {}, current_q: 9 });
    expect(f.questions.map((q) => q.id)).toEqual([13, 12]); // in the page's order
    expect(f.questions[1]).toMatchObject({ id: 12, results: "staff", image: null, config: {}, look: {} });
    expect(f.questions[0].image).toBe("https://cdn.example/x.jpg");
    expect(f.mine["12"]).toEqual([{ id: 5, value: { t: "Kites" }, body: "Kites", status: "pending", answered: false, votes: 0, created_at: "2026-11-13T10:00:00+03:00" }]);
    expect(f.mine.x).toEqual([]);
    expect(f.live).toBeNull();
  });
  it("a staff preview (ask_page with the page's key) never answers", () => {
    const f = fullOf({ preview: true, can_answer: true });
    expect(f.preview).toBe(true);
    expect(f.canAnswer).toBe(false);
    expect(answerState(f.questions[0], f)).toBe("none");
  });
  it("ask_screen: the page for the big screen, or nothing for a key the database refused", () => {
    expect(askScreen({ ok: false })).toBeNull();
    expect(askScreen(null)).toBeNull();
    const s = askScreen({ ok: true, page: page(), questions: [question()], live: live() });
    expect(s).toMatchObject({ signed: false, canAnswer: false, mine: {}, page: { slug: "farm-ideas" } });
    expect(s?.live?.results["11"]).toBeTruthy();
  });
  it("ask_live: gone, nothing new (which still says whether the page is open), or the whole", () => {
    expect(askLive({ ok: false })).toEqual({ kind: "gone" });
    expect(askLive(null)).toEqual({ kind: "gone" });
    expect(askLive({ ok: true, ver: 7, same: true, state: "closed", open: false, now: "x" })).toEqual({ kind: "same", ver: 7, state: "closed", open: false });
    expect(askLive({ ok: true, ver: 7, same: true })).toEqual({ kind: "same", ver: 7, state: null, open: null }); // a database from before the contract's section E
    const a = askLive(live({ ver: 9, stats: undefined }));
    expect(a.kind).toBe("full");
    if (a.kind === "full") expect(a.live).toMatchObject({ ver: 9, state: "ok", open: true, round: 1, stats: null, q: { "11": { open: true, reveal: false, started_at: null } } });
  });
  it("ask_send: taken (with the viewer's answers when listed, and whether it was a repeat), or why not", () => {
    expect(askSent({ ok: true, status: "pending", score: null, mine: [mine(5)] })).toEqual({ ok: true, status: "pending", repeat: false, mine: [expect.objectContaining({ id: 5, status: "pending", body: "Kites" })] });
    expect(askSent({ ok: true, status: "approved", repeat: true, mine: [] })).toEqual({ ok: true, status: "approved", repeat: true, mine: [] });
    expect(askSent({ ok: true, status: "approved" })).toEqual({ ok: true, status: "approved", repeat: false, mine: null });
    expect(askSent({ ok: false, error: "limit" })).toEqual({ ok: false, error: "limit" });
    expect(askSent({ ok: false, error: "busy" })).toEqual({ ok: false, error: "throttled" });
    expect(askSent({ ok: false, error: "origin" })).toEqual({ ok: false, error: "generic" });
    expect(askSent(null)).toEqual({ ok: false, error: "generic" });
  });
});

describe("the page as it changes", () => {
  it("takes a live answer in: each question's state, the page's, the results", () => {
    const f = fullOf();
    const next = live({ ver: 8, state: "ok", open: true, q: { "11": { open: false, reveal: true, started_at: "2026-11-13T10:05:00+03:00" } }, results: { "11": { n: 9 } } });
    const a = askLive(next);
    if (a.kind !== "full") throw new Error("not full");
    const { full, reload } = applyLive(f, a.live);
    expect(reload).toBe(false);
    expect(full.questions[0]).toMatchObject({ open: false, reveal: true, started_at: "2026-11-13T10:05:00+03:00" });
    expect(full.live?.ver).toBe(8);
    expect(full.live?.results["11"]).toEqual({ n: 9 });
    expect(f.questions[0].open).toBe(true); // the page before is left as it was
  });
  it("asks for the page again when staff put on a question it does not hold, or start a new round", () => {
    const f = fullOf();
    const more = askLive(live({ ver: 8, q: { "11": { open: true, reveal: false, started_at: null }, "12": { open: true, reveal: false, started_at: null } } }));
    const round = askLive(live({ ver: 8, round: 2 }));
    if (more.kind !== "full" || round.kind !== "full") throw new Error("not full");
    expect(applyLive(f, more.live).reload).toBe(true);
    expect(applyLive(f, round.live).reload).toBe(true);
  });
  it("drops a version older than the one it holds: versions only ever grow", () => {
    const f = fullOf();
    const old = askLive(live({ ver: 6, results: {} }));
    if (old.kind !== "full") throw new Error("not full");
    expect(applyLive(f, old.live)).toEqual({ full: f, reload: false });
  });
  it("closes by the clock: a poll with nothing new still says the page stopped taking answers", () => {
    const f = fullOf();
    expect(pageOpen(f)).toBe(true);
    expect(answerState(f.questions[0], f)).toBe("open");
    const shut = applySame(f, { state: "closed", open: false });
    expect(pageOpen(shut)).toBe(false);
    expect(answerState(shut.questions[0], shut)).toBe("none");
    expect(applySame(f, { state: "ok", open: true })).toBe(f); // nothing changed: the same page
    expect(applySame(f, { state: null, open: null })).toBe(f);
    const viaFull = askLive(live({ ver: 8, state: "closed", open: false }));
    if (viaFull.kind !== "full") throw new Error("not full");
    expect(pageOpen(applyLive(f, viaFull.live).full)).toBe(false);
  });
  it("puts the right thing where a question is answered", () => {
    const q = (over: Record<string, unknown> = {}) => fullOf({ questions: [question(over)] });
    const state = (f: AskFull) => answerState(f.questions[0], f);
    expect(state(q())).toBe("open");
    // signed out: one button to sign in; nothing at all once the question or the page takes no more answers
    expect(state(fullOf({ signed: false, can_answer: false }))).toBe("signin");
    expect(state(fullOf({ signed: false, can_answer: false, questions: [question({ open: false })] }))).toBe("none");
    expect(state(fullOf({ signed: false, can_answer: false, page: page({ open: false }) }))).toBe("none");
    // written answers: as many as the question takes a person; one staff did not approve leaves its place free
    const three = { "11": [mine(1), mine(2, "approved"), mine(3)] };
    expect(state(fullOf({ mine: three }))).toBe("full");
    expect(state(fullOf({ mine: { "11": [mine(1), mine(2, "rejected"), mine(3)] } }))).toBe("open");
    // every other kind: one answer, shown locked - or replaced where the question lets it be changed
    const choice = { kind: "choice", config: { options: OPTIONS } };
    const picked = { "11": [mine(4, "approved", { o: ["a"] })] };
    expect(state(q(choice))).toBe("open");
    expect(state(fullOf({ questions: [question(choice)], mine: picked }))).toBe("done");
    expect(state(fullOf({ questions: [question({ ...choice, config: { options: OPTIONS, change: true } })], mine: picked }))).toBe("change");
    expect(state(fullOf({ questions: [question({ ...choice, open: false })], mine: picked }))).toBe("shut");
    expect(state(fullOf({ questions: [question({ ...choice, open: false })] }))).toBe("none");
    // an info slide and the kinds these pages do not draw yet take no answer here
    for (const kind of ["info", "pin", "grid", "form", "quiz", "quiz_text", "something-new"]) expect(state(q({ kind })), kind).toBe("none");
  });
  it("shows a question's results by its rule: at once, after the viewer answered, or never", () => {
    const shown = (over: Record<string, unknown>, rest: Record<string, unknown> = {}, screen = false) => {
      const f = fullOf({ questions: [question(over)], ...rest });
      return resultsShown(f.questions[0], f, screen);
    };
    expect(shown({ results: "live" })).toBe(true);
    expect(shown({ results: "closed" })).toBe(true); // the database sends them only once it may
    expect(shown({ results: "staff" })).toBe(false);
    expect(shown({ results: "answered" })).toBe(false);
    expect(shown({ results: "answered" }, { mine: { "11": [mine(1)] } })).toBe(true); // a waiting answer is an answer
    expect(shown({ results: "answered" }, { mine: { "12": [mine(1)] } })).toBe(false); // another question's is not
    expect(shown({ results: "answered" }, { signed: false, can_answer: false })).toBe(false);
    // once nobody can answer any more there is nothing left to sway: a closed page still shows them
    expect(shown({ results: "answered", open: false })).toBe(true);
    expect(shown({ results: "answered" }, { page: page({ open: false }) })).toBe(true);
    // the big screen has no viewer
    expect(shown({ results: "answered" }, {}, true)).toBe(true);
    expect(shown({ results: "staff" }, {}, true)).toBe(false);
    for (const kind of ["info", "pin", "quiz"]) expect(shown({ kind }), kind).toBe(false);
  });
  it("keeps the viewer's own answers and upvotes up to date between reads", () => {
    const f = fullOf({ mine: { "11": [mine(1), mine(2, "approved")] } });
    expect(hasPending(f)).toBe(true);
    const sent = withMine(f, 11, [{ id: 3, value: { t: "BBQ" }, body: "BBQ", status: "approved", answered: false, votes: 0, created_at: "" }]);
    expect(sent.mine["11"].map((m) => m.id)).toEqual([3]);
    expect(hasPending(sent)).toBe(false);
    expect(withoutMine(f, 11, 1).mine["11"].map((m) => m.id)).toEqual([2]);
    expect(withoutMine(f, 11, 99)).toBe(f);
    const qa = fullOf({ questions: [question({ kind: "qa" })], live: live({ results: { "11": { n: 2, items: [{ id: 20, t: "Parking?", v: 5, a: false }, { id: 21, t: "Food?", v: 1, a: false }] } } }) });
    const up = withVote(qa, 11, 21, true, 2);
    expect(up.voted).toEqual([21]);
    expect(itemsResult("qa", up.live?.results["11"]).items.find((x) => x.id === 21)?.v).toBe(2);
    const guess = withVote(qa, 11, 21, true, null); // no count came back: one more than it had
    expect(itemsResult("qa", guess.live?.results["11"]).items.find((x) => x.id === 21)?.v).toBe(2);
    const down = withVote(up, 11, 21, false, null);
    expect(down.voted).toEqual([]);
    expect(itemsResult("qa", down.live?.results["11"]).items.find((x) => x.id === 21)?.v).toBe(1);
    expect(qa.voted).toEqual([]);
  });
});

describe("when to ask again", () => {
  it("polls a page every 10 seconds and the big screen every 4", () => {
    expect(POLL_MS).toEqual({ page: 10_000, screen: 4_000 });
    expect(pollDelay("page", 0)).toBe(10_000);
    expect(pollDelay("screen", 0)).toBe(4_000);
  });
  it("backs off after each failed try in a row, up to two minutes on a page and one on the screen", () => {
    expect([1, 2, 3, 4, 9].map((n) => pollDelay("page", n))).toEqual([20_000, 40_000, 80_000, 120_000, 120_000]);
    expect([1, 2, 3, 4, 9].map((n) => pollDelay("screen", n))).toEqual([8_000, 16_000, 32_000, 60_000, 60_000]);
    expect(pollDelay("page", -3)).toBe(10_000);
    expect(pollDelay("page", Number.NaN)).toBe(10_000);
  });
  it("reads the page itself again at most once every 30 seconds", () => {
    expect(REREAD_MS).toBe(30_000);
    expect(rereadDue(0, 1_000_000)).toBe(true);
    expect(rereadDue(1_000_000, 1_000_000 + 29_999)).toBe(false);
    expect(rereadDue(1_000_000, 1_000_000 + 30_000)).toBe(true);
  });
});

describe("results, shaped for their charts", () => {
  it("a word cloud: the words with how many sent each", () => {
    expect(cloudResult({ n: 3, people: 2, words: [{ w: " Kites ", n: 2 }, { w: "BBQ", n: 1 }, { w: "", n: 4 }, { w: "x", n: 0 }, null] })).toEqual({ n: 3, people: 2, words: [{ w: "Kites", n: 2 }, { w: "BBQ", n: 1 }] });
    expect(cloudResult(null)).toEqual({ n: 0, people: 0, words: [] });
    expect(cloudResult({ n: 5, words: [{ w: "Kites", n: 2 }, { w: "BBQ", n: 1 }, { w: "Kites ", n: 2 }] }).words).toEqual([{ w: "Kites", n: 4 }, { w: "BBQ", n: 1 }]); // each word once
    expect(cloudResult({ words: [{ w: "a", n: 2 }, { w: "b", n: 3 }] }).n).toBe(5);
    expect(cloudResult({ words: Array.from({ length: 400 }, (_, i) => ({ w: `w${i}`, n: 1 })) }).words).toHaveLength(150);
  });
  it("open answers as sent; Q&A unanswered first, the most upvoted first among them", () => {
    const raw = { n: 4, items: [{ id: 1, t: "Parking?", v: 5, a: false }, { id: 2, t: "Food?", v: 8, a: true }, { id: 3, t: "Prayer room?", v: 7, a: false }, { id: 4, t: "End time?", v: 7, a: false }, { id: "x", t: "no id" }, { id: 5, t: " " }] };
    expect(itemsResult("qa", raw).items.map((x) => x.id)).toEqual([3, 4, 1, 2]);
    expect(itemsResult("open", raw).items.map((x) => x.id)).toEqual([1, 2, 3, 4]);
    expect(itemsResult("qa", raw).n).toBe(4);
    expect(itemsResult("open", {})).toEqual({ n: 0, items: [] });
  });
  it("multiple choice: every option in staff's order, with its count and its share of the people who answered", () => {
    const c = { options: OPTIONS };
    const { n, rows } = choiceRows(c, { n: 10, counts: { a: 4, c: 1, zz: 9 }, correct: ["a"] }, "en");
    expect(n).toBe(10);
    expect(rows).toEqual([
      { id: "a", label: "Pony rides", n: 4, share: 0.4, correct: true },
      { id: "b", label: "Kites", n: 0, share: 0, correct: false },
      { id: "c", label: "Bonfire", n: 1, share: 0.1, correct: false },
    ]);
    expect(choiceRows(c, { n: 10, counts: { a: 4 } }, "ar").rows[0].label).toBe("ركوب المهر");
    expect(choiceRows(c, { n: 10, counts: { a: 4 } }, "ar").rows[2].label).toBe("Bonfire");
    expect(choiceRows(c, {}, "en")).toMatchObject({ n: 0, rows: [{ share: 0 }, { share: 0 }, { share: 0 }] });
    expect(choiceRows(c, { n: 1, counts: { a: 3 } }, "en").rows[0].share).toBe(1); // never more than everyone
  });
  it("scales: each statement's average, where it falls on the track, and how many gave each mark", () => {
    const c = { options: OPTIONS.slice(0, 2), min: 1, max: 5 };
    const r = scaleRows(c, { n: 6, avg: { a: 4, b: 9 }, dist: { a: [0, 1, 0, 2, 3], b: [1] } }, "en");
    expect(r).toMatchObject({ n: 6, min: 1, max: 5 });
    expect(r.rows[0]).toEqual({ id: "a", label: "Pony rides", avg: 4, at: 0.75, dist: [0, 1, 0, 2, 3], most: 3 });
    expect(r.rows[1]).toMatchObject({ avg: 5, at: 1, dist: [1, 0, 0, 0, 0] }); // an average is held inside the scale
    expect(scaleRows(c, {}, "en").rows[0]).toMatchObject({ avg: null, at: 0, dist: [0, 0, 0, 0, 0], most: 0 });
  });
  it("ranking by score and points by average, the best first", () => {
    const c = { options: OPTIONS, total: 100 };
    expect(rankRows(c, { n: 4, score: { a: 5, b: 9, c: 9 }, pos: { a: 2.5, b: 1.9, c: 1.6 } }, "en").rows.map((r) => [r.id, r.share])).toEqual([["c", 1], ["b", 1], ["a", 5 / 9]]);
    expect(rankRows(c, {}, "en").rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
    const p = pointRows(c, { n: 3, sum: { a: 60, b: 150, c: 90 }, avg: { a: 20, b: 50, c: 30 } }, "en");
    expect(p.rows.map((r) => [r.id, r.avg, r.share])).toEqual([["b", 50, 0.5], ["c", 30, 0.3], ["a", 20, 0.2]]);
    expect(p).toMatchObject({ n: 3, total: 100 });
  });
  it("a number: its average and the bins of its histogram", () => {
    const r = numberResult({ n: 5, avg: 2.6, min: 0, max: 8, bins: [{ lo: 0, hi: 5, n: 4 }, { lo: 5, hi: 10, n: 1 }, { lo: "x", hi: 1, n: 1 }], correct: 3 });
    expect(r).toEqual({ n: 5, avg: 2.6, min: 0, max: 8, bins: [{ lo: 0, hi: 5, n: 4 }, { lo: 5, hi: 10, n: 1 }], most: 4, correct: 3 });
    expect(numberResult(null)).toEqual({ n: 0, avg: null, min: null, max: null, bins: [], most: 0, correct: null });
  });
});

describe("the big screen", () => {
  const qs = [question({ id: 11 }), question({ id: 12 }), question({ id: 13 })].map((q) => askView(payload({ questions: [q] })).full!.questions[0]) as AskQuestion[];
  it("shows the question its operator moved to, else the one staff put on, else the one the address names, else the first", () => {
    const at = (o: Partial<Parameters<typeof screenAt>[1]>) => screenAt(qs, { picked: null, pace: "self", current: null, asked: null, ...o });
    expect(at({})).toBe(0);
    expect(at({ asked: "12" })).toBe(1);
    expect(at({ asked: "99" })).toBe(0);
    expect(at({ asked: "12; drop" })).toBe(0);
    expect(at({ pace: "live", current: 13, asked: "12" })).toBe(2);
    expect(at({ pace: "self", current: 13, asked: "12" })).toBe(1); // a page people pace themselves has no question "on"
    expect(at({ picked: 11, pace: "live", current: 13 })).toBe(0);
    expect(at({ picked: 99, asked: "13" })).toBe(2);
    expect(screenAt([], { picked: null, pace: "self", current: null, asked: null })).toBe(-1);
  });
  it("moves one question on or back, stopping at the ends", () => {
    expect(screenStep(3, 0, 1)).toBe(1);
    expect(screenStep(3, 2, 1)).toBe(2);
    expect(screenStep(3, 0, -1)).toBe(0);
    expect(screenStep(0, 0, 1)).toBe(-1);
  });
});

describe("coming back from creating an account", () => {
  it("lands on the Ask address the visitor left, and on nothing else", () => {
    expect(askBack("/ask")).toBe("/ask");
    expect(askBack("%2Fask%2Ffarm-ideas")).toBe("/ask/farm-ideas");
    expect(askBack("/ask/farm-ideas")).toBe("/ask/farm-ideas");
    for (const bad of [null, undefined, "", "/account", "/ask/", "/ask/Farm", "/ask/farm-ideas/screen", "/ask/farm-ideas?k=1", "//evil.example/ask", "https://evil.example/ask", "/ask/../account", "/asking", "%E0%A4%A", "/ask/ab"]) {
      expect(askBack(bad), String(bad)).toBeNull();
    }
  });
});
