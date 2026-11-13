import { askNum, askText, charCount, choiceConfig, choiceRows, foldSpaces, latinDigits, numberConfig, optionText, optionsOf, type AskOption, type BarRow, type Shaped } from "./ask";

// The five kinds of stage 2 (contract section 2 and H6; the database's ask_send and _ask_result are the truth): a
// grid (items placed on two axes), a pin (dropped on a picture), a short form, and the two quizzes. For each: its
// settings as staff wrote them, the value an answer is sent as (checked here only where the database surely would
// refuse it - it has the last word), what the viewer sent read back, and its result shaped for its chart. Pure, like
// lib/ask.ts: nothing here trusts a shape.

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const int = (v: unknown): number | null => { const n = num(v); return n !== null && Number.isInteger(n) ? n : null; };
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const no = (error: Extract<Shaped, { ok: false }>["error"]): Shaped => ({ ok: false, error });
const yes = (value: Record<string, unknown>): Shaped => ({ ok: true, value });

/* ------------------------------------------------------------------ grid: items placed on two axes */

export type GridConfig = { options: AskOption[]; max: number; x_en: string; x_ar: string; y_en: string; y_ar: string };
/** A grid's settings: its items, each axis's name, and the scale's top (3 to 10; 10 when not said). Both axes run
 *  from 0 to `max`. */
export function gridConfig(config: unknown): GridConfig {
  const c = obj(config) ?? {};
  const max = int(c.max);
  return { options: optionsOf(c), max: max !== null && max >= 3 && max <= 10 ? max : 10, x_en: str(c.x_en), x_ar: str(c.x_ar), y_en: str(c.y_en), y_ar: str(c.y_ar) };
}
/** A marker lands on the nearest half: fine enough for an opinion, and the same places the two sliders reach. */
export const GRID_STEP = 0.5;
export const gridSnap = (v: number, max: number): number => clamp(Math.round((Number.isFinite(v) ? v : 0) / GRID_STEP) * GRID_STEP, 0, max);
/** Where a pointer falls on the board, as the item's two values. `fx` and `fy` are fractions of the board from its
 *  left and its top; x grows the way the page reads (from the right in Arabic), y upwards. */
export const gridAt = (fx: number, fy: number, max: number, rtl: boolean): [number, number] =>
  [gridSnap((rtl ? 1 - fx : fx) * max, max), gridSnap((1 - fy) * max, max)];

export type GridMarks = Record<string, [number, number]>;
/** A grid's answer: {g: {id: [x, y]}} - every item placed, each value from 0 to max. An item not placed yet: "empty". */
export function shapeGrid(config: unknown, marks: unknown): Shaped {
  const c = gridConfig(config);
  const m = obj(marks) ?? {};
  const g: GridMarks = {};
  for (const o of c.options) {
    const v = m[o.id];
    if (v === undefined || v === null) return no("empty");
    const x = num(list(v)[0]), y = num(list(v)[1]);
    if (list(v).length !== 2 || x === null || y === null || x < 0 || x > c.max || y < 0 || y > c.max) return no("invalid");
    g[o.id] = [x, y];
  }
  return c.options.length ? yes({ g }) : no("invalid");
}
/** What the viewer sent, to fill the board again. */
export function sentGrid(value: unknown): GridMarks {
  const out: GridMarks = {};
  for (const [id, v] of Object.entries(obj(obj(value)?.g) ?? {})) {
    const x = num(list(v)[0]), y = num(list(v)[1]);
    if (x !== null && y !== null) out[id] = [x, y];
  }
  return out;
}
export type GridPoint = { id: string; label: string; index: number; x: number; y: number };
/** A grid's result: each item's averaged point (an item nobody placed has none), in the order staff wrote the items. */
export function gridResult(config: unknown, raw: unknown, locale: string): { n: number; max: number; points: GridPoint[]; names: { id: string; label: string; index: number }[] } {
  const c = gridConfig(config);
  const r = obj(raw) ?? {};
  const pts = obj(r.pts) ?? {};
  const names = c.options.map((o, index) => ({ id: o.id, label: optionText(locale, o), index }));
  const points: GridPoint[] = [];
  for (const o of names) {
    const x = num(list(pts[o.id])[0]), y = num(list(pts[o.id])[1]);
    if (x !== null && y !== null) points.push({ ...o, x: clamp(x, 0, c.max), y: clamp(y, 0, c.max) });
  }
  return { n: Math.max(0, int(r.n) ?? 0), max: c.max, points, names };
}
/** An axis's name in the reader's language, or "" when staff wrote none. */
export const axisName = (locale: string, c: GridConfig, axis: "x" | "y"): string => (axis === "x" ? askText(locale, c.x_en, c.x_ar) : askText(locale, c.y_en, c.y_ar));

/* ------------------------------------------------------------------ pin: a point on a picture */

/** A pin: fractions of the picture from its left and from its top, 0 to 1. */
export type Pin = { x: number; y: number };
const frac = (v: number): number => clamp(Math.round(v * 10000) / 10000, 0, 1);
/** A pin as it is kept: inside the picture, to four places (as the database rounds it). */
export const pinAt = (x: number, y: number): Pin => ({ x: frac(Number.isFinite(x) ? x : 0.5), y: frac(Number.isFinite(y) ? y : 0.5) });
/** A pin's answer: {x, y}. No pin dropped yet: "empty". */
export function shapePin(pin: unknown): Shaped {
  const p = obj(pin);
  const x = num(p?.x), y = num(p?.y);
  if (!p || x === null || y === null) return no("empty");
  if (x < 0 || x > 1 || y < 0 || y > 1) return no("invalid");
  return yes({ x: frac(x), y: frac(y) });
}
export function sentPin(value: unknown): Pin | null {
  const v = obj(value);
  const x = num(v?.x), y = num(v?.y);
  return v && x !== null && y !== null && x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null;
}
/** The keyboard's way to the pin: an arrow key moves it a hundredth of the picture (with Shift, five); the first
 *  press drops it in the middle. Any other key leaves it where it is (null: not a key of the pin's). */
export function pinMove(pin: Pin | null, key: string, big = false): Pin | null {
  const by = big ? 0.05 : 0.01;
  const d = key === "ArrowLeft" ? [-by, 0] : key === "ArrowRight" ? [by, 0] : key === "ArrowUp" ? [0, -by] : key === "ArrowDown" ? [0, by] : null;
  if (!d) return null;
  return pin ? pinAt(pin.x + d[0], pin.y + d[1]) : { x: 0.5, y: 0.5 };
}
/** The right area of a pin question, once staff reveal it: a circle at x, y whose radius is `r` of the picture's width. */
export type PinTarget = { x: number; y: number; r: number };
export function pinTarget(v: unknown): PinTarget | null {
  const o = obj(v);
  const x = num(o?.x), y = num(o?.y), r = num(o?.r);
  return o && x !== null && y !== null && r !== null && x >= 0 && x <= 1 && y >= 0 && y <= 1 && r > 0 && r <= 0.5 ? { x, y, r } : null;
}
/** A pin question's result: every pin (the database sends the last 400), and the right area on reveal. */
export function pinResult(raw: unknown): { n: number; pins: Pin[]; correct: PinTarget | null } {
  const r = obj(raw) ?? {};
  const pins: Pin[] = [];
  for (const p of list(r.pins)) {
    const x = num(list(p)[0]), y = num(list(p)[1]);
    if (x !== null && y !== null && x >= 0 && x <= 1 && y >= 0 && y <= 1) pins.push({ x, y });
  }
  return { n: Math.max(0, int(r.n) ?? pins.length), pins: pins.slice(0, 400), correct: pinTarget(r.correct) };
}
/** The pins counted into a grid of cells over the picture (the `heat` chart): row by row from the top left, and the
 *  fullest cell's count. */
export function pinCells(pins: readonly Pin[], cols: number, rows: number): { counts: number[]; most: number } {
  const counts = Array.from({ length: Math.max(1, cols) * Math.max(1, rows) }, () => 0);
  for (const p of pins) counts[Math.min(rows - 1, Math.floor(p.y * rows)) * cols + Math.min(cols - 1, Math.floor(p.x * cols))]++;
  return { counts, most: Math.max(...counts, 0) };
}

/* ------------------------------------------------------------------ form: a few fields, one Send */

export type FormField = { id: string; en: string; ar: string; type: "text" | "number" | "choice"; options: AskOption[]; required: boolean };
/** A form's fields in order. A field is required unless staff said otherwise (as the database reads it). */
export function formFields(config: unknown): FormField[] {
  const out: FormField[] = [];
  for (const x of list(obj(config)?.fields)) {
    const f = obj(x);
    const id = str(f?.id);
    const type = f?.type === "number" || f?.type === "choice" ? f.type : f?.type === "text" ? "text" : null;
    if (!f || !/^[a-z0-9]{1,12}$/.test(id) || !type || out.some((o) => o.id === id) || !(str(f.en).trim() || str(f.ar).trim())) continue;
    out.push({ id, en: str(f.en), ar: str(f.ar), type, options: type === "choice" ? optionsOf(f) : [], required: f.required !== false });
  }
  return out.slice(0, 8);
}
/** The longest a form's text field takes (the database's own). */
export const FORM_TEXT_MAX = 200;
const typedNumber = (raw: unknown): number | null | "bad" => {
  const text = latinDigits(typeof raw === "number" ? String(raw) : str(raw)).replace(/[٫,]/g, ".").trim();
  if (!text) return null;
  return /^-?\d+(?:\.\d+)?$/.test(text) && Number.isFinite(Number(text)) ? Number(text) : "bad";
};
/** A form's answer: {f: {id: value}} - a text (spaces folded), a number, or a choice's option id; a field left empty
 *  is left out. A required field left empty, or nothing filled at all: "empty". */
export function shapeForm(config: unknown, values: unknown): Shaped {
  const v = obj(values) ?? {};
  const f: Record<string, string | number> = {};
  for (const field of formFields(config)) {
    const raw = v[field.id];
    if (field.type === "number") {
      const n = typedNumber(raw);
      if (n === "bad") return no("invalid");
      if (n === null) { if (field.required) return no("empty"); continue; }
      f[field.id] = n;
    } else if (field.type === "choice") {
      const id = str(raw);
      if (!id) { if (field.required) return no("empty"); continue; }
      if (!field.options.some((o) => o.id === id)) return no("invalid");
      f[field.id] = id;
    } else {
      const t = foldSpaces(str(raw));
      if (!t) { if (field.required) return no("empty"); continue; }
      if (charCount(t) > FORM_TEXT_MAX) return no("long");
      f[field.id] = t;
    }
  }
  return Object.keys(f).length ? yes({ f }) : no("empty");
}
/** What the viewer sent, as the form's fields hold it (every value as text). */
export function sentForm(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, v] of Object.entries(obj(obj(value)?.f) ?? {})) if (typeof v === "string" || typeof v === "number") out[id] = String(v);
  return out;
}

/* ------------------------------------------------------------------ the two quizzes */

const seconds = (v: unknown, dflt: number): number => { const n = int(v); return n !== null && n >= 5 && n <= 120 ? n : dflt; };
const ids = (v: unknown): string[] => list(v).filter((x): x is string => typeof x === "string");

export type QuizConfig = { options: AskOption[]; seconds: number; speed: boolean; correct: string[] };
/** A quiz's settings: 2 to 6 options, the seconds its clock runs (20 when not said), and the right option or
 *  options - which the database hands over only once staff reveal the question (empty until then). */
export function quizConfig(config: unknown): QuizConfig {
  const c = obj(config) ?? {};
  const options = optionsOf(c);
  return { options, seconds: seconds(c.seconds, 20), speed: c.speed !== false, correct: ids(c.correct).filter((id) => options.some((o) => o.id === id)) };
}
/** A quiz answer: {o: [id]} - one of the question's own options. */
export function shapeQuiz(config: unknown, pick: unknown): Shaped {
  const id = str(pick);
  if (!id) return no("empty");
  return quizConfig(config).options.some((o) => o.id === id) ? yes({ o: [id] }) : no("invalid");
}
export type QuizTextConfig = { seconds: number; speed: boolean; maxLen: number; accept: string[] };
/** A typed quiz's settings: its clock (30 seconds when not said), the longest answer (40 characters when not said),
 *  and the accepted answers once staff reveal them. */
export function quizTextConfig(config: unknown): QuizTextConfig {
  const c = obj(config) ?? {};
  const len = int(c.max_len);
  return { seconds: seconds(c.seconds, 30), speed: c.speed !== false, maxLen: len !== null && len >= 5 && len <= 80 ? len : 40, accept: ids(c.accept).filter((x) => x.trim()) };
}
/** A typed quiz answer: {t} - the words, spaces folded, no longer than the question takes. */
export function shapeQuizText(config: unknown, text: unknown): Shaped {
  const t = foldSpaces(str(text));
  if (!t) return no("empty");
  return charCount(t) > quizTextConfig(config).maxLen ? no("long") : yes({ t });
}
/** A quiz question's result for its chart: every option with how many picked it and, on reveal, which are right and
 *  how many people that was (one pick a person, so the right options' counts add up to them). */
export function quizRows(config: unknown, raw: unknown, locale: string): { n: number; rows: BarRow[]; right: number | null } {
  const { n, rows } = choiceRows(config, raw, locale);
  const known = rows.some((r) => r.correct);
  return { n, rows, right: known ? Math.min(n, rows.reduce((a, r) => a + (r.correct ? r.n : 0), 0)) : null };
}
/** A typed quiz's result: how many answered and how many were right; on reveal the accepted answers; and the answers
 *  given most, when the database sends them (to staff only, as it stands). */
export function quizTextResult(raw: unknown): { n: number; right: number; correct: string[]; top: { w: string; n: number }[] } {
  const r = obj(raw) ?? {};
  const top: { w: string; n: number }[] = [];
  for (const x of list(r.top)) {
    const o = obj(x);
    const w = str(o?.w).trim(), n = int(o?.n) ?? 0;
    if (w && n > 0) top.push({ w, n });
  }
  const n = Math.max(0, int(r.n) ?? 0);
  return { n, right: clamp(int(r.right) ?? 0, 0, n), correct: ids(r.correct).filter((x) => x.trim()), top: top.slice(0, 20) };
}
/** What the viewer picked on a quiz question, or "" when they gave no answer. */
export const sentQuiz = (value: unknown): string => ids(obj(value)?.o)[0] ?? "";

/* ------------------------------------------------------------------ a revealed right answer, in words */

/** A revealed question's right answer in words, for a line on its card or on the big screen: the right options of a
 *  choice or a quiz, a number's value with its unit, a typed quiz's accepted answers. "" before staff reveal it, and
 *  for a question that has none (a pin's is a place: it is ringed on the picture). The settings say it once revealed;
 *  the result says it too, and is read when the settings do not. */
export function rightWords(q: { kind: string; config: unknown; reveal: boolean }, locale: string, result?: unknown): string {
  if (!q.reveal) return "";
  const r = obj(result) ?? {};
  if (q.kind === "quiz_text") {
    const accept = quizTextConfig(q.config).accept;
    return (accept.length ? accept : quizTextResult(result).correct).join(" · ");
  }
  if (q.kind === "number") {
    const c = numberConfig(q.config);
    const v = c.correct ?? num(r.correct);
    const unit = askText(locale, c.unit_en, c.unit_ar);
    return v === null ? "" : `${askNum(v, locale, 4)}${unit ? ` ${unit}` : ""}`;
  }
  if (q.kind === "choice" || q.kind === "quiz") {
    const c = q.kind === "quiz" ? quizConfig(q.config) : choiceConfig(q.config);
    const right = c.correct.length ? c.correct : ids(r.correct);
    return c.options.filter((o) => right.includes(o.id)).map((o) => optionText(locale, o)).join(" · ");
  }
  return "";
}
