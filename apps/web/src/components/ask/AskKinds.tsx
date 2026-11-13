"use client";

import { useRef, useState } from "react";
import { localeInfo } from "@/i18n/locales";
import { askNum, askText, charCount, optionText, type AnswerState } from "@/lib/ask";
import {
  FORM_TEXT_MAX, GRID_STEP, axisName, formFields, gridAt, gridConfig, gridSnap, pinAt, pinMove, quizConfig, quizTextConfig, sentForm, sentGrid, sentPin, sentQuiz,
  shapeForm, shapeGrid, shapePin, shapeQuiz, shapeQuizText, type GridMarks, type Pin, type PinTarget,
} from "@/lib/ask-kinds";
import { askImage } from "@/lib/ask-look";
import { ownRight } from "@/lib/ask-pace";
import type { InputProps } from "./AskInputs";
import { IconCheck } from "./icons";

// Where the five kinds of stage 2 are answered (contract H6; lib/ask-kinds.ts shapes and checks each value, the
// database checks it again). As on the other forms, an answer already in is shown back, locked, and a button that
// cannot be pressed yet stays silent.
//   grid       every item is a numbered marker on a square - dragged by touch or mouse - and two sliders, which are
//              the keyboard's and the screen reader's way to the same two values
//   pin        a tap or click on the picture drops the pin, a drag moves it, the arrow keys move it by 1% (Shift: 5%)
//   form       the fields in order, the required ones said so in words, one Send; then "Sent"
//   quiz       the options as large buttons: a tap IS the answer (the clock is running), and it cannot be changed;
//              "Answer sent" until staff reveal the question, then the right option, theirs marked, and their points
//   quiz_text  one box, one answer; the same after it
const isLocked = (state: AnswerState) => state === "done" || state === "shut";

/** Under a quiz question's answer: "Answer sent" until staff reveal it, then whether it was right and its points.
 *  With no answer once the clock has run out: that time is up. Nothing tells right from wrong before the reveal. */
function QuizOwn({ q, sent, late, locale, t }: Pick<InputProps, "q" | "sent" | "late" | "locale" | "t">) {
  if (!sent) return late ? <p className="ask-own" role="status">{t.errors.late}</p> : null;
  const right = ownRight(q, sent.score);
  if (right === null) return <p className="ask-own" role="status">{t.answerSent}</p>;
  return (
    <p className="ask-own" role="status">
      <span className={`ask-chip ${right ? "ask-chip-done" : "ask-chip-no"}`}>{right ? t.right : t.wrong}</span>
      <b>{t.points(askNum(sent.score ?? 0, locale, 0))}</b>
    </p>
  );
}

/** A quiz: the options as large buttons. One tap sends that option; there is no changing it. */
export function QuizInput({ q, locale, t, busy, labelId, state, sent, onSubmit, late = false }: InputProps) {
  const c = quizConfig(q.config);
  const picked = sentQuiz(sent?.value);
  const [going, setGoing] = useState("");
  const locked = isLocked(state) || late || busy || !!picked || !!going;
  return (
    <div className="ask-form">
      <div className="ask-quiz" role="group" aria-labelledby={labelId}>
        {c.options.map((o) => {
          const mine = picked === o.id || going === o.id;
          const right = q.reveal && c.correct.includes(o.id);
          return (
            <button key={o.id} type="button" className={`ask-qopt${mine ? " on" : ""}${right ? " right" : q.reveal && mine ? " wrong" : ""}`} disabled={locked} aria-pressed={mine}
              onClick={async () => { setGoing(o.id); await onSubmit(shapeQuiz(q.config, o.id)); setGoing(""); }}>
              <span className="ask-qopt-text" dir="auto">{optionText(locale, o)}</span>
              {right && <span className="ask-right"><IconCheck size={14} /><span className="mm-sr">{t.correct}</span></span>}
              {mine && <span className="ask-chip">{t.yourAnswer}</span>}
            </button>
          );
        })}
      </div>
      <QuizOwn q={q} sent={sent} late={late} locale={locale} t={t} />
    </div>
  );
}

/** A typed quiz: one box, one answer, Enter sends. */
export function QuizTextInput({ q, locale, t, busy, labelId, state, sent, onSubmit, late = false }: InputProps) {
  const c = quizTextConfig(q.config);
  const [text, setText] = useState(sent?.body ?? "");
  const locked = isLocked(state) || late || !!sent;
  const left = c.maxLen - charCount(text);
  return (
    <form className="ask-form" onSubmit={(e) => { e.preventDefault(); if (!busy && !locked) onSubmit(shapeQuizText(q.config, text)); }} noValidate>
      <div className="ask-write-row">
        <div className="ask-field">
          <input className="ask-input" type="text" value={text} dir="auto" maxLength={c.maxLen} autoComplete="off" enterKeyHint="send" placeholder={t.yourAnswer} aria-labelledby={labelId}
            disabled={locked || busy} onChange={(e) => setText(e.target.value)} />
          {!locked && <span className={`ask-left${left <= 5 ? " low" : ""}`}><span aria-hidden="true">{left}</span><span className="mm-sr">{t.left(left)}</span></span>}
        </div>
        {!locked && <button type="submit" className="ask-btn" disabled={busy || !shapeQuizText(q.config, text).ok}>{busy ? t.sending : t.send}</button>}
      </div>
      <QuizOwn q={q} sent={sent} late={late} locale={locale} t={t} />
    </form>
  );
}

/** A short form: text, number and choice fields in the order staff wrote them, one Send. */
export function FormInput({ q, locale, t, busy, state, sent, onSubmit }: InputProps) {
  const fields = formFields(q.config);
  const [values, setValues] = useState<Record<string, string>>(() => sentForm(sent?.value));
  const locked = isLocked(state);
  const set = (id: string, v: string) => setValues((m) => ({ ...m, [id]: v }));
  return (
    <form className="ask-form" onSubmit={(e) => { e.preventDefault(); if (!busy && !locked) onSubmit(shapeForm(q.config, values)); }} noValidate>
      {fields.map((f) => {
        const id = `ask-f-${q.id}-${f.id}`;
        const label = <><span dir="auto">{askText(locale, f.en, f.ar)}</span>{f.required && <span className="ask-req">{t.required}</span>}</>;
        if (f.type === "choice") {
          return (
            <fieldset key={f.id} className="ask-ff" disabled={locked || busy}>
              <legend>{label}</legend>
              <div className="ask-opts">
                {f.options.map((o) => {
                  const on = values[f.id] === o.id;
                  return (
                    <label key={o.id} className={`ask-opt${on ? " on" : ""}`}>
                      {/* an option tapped again is taken off, where the field may be left empty */}
                      <input type="radio" name={id} checked={on} required={f.required} onChange={() => set(f.id, o.id)} onClick={() => { if (!f.required && on) set(f.id, ""); }} />
                      <span className="ask-opt-mark" aria-hidden="true" />
                      <span dir="auto">{optionText(locale, o)}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        }
        return (
          <div key={f.id} className="ask-ff">
            <label htmlFor={id}>{label}</label>
            <input id={id} className={`ask-input${f.type === "number" ? " mm-lat" : ""}`} type="text" inputMode={f.type === "number" ? "decimal" : undefined} dir={f.type === "number" ? undefined : "auto"} autoComplete="off"
              maxLength={f.type === "number" ? 24 : FORM_TEXT_MAX} value={values[f.id] ?? ""} required={f.required} disabled={locked || busy} onChange={(e) => set(f.id, e.target.value)} />
          </div>
        );
      })}
      {locked
        ? sent && <p className="ask-own" role="status">{t.sent}</p>
        : <button type="submit" className="ask-btn" disabled={busy || !shapeForm(q.config, values).ok}>{busy ? t.sending : t.send}</button>}
    </form>
  );
}

/** A grid: every item placed on a square between two named axes, each from 0 to the scale's top. */
export function GridInput({ q, locale, t, busy, state, sent, onSubmit }: InputProps) {
  const c = gridConfig(q.config);
  const [marks, setMarks] = useState<GridMarks>(() => sentGrid(sent?.value));
  const done = isLocked(state), locked = done || busy;
  const board = useRef<HTMLDivElement>(null);
  const rtl = localeInfo(locale).dir === "rtl";
  const xName = axisName(locale, c, "x") || t.axisX, yName = axisName(locale, c, "y") || t.axisY;
  const mid = c.max / 2, count = c.options.length;
  const place = (id: string, x: number, y: number) => setMarks((m) => ({ ...m, [id]: [gridSnap(x, c.max), gridSnap(y, c.max)] }));
  const drag = (id: string, e: React.PointerEvent<HTMLElement>) => {
    const r = board.current?.getBoundingClientRect();
    if (!r || !r.width || !r.height) return;
    const [x, y] = gridAt((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, c.max, rtl);
    place(id, x, y);
  };
  return (
    <form className="ask-form" onSubmit={(e) => { e.preventDefault(); if (!locked) onSubmit(shapeGrid(q.config, marks)); }} noValidate>
      <div className="ask-grid" aria-hidden="true">
        <span className="ask-grid-y" dir="auto">{yName}</span>
        <div className="ask-grid-board"><div ref={board} className="ask-grid-area">
          {c.options.map((o, i) => {
            const m = marks[o.id];
            // an item not placed yet waits near the middle, the items fanned out so each can be picked up
            const turn = (2 * Math.PI * i) / Math.max(1, count) - Math.PI / 2, out = count > 1 ? 0.12 : 0;
            const fx = m ? m[0] / c.max : 0.5 + out * Math.cos(turn), fy = m ? m[1] / c.max : 0.5 - out * Math.sin(turn);
            return (
              <span key={o.id} className={`ask-grid-mark${m ? " set" : ""}${locked ? " still" : ""}`} style={{ insetInlineStart: `${fx * 100}%`, bottom: `${fy * 100}%` }}
                onPointerDown={locked ? undefined : (e) => { e.currentTarget.setPointerCapture(e.pointerId); drag(o.id, e); }}
                onPointerMove={locked ? undefined : (e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) drag(o.id, e); }}>
                <span className="mm-lat">{i + 1}</span>
              </span>
            );
          })}
        </div></div>
        <span className="ask-grid-x" dir="auto">{xName}</span>
      </div>
      <ol className="ask-grid-items">
        {c.options.map((o, i) => {
          const m = marks[o.id];
          const name = optionText(locale, o);
          return (
            <li key={o.id}>
              <span className="ask-grid-name"><span className={`ask-grid-no${m ? " set" : ""}`} aria-hidden="true">{i + 1}</span><span dir="auto">{name}</span></span>
              {(["x", "y"] as const).map((axis) => {
                const v = m ? m[axis === "x" ? 0 : 1] : mid;
                const axisLabel = axis === "x" ? xName : yName;
                const setAxis = (nv: number) => place(o.id, axis === "x" ? nv : m ? m[0] : mid, axis === "y" ? nv : m ? m[1] : mid);
                return (
                  <label key={axis} className="ask-grid-slide">
                    <span dir="auto">{axisLabel}</span>
                    {/* a slider touched or keyed where it stands places the item there: the middle is a place too */}
                    <input type="range" min={0} max={c.max} step={GRID_STEP} value={v} disabled={locked} aria-label={`${name}: ${axisLabel}`}
                      onChange={(e) => setAxis(Number(e.target.value))} onPointerDown={() => { if (!m) setAxis(v); }}
                      onKeyDown={(e) => { if (!m && /^(Arrow|Home|End|Page)/.test(e.key)) setAxis(v); }} />
                    <span className="ask-grid-v mm-lat" aria-hidden="true">{m ? askNum(v, locale) : ""}</span>
                  </label>
                );
              })}
            </li>
          );
        })}
      </ol>
      {!done && <button type="submit" className="ask-btn" disabled={busy || !shapeGrid(q.config, marks).ok}>{busy ? t.sending : t.send}</button>}
    </form>
  );
}

/** A pin on the question's picture. `target`: the right area, ringed once staff reveal it. */
export function PinInput({ q, t, busy, labelId, state, sent, onSubmit, target = null }: InputProps & { target?: PinTarget | null }) {
  const image = askImage(q.image, 1280);
  const [pin, setPin] = useState<Pin | null>(() => sentPin(sent?.value));
  const done = isLocked(state), locked = done || busy;
  const area = useRef<HTMLButtonElement>(null);
  const at = (e: { clientX: number; clientY: number }): Pin | null => {
    const r = area.current?.getBoundingClientRect();
    return r && r.width && r.height ? pinAt((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height) : null;
  };
  if (!image) return null;
  const noteId = `${labelId}-pin`;
  return (
    <form className="ask-form" onSubmit={(e) => { e.preventDefault(); if (!locked) onSubmit(shapePin(pin)); }} noValidate>
      <div className="ask-pin">
        <img src={image} alt="" decoding="async" />
        {/* the whole picture is one control: a click drops the pin where it fell; from the keyboard the arrows move it */}
        <button ref={area} type="button" className="ask-pin-area" aria-labelledby={labelId} aria-describedby={pin ? noteId : undefined} disabled={locked}
          onClick={(e) => { const p = e.detail > 0 ? at(e) : pin ?? { x: 0.5, y: 0.5 }; if (p) setPin(p); }}
          onKeyDown={(e) => { const next = pinMove(pin, e.key, e.shiftKey); if (next) { e.preventDefault(); setPin(next); } }} />
        {target && <span className="ask-pin-ring" aria-hidden="true" style={{ left: `${target.x * 100}%`, top: `${target.y * 100}%`, width: `${target.r * 200}%` }} />}
        {pin && (
          <span className={`ask-pin-mark${locked ? " still" : ""}`} aria-hidden="true" style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
            onPointerDown={locked ? undefined : (e) => { e.currentTarget.setPointerCapture(e.pointerId); }}
            onPointerMove={locked ? undefined : (e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) { const p = at(e); if (p) setPin(p); } }} />
        )}
      </div>
      {pin && <span id={noteId} className="mm-sr">{t.pinAt(Math.round(pin.x * 100), Math.round(pin.y * 100))}</span>}
      {!done && <button type="submit" className="ask-btn" disabled={busy || !pin}>{busy ? t.sending : t.send}</button>}
    </form>
  );
}
