import { describe, expect, it } from "vitest";
import {
  GRID_STEP, axisName, formFields, gridAt, gridConfig, gridResult, gridSnap, pinAt, pinCells, pinMove, pinResult, pinTarget, quizConfig, quizRows, quizTextConfig, quizTextResult,
  rightWords, sentForm, sentGrid, sentPin, sentQuiz, shapeForm, shapeGrid, shapePin, shapeQuiz, shapeQuizText,
} from "../ask-kinds";

// The five kinds of stage 2 (lib/ask-kinds.ts): what each one's settings read as, what its answer is before it is
// sent (the database's ask_send has the last word; these refuse only what it surely would), what the viewer sent
// read back, and each result shaped for its chart. The payloads are made up to the contract's shapes.
const opt = (id: string, en: string, ar = "") => ({ id, en, ar });
const ITEMS = [opt("a", "Pony rides", "ركوب المهر"), opt("b", "Kites"), opt("c", "Bonfire")];

describe("a grid", () => {
  const c = { options: ITEMS, max: 8, x_en: "Cost", x_ar: "التكلفة", y_en: "Fun", y_ar: "" };
  it("reads its settings: the items, the axes' names, and a scale's top from 3 to 10 (10 when not said)", () => {
    expect(gridConfig(c)).toMatchObject({ max: 8, x_en: "Cost", x_ar: "التكلفة", y_en: "Fun" });
    expect(gridConfig(c).options.map((o) => o.id)).toEqual(["a", "b", "c"]);
    expect([2, 3, 10, 11, "7", 4.5, null].map((max) => gridConfig({ options: ITEMS, max }).max)).toEqual([10, 3, 10, 10, 7, 10, 10]);
    expect(gridConfig(null)).toMatchObject({ options: [], max: 10, x_en: "", y_ar: "" });
    expect(axisName("en", gridConfig(c), "x")).toBe("Cost");
    expect(axisName("ar", gridConfig(c), "x")).toBe("التكلفة");
    expect(axisName("ar", gridConfig(c), "y")).toBe("Fun"); // staff wrote no Arabic: the English stands in
    expect(axisName("en", gridConfig({}), "y")).toBe("");
  });
  it("lands a marker on the nearest half, never off the scale", () => {
    expect(GRID_STEP).toBe(0.5);
    expect([0.2, 0.26, 3.74, 3.76, 9, -2, Number.NaN].map((v) => gridSnap(v, 8))).toEqual([0, 0.5, 3.5, 4, 8, 0, 0]);
  });
  it("turns where a pointer falls on the square into the two values: x the way the page reads, y upwards", () => {
    expect(gridAt(0, 1, 10, false)).toEqual([0, 0]);      // bottom left
    expect(gridAt(1, 0, 10, false)).toEqual([10, 10]);    // top right
    expect(gridAt(0.25, 0.5, 10, false)).toEqual([2.5, 5]);
    expect(gridAt(0.25, 0.5, 10, true)).toEqual([7.5, 5]); // Arabic: x grows from the right
    expect(gridAt(-0.3, 1.4, 10, false)).toEqual([0, 0]);  // dragged past the edge
    expect(gridAt(0.333, 0.333, 6, false)).toEqual([2, 4]);
  });
  it("sends every item's place as {g: {id: [x, y]}}, and nothing until every item is placed", () => {
    expect(shapeGrid(c, { a: [1, 2], b: [0, 8], c: [3.5, 4.5] })).toEqual({ ok: true, value: { g: { a: [1, 2], b: [0, 8], c: [3.5, 4.5] } } });
    expect(shapeGrid(c, { a: [1, 2], b: [0, 8] })).toEqual({ ok: false, error: "empty" });
    expect(shapeGrid(c, {})).toEqual({ ok: false, error: "empty" });
    expect(shapeGrid(c, null)).toEqual({ ok: false, error: "empty" });
    for (const bad of [[1], [1, 2, 3], [9, 2], [1, -1], ["x", 2], "1,2", 5]) expect(shapeGrid(c, { a: bad, b: [0, 0], c: [0, 0] }), JSON.stringify(bad)).toEqual({ ok: false, error: "invalid" });
    // an item that is not the question's is left out, as the database would refuse it
    expect(shapeGrid(c, { a: [1, 2], b: [0, 8], c: [3, 4], z: [1, 1] })).toEqual({ ok: true, value: { g: { a: [1, 2], b: [0, 8], c: [3, 4] } } });
    expect(shapeGrid({ options: [] }, {})).toEqual({ ok: false, error: "invalid" });
  });
  it("reads the viewer's own places back, and the result's averaged points for the chart", () => {
    expect(sentGrid({ g: { a: [1, 2.5], b: ["3", 4], c: [1], d: "x" } })).toEqual({ a: [1, 2.5], b: [3, 4] });
    expect(sentGrid(null)).toEqual({});
    const r = gridResult(c, { n: 12, pts: { a: [2.25, 6.5], c: [9.4, -1], z: [1, 1] } }, "ar");
    expect(r.n).toBe(12);
    expect(r.max).toBe(8);
    // an item nobody placed has no point; a point is never off the scale; the items keep staff's order and numbers
    expect(r.points).toEqual([{ id: "a", label: "ركوب المهر", index: 0, x: 2.25, y: 6.5 }, { id: "c", label: "Bonfire", index: 2, x: 8, y: 0 }]);
    expect(r.names.map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(gridResult(c, null, "en")).toMatchObject({ n: 0, points: [] });
  });
});

describe("a pin", () => {
  it("is kept inside the picture, to four places", () => {
    expect(pinAt(0.123456, 0.987654)).toEqual({ x: 0.1235, y: 0.9877 });
    expect(pinAt(-0.2, 1.7)).toEqual({ x: 0, y: 1 });
    expect(pinAt(Number.NaN, 0.5)).toEqual({ x: 0.5, y: 0.5 });
  });
  it("is sent as {x, y}, and not at all before it is dropped", () => {
    expect(shapePin({ x: 0.25, y: 0.5 })).toEqual({ ok: true, value: { x: 0.25, y: 0.5 } });
    expect(shapePin(null)).toEqual({ ok: false, error: "empty" });
    expect(shapePin({ x: 0.25 })).toEqual({ ok: false, error: "empty" });
    expect(shapePin({ x: 1.2, y: 0.5 })).toEqual({ ok: false, error: "invalid" });
    expect(sentPin({ x: 0.3, y: 0.7 })).toEqual({ x: 0.3, y: 0.7 });
    expect(sentPin({ x: 3, y: 0.7 })).toBeNull();
    expect(sentPin({ t: "x" })).toBeNull();
  });
  it("moves by a hundredth with an arrow key, by five with Shift, and drops in the middle on the first press", () => {
    expect(pinMove(null, "ArrowLeft")).toEqual({ x: 0.5, y: 0.5 });
    expect(pinMove({ x: 0.5, y: 0.5 }, "ArrowRight")).toEqual({ x: 0.51, y: 0.5 });
    expect(pinMove({ x: 0.5, y: 0.5 }, "ArrowLeft", true)).toEqual({ x: 0.45, y: 0.5 });
    expect(pinMove({ x: 0.5, y: 0.5 }, "ArrowUp")).toEqual({ x: 0.5, y: 0.49 });
    expect(pinMove({ x: 0.5, y: 0.5 }, "ArrowDown", true)).toEqual({ x: 0.5, y: 0.55 });
    expect(pinMove({ x: 0.995, y: 0 }, "ArrowRight")).toEqual({ x: 1, y: 0 });
    expect(pinMove({ x: 0.5, y: 0 }, "ArrowUp", true)).toEqual({ x: 0.5, y: 0 });
    for (const key of ["Enter", " ", "a", "Tab", "Home"]) expect(pinMove({ x: 0.5, y: 0.5 }, key), key).toBeNull();
  });
  it("reads the right area only as a circle inside the picture", () => {
    expect(pinTarget({ x: 0.4, y: 0.6, r: 0.1 })).toEqual({ x: 0.4, y: 0.6, r: 0.1 });
    for (const bad of [null, {}, { x: 0.4, y: 0.6 }, { x: 0.4, y: 0.6, r: 0 }, { x: 0.4, y: 0.6, r: 0.6 }, { x: 1.4, y: 0.6, r: 0.1 }, [0.4, 0.6, 0.1]]) expect(pinTarget(bad), JSON.stringify(bad)).toBeNull();
  });
  it("reads a result's pins, and the right area once staff reveal it", () => {
    const r = pinResult({ n: 5, pins: [[0.1, 0.2], [0.9, 0.95], ["0.5", 0.5], [2, 0.5], [0.3], "x"], correct: { x: 0.5, y: 0.5, r: 0.2 } });
    expect(r).toEqual({ n: 5, pins: [{ x: 0.1, y: 0.2 }, { x: 0.9, y: 0.95 }, { x: 0.5, y: 0.5 }], correct: { x: 0.5, y: 0.5, r: 0.2 } });
    expect(pinResult({ n: 2, pins: [[0, 0], [1, 1]] }).correct).toBeNull();
    expect(pinResult(null)).toEqual({ n: 0, pins: [], correct: null });
    expect(pinResult({ pins: Array.from({ length: 450 }, () => [0.5, 0.5]) }).pins).toHaveLength(400);
  });
  it("counts the pins into cells over the picture, row by row from the top left", () => {
    const { counts, most } = pinCells([{ x: 0, y: 0 }, { x: 0.05, y: 0.1 }, { x: 0.99, y: 0 }, { x: 1, y: 1 }, { x: 0.5, y: 0.5 }], 2, 2);
    expect(counts).toEqual([2, 1, 0, 2]);
    expect(most).toBe(2);
    expect(pinCells([], 10, 8)).toEqual({ counts: Array.from({ length: 80 }, () => 0), most: 0 });
    expect(pinCells([{ x: 1, y: 1 }], 10, 8).counts[79]).toBe(1); // the far corner is the last cell, not one past it
  });
});

describe("a form", () => {
  const c = { fields: [
    { id: "name", en: "Your bike's name", ar: "اسم دراجتك", type: "text" },
    { id: "km", en: "Kilometres a week", ar: "", type: "number", required: false },
    { id: "size", en: "Size", ar: "المقاس", type: "choice", options: [opt("s", "Small"), opt("m", "Medium")], required: true },
    { id: "BAD ID", en: "x", type: "text" }, { id: "dup", en: "", ar: "", type: "text" }, { id: "name", en: "again", type: "text" }, { id: "odd", en: "x", type: "date" }, null,
  ] };
  it("reads its fields in order: a field is required unless staff said it is not", () => {
    expect(formFields(c).map((f) => [f.id, f.type, f.required, f.options.length])).toEqual([["name", "text", true, 0], ["km", "number", false, 0], ["size", "choice", true, 2]]);
    expect(formFields(null)).toEqual([]);
    expect(formFields({ fields: Array.from({ length: 12 }, (_, i) => ({ id: `f${i}`, en: "x", type: "text" })) })).toHaveLength(8);
  });
  it("sends {f: {id: value}}: words with their spaces folded, a number as a number, a choice as its option's id", () => {
    expect(shapeForm(c, { name: "  Red   Rocket ", km: "٤٢٫٥", size: "m" })).toEqual({ ok: true, value: { f: { name: "Red Rocket", km: 42.5, size: "m" } } });
    // a field that may be left empty is left out
    expect(shapeForm(c, { name: "Rocket", km: "", size: "s" })).toEqual({ ok: true, value: { f: { name: "Rocket", size: "s" } } });
  });
  it("refuses what the database would: a required field left empty, a number that is not one, a choice that is not the field's, too many words", () => {
    expect(shapeForm(c, { name: "", size: "s" })).toEqual({ ok: false, error: "empty" });
    expect(shapeForm(c, { name: "Rocket" })).toEqual({ ok: false, error: "empty" });
    expect(shapeForm(c, {})).toEqual({ ok: false, error: "empty" });
    expect(shapeForm(c, { name: "Rocket", km: "a lot", size: "s" })).toEqual({ ok: false, error: "invalid" });
    expect(shapeForm(c, { name: "Rocket", size: "xl" })).toEqual({ ok: false, error: "invalid" });
    expect(shapeForm(c, { name: "x".repeat(201), size: "s" })).toEqual({ ok: false, error: "long" });
    expect(shapeForm(c, { name: "x".repeat(200), size: "s" }).ok).toBe(true);
    // a form whose every field may be left empty still needs one of them
    const loose = { fields: [{ id: "a", en: "A", type: "text", required: false }, { id: "b", en: "B", type: "number", required: false }] };
    expect(shapeForm(loose, {})).toEqual({ ok: false, error: "empty" });
    expect(shapeForm(loose, { b: "0" })).toEqual({ ok: true, value: { f: { b: 0 } } });
  });
  it("reads the viewer's own answer back as the fields hold it", () => {
    expect(sentForm({ f: { name: "Rocket", km: 42.5, size: "m", odd: { x: 1 } } })).toEqual({ name: "Rocket", km: "42.5", size: "m" });
    expect(sentForm({ t: "x" })).toEqual({});
  });
});

describe("the quizzes", () => {
  const c = { options: ITEMS, seconds: 15, speed: false };
  it("read their settings: the clock's seconds (20 for a quiz, 30 for a typed one), and the right answers only once revealed", () => {
    expect(quizConfig(c)).toMatchObject({ seconds: 15, speed: false, correct: [] });
    expect(quizConfig({ options: ITEMS })).toMatchObject({ seconds: 20, speed: true, correct: [] });
    expect(quizConfig({ options: ITEMS, correct: ["b", "z", 4] }).correct).toEqual(["b"]);
    expect([4, 5, 120, 121, "30", 12.5].map((seconds) => quizConfig({ options: ITEMS, seconds }).seconds)).toEqual([20, 5, 120, 20, 30, 20]);
    expect(quizTextConfig({})).toEqual({ seconds: 30, speed: true, maxLen: 40, accept: [] });
    expect(quizTextConfig({ seconds: 10, speed: false, max_len: 12, accept: ["Jeddah", " ", "جدة", 7] })).toEqual({ seconds: 10, speed: false, maxLen: 12, accept: ["Jeddah", "جدة"] });
    expect([4, 5, 80, 81].map((max_len) => quizTextConfig({ max_len }).maxLen)).toEqual([40, 5, 80, 40]);
  });
  it("send one option as {o: [id]}, and a typed answer as {t}", () => {
    expect(shapeQuiz(c, "b")).toEqual({ ok: true, value: { o: ["b"] } });
    expect(shapeQuiz(c, "")).toEqual({ ok: false, error: "empty" });
    expect(shapeQuiz(c, "z")).toEqual({ ok: false, error: "invalid" });
    expect(shapeQuiz(c, ["a", "b"])).toEqual({ ok: false, error: "empty" });
    expect(shapeQuizText({ max_len: 10 }, "  Corniche  ")).toEqual({ ok: true, value: { t: "Corniche" } });
    expect(shapeQuizText({ max_len: 10 }, "   ")).toEqual({ ok: false, error: "empty" });
    expect(shapeQuizText({ max_len: 10 }, "The Corniche")).toEqual({ ok: false, error: "long" });
    expect(sentQuiz({ o: ["c"] })).toBe("c");
    expect(sentQuiz({ t: "x" })).toBe("");
  });
  it("shape a quiz's result: the options as staff wrote them, and how many were right once the right ones are known", () => {
    const before = quizRows(c, { n: 10, counts: { a: 2, b: 7, c: 1 } }, "en");
    expect(before.rows.map((r) => [r.id, r.n, r.correct])).toEqual([["a", 2, false], ["b", 7, false], ["c", 1, false]]);
    expect(before.right).toBeNull(); // not revealed: nothing says which was right, or how many
    const after = quizRows(c, { n: 10, counts: { a: 2, b: 7, c: 1 }, correct: ["b"] }, "en");
    expect(after.rows.map((r) => r.correct)).toEqual([false, true, false]);
    expect(after.right).toBe(7);
    expect(quizRows(c, { n: 10, counts: { a: 2, b: 7, c: 1 }, correct: ["a", "c"] }, "en").right).toBe(3);
    expect(quizRows(c, null, "en")).toMatchObject({ n: 0, right: null });
  });
  it("shape a typed quiz's result: how many were right, the accepted answers on reveal, and the answers given most when they are sent", () => {
    expect(quizTextResult({ n: 9, right: 4 })).toEqual({ n: 9, right: 4, correct: [], top: [] });
    expect(quizTextResult({ n: 9, right: 4, correct: ["Jeddah", "جدة", ""], top: [{ w: "Jeddah", n: 4 }, { w: "Riyadh", n: 3 }, { w: "", n: 2 }, { w: "x", n: 0 }] }))
      .toEqual({ n: 9, right: 4, correct: ["Jeddah", "جدة"], top: [{ w: "Jeddah", n: 4 }, { w: "Riyadh", n: 3 }] });
    expect(quizTextResult({ n: 3, right: 8 }).right).toBe(3);
    expect(quizTextResult(null)).toEqual({ n: 0, right: 0, correct: [], top: [] });
  });
});

describe("a revealed right answer, in words", () => {
  const days = [opt("thu", "Thursday", "الخميس"), opt("fri", "Friday", "الجمعة"), opt("sat", "Saturday", "السبت")];
  it("is said only once staff reveal the question", () => {
    expect(rightWords({ kind: "choice", config: { options: days, correct: ["fri"] }, reveal: false }, "en")).toBe("");
    expect(rightWords({ kind: "choice", config: { options: days, correct: ["fri"] }, reveal: true }, "en")).toBe("Friday");
  });
  it("names a choice's or a quiz's right options in the reader's language, in the order staff wrote them", () => {
    expect(rightWords({ kind: "quiz", config: { options: days, correct: ["sat", "thu"] }, reveal: true }, "ar")).toBe("الخميس · السبت");
    // the settings came without it: the result's own `correct` says it
    expect(rightWords({ kind: "choice", config: { options: days }, reveal: true }, "en", { n: 3, counts: {}, correct: ["thu"] })).toBe("Thursday");
    expect(rightWords({ kind: "quiz", config: { options: days, correct: ["nope"] }, reveal: true }, "en")).toBe("");
  });
  it("gives a number with its unit, and a typed quiz's accepted answers", () => {
    expect(rightWords({ kind: "number", config: { min: 0, max: 100, correct: 12.5, unit_en: "km", unit_ar: "كم" }, reveal: true }, "en")).toBe("12.5 km");
    expect(rightWords({ kind: "number", config: { min: 0, max: 100, unit_ar: "كم" }, reveal: true }, "ar", { correct: 60 })).toBe("60 كم");
    expect(rightWords({ kind: "number", config: { min: 0, max: 100 }, reveal: true }, "en")).toBe("");
    expect(rightWords({ kind: "quiz_text", config: { accept: ["Jeddah", "جدة"] }, reveal: true }, "en")).toBe("Jeddah · جدة");
    expect(rightWords({ kind: "quiz_text", config: {}, reveal: true }, "en", { n: 4, right: 2, correct: ["Jeddah"] })).toBe("Jeddah");
  });
  it("is nothing for a kind whose right answer is not words (a pin's is ringed on its picture)", () => {
    expect(rightWords({ kind: "pin", config: { correct: { x: 0.3, y: 0.6, r: 0.1 } }, reveal: true }, "en")).toBe("");
    expect(rightWords({ kind: "grid", config: {}, reveal: true }, "en")).toBe("");
  });
});
