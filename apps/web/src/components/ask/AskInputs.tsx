"use client";

import { useRef, useState } from "react";
import {
  charCount, choiceConfig, latinDigits, numberConfig, optionText, optionsOf, pointsConfig, scalesConfig, sentMarks, sentNumber, sentOrder, sentPicks,
  shapeChoice, shapeNumber, shapePoints, shapeRanking, shapeScales, shapeWritten, askText, writtenConfig,
  type AnswerState, type AskMine, type AskQuestion, type Shaped,
} from "@/lib/ask";
import type { AskWords } from "./Ask.text";
import { IconDown, IconMinus, IconPlus, IconUp } from "./icons";

// Where a question is answered, one form a kind (lib/ask.ts shapes and checks the value; the database checks it
// again). A form whose answer is already in ("done", or the question stopped taking answers) shows that answer,
// locked, with no button. A button that cannot be pressed yet stays silent: nothing on these forms explains itself.
export type InputProps = {
  q: AskQuestion; locale: string; t: AskWords; busy: boolean; labelId: string;
  /** "open", "change" (sending again replaces the answer), "done" or "shut" (the answer, locked). */
  state: AnswerState;
  /** The viewer's own answer to this question, when they gave one. */
  sent: AskMine | null;
  /** Sends the value; true once the database took it. */
  onSubmit: (shaped: Shaped) => Promise<boolean>;
};
const isLocked = (state: AnswerState) => state === "done" || state === "shut";

/** A written answer (cloud, open, qa): one box with what is left of its length, and Send. Enter sends; once sent the
 *  box is empty again with the keyboard still in it. The one line this page says about itself is here: whose name
 *  goes with an answer. */
export function WrittenInput({ q, t, busy, labelId, onSubmit }: InputProps) {
  const c = writtenConfig(q.kind, q.config);
  const [text, setText] = useState("");
  const box = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const left = c.maxLen - charCount(text);
  const long = c.maxLen > 80;
  async function send() {
    if (busy) return;
    const sent = text;
    // sent: the box is empty again - unless more was typed while the answer was on its way, which stays
    if (await onSubmit(shapeWritten(q.kind, q.config, sent))) setText((now) => (now === sent ? "" : now));
    box.current?.focus();
  }
  const field = {
    className: "ask-input", value: text, dir: "auto" as const, maxLength: c.maxLen, autoComplete: "off", enterKeyHint: "send" as const,
    placeholder: q.kind === "qa" ? t.yourQuestion : t.yourAnswer, "aria-labelledby": labelId, "aria-describedby": `${labelId}-left`,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setText(e.target.value),
  };
  return (
    <form className="ask-write" onSubmit={(e) => { e.preventDefault(); send(); }} noValidate>
      <div className="ask-write-row">
        <div className="ask-field">
          {long
            ? <textarea ref={box} {...field} rows={2} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} />
            : <input ref={box} {...field} type="text" />}
          <span id={`${labelId}-left`} className={`ask-left${left <= 5 ? " low" : ""}`}><span aria-hidden="true">{left}</span><span className="mm-sr">{t.left(left)}</span></span>
        </div>
        <button type="submit" className="ask-btn" disabled={busy}>{busy ? t.sending : t.send}</button>
      </div>
      <p className="ask-private">{t.privacy}</p>
    </form>
  );
}

/** Multiple choice: the options as large buttons - one of them (radio buttons) or up to `max_picks` (checkboxes). */
export function ChoiceInput({ q, locale, t, busy, labelId, state, sent, onSubmit }: InputProps) {
  const c = choiceConfig(q.config);
  const was = sentPicks(sent?.value);
  const [picks, setPicks] = useState<string[]>(was);
  const locked = isLocked(state);
  const single = c.maxPicks === 1;
  const toggle = (id: string) => setPicks((p) => (single ? [id] : p.includes(id) ? p.filter((x) => x !== id) : p.length < c.maxPicks ? [...p, id] : p));
  const same = picks.length === was.length && picks.every((id) => was.includes(id));
  return (
    <form className="ask-form" onSubmit={(e) => { e.preventDefault(); if (!busy && !locked) onSubmit(shapeChoice(q.config, picks)); }} noValidate>
      <fieldset className="ask-opts" aria-labelledby={labelId} disabled={locked || busy} role={single ? "radiogroup" : "group"}>
        {c.options.map((o) => {
          const on = picks.includes(o.id);
          return (
            <label key={o.id} className={`ask-opt${on ? " on" : ""}${single ? "" : " many"}`}>
              <input type={single ? "radio" : "checkbox"} name={`ask-${q.id}`} checked={on} disabled={!single && !on && picks.length >= c.maxPicks} onChange={() => toggle(o.id)} />
              <span className="ask-opt-mark" aria-hidden="true" />
              <span dir="auto">{optionText(locale, o)}</span>
            </label>
          );
        })}
      </fieldset>
      {!locked && <button type="submit" className="ask-btn" disabled={busy || !picks.length || (state === "change" && same)}>{busy ? t.sending : t.send}</button>}
    </form>
  );
}

/** Scales: for each statement a row of marks from the lowest to the highest, their meanings at the two ends. */
export function ScalesInput({ q, locale, t, busy, state, sent, onSubmit }: InputProps) {
  const c = scalesConfig(q.config);
  const [marks, setMarks] = useState<Record<string, number>>(() => sentMarks(sent?.value, "s"));
  const locked = isLocked(state);
  const values = Array.from({ length: c.max - c.min + 1 }, (_, i) => c.min + i);
  const lo = askText(locale, c.lo_en, c.lo_ar), hi = askText(locale, c.hi_en, c.hi_ar);
  const set = (id: string, v: number | null) => setMarks((m) => { const next = { ...m }; if (v === null) delete next[id]; else next[id] = v; return next; });
  return (
    <form className="ask-form" onSubmit={(e) => { e.preventDefault(); if (!busy && !locked) onSubmit(shapeScales(q.config, marks)); }} noValidate>
      {c.options.map((o) => (
        <fieldset key={o.id} className="ask-scale" disabled={locked || busy}>
          <legend dir="auto">{optionText(locale, o)}</legend>
          <div className="ask-marks">
            {values.map((v) => (
              <label key={v} className={`ask-mark${marks[o.id] === v ? " on" : ""}`}>
                {/* a mark tapped again is taken off, where a statement may be left out */}
                <input type="radio" name={`ask-${q.id}-${o.id}`} checked={marks[o.id] === v} onChange={() => set(o.id, v)} onClick={() => { if (c.skip && marks[o.id] === v) set(o.id, null); }} />
                <span className="mm-lat">{v}</span>
              </label>
            ))}
          </div>
          {(lo || hi) && <div className="ask-ends" aria-hidden="true"><span dir="auto">{lo}</span><span dir="auto">{hi}</span></div>}
        </fieldset>
      ))}
      {!locked && <button type="submit" className="ask-btn" disabled={busy || !shapeScales(q.config, marks).ok}>{busy ? t.sending : t.send}</button>}
    </form>
  );
}

/** Ranking: the options in a list, each moved up or down with its two buttons; the best first. */
export function RankingInput({ q, locale, t, busy, labelId, state, sent, onSubmit }: InputProps) {
  const options = optionsOf(q.config);
  const [order, setOrder] = useState<string[]>(() => {
    const was = sentOrder(sent?.value);
    return shapeRanking(q.config, was).ok ? was : options.map((o) => o.id);
  });
  const [moved, setMoved] = useState("");
  const locked = isLocked(state);
  const name = (id: string) => { const o = options.find((x) => x.id === id); return o ? optionText(locale, o) : ""; };
  function move(i: number, by: 1 | -1) {
    const j = i + by;
    if (locked || busy || j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
    setMoved(`${name(order[i])} ${j + 1}`);
  }
  return (
    <form className="ask-form" onSubmit={(e) => { e.preventDefault(); if (!busy && !locked) onSubmit(shapeRanking(q.config, order)); }} noValidate>
      <ol className="ask-rank" aria-labelledby={labelId}>
        {order.map((id, i) => (
          <li key={id} className="ask-rank-row">
            <span className="ask-rank-no mm-lat" aria-hidden="true">{i + 1}</span>
            <span className="ask-rank-name" dir="auto">{name(id)}</span>
            {!locked && (
              <span className="ask-rank-btns">
                <button type="button" className="ask-icon-btn" aria-label={t.up(name(id))} aria-disabled={i === 0 || busy} onClick={() => move(i, -1)}><IconUp /></button>
                <button type="button" className="ask-icon-btn" aria-label={t.down(name(id))} aria-disabled={i === order.length - 1 || busy} onClick={() => move(i, 1)}><IconDown /></button>
              </span>
            )}
          </li>
        ))}
      </ol>
      <p className="mm-sr" role="status">{moved}</p>
      {!locked && <button type="submit" className="ask-btn" disabled={busy}>{busy ? t.sending : t.send}</button>}
    </form>
  );
}

/** Points: so many to share between the options - a field each with less and more beside it, and how many are left.
 *  A button that can do no more is marked so and does nothing, but keeps the keyboard: pressed to its end, the next
 *  press of Tab still starts from it. */
export function PointsInput({ q, locale, t, busy, state, sent, onSubmit }: InputProps) {
  const c = pointsConfig(q.config);
  const [points, setPoints] = useState<Record<string, number>>(() => sentMarks(sent?.value, "p"));
  const locked = isLocked(state);
  const used = c.options.reduce((a, o) => a + (points[o.id] || 0), 0);
  const left = c.total - used;
  const step = Math.max(1, Math.round(c.total / 20));
  // never more than is left to give
  const set = (id: string, n: number) => setPoints((p) => {
    const others = c.options.reduce((a, o) => a + (o.id === id ? 0 : p[o.id] || 0), 0);
    return { ...p, [id]: Math.max(0, Math.min(Math.floor(n) || 0, c.total - others)) };
  });
  return (
    <form className="ask-form" onSubmit={(e) => { e.preventDefault(); if (!busy && !locked) onSubmit(shapePoints(q.config, points)); }} noValidate>
      <ul className="ask-points">
        {c.options.map((o) => {
          const label = optionText(locale, o), n = points[o.id] || 0;
          return (
            <li key={o.id} className="ask-points-row">
              <span className="ask-points-name" dir="auto" id={`ask-${q.id}-${o.id}`}>{label}</span>
              <span className="ask-stepper">
                {!locked && <button type="button" className="ask-icon-btn" aria-label={t.fewer(label)} aria-disabled={busy || n <= 0} onClick={() => { if (!busy && n > 0) set(o.id, n - step); }}><IconMinus /></button>}
                <input className="ask-points-box mm-lat" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" value={String(n)} disabled={locked || busy} aria-labelledby={`ask-${q.id}-${o.id}`}
                  onFocus={(e) => e.target.select()} onChange={(e) => set(o.id, Number(latinDigits(e.target.value).replace(/\D/g, "").slice(0, 4)))} />
                {!locked && <button type="button" className="ask-icon-btn" aria-label={t.more(label)} aria-disabled={busy || left <= 0} onClick={() => { if (!busy && left > 0) set(o.id, n + step); }}><IconPlus /></button>}
              </span>
            </li>
          );
        })}
      </ul>
      {!locked && (
        <div className="ask-send-row">
          <p className="ask-points-left" role="status">{t.pointsLeft(left)}</p>
          <button type="submit" className="ask-btn" disabled={busy || used < 1 || used > c.total}>{busy ? t.sending : t.send}</button>
        </div>
      )}
    </form>
  );
}

/** A number: one field for a number from min to max on the question's step, with its unit. */
export function NumberInput({ q, locale, t, busy, labelId, state, sent, onSubmit }: InputProps) {
  const c = numberConfig(q.config);
  const [text, setText] = useState(() => { const n = sentNumber(sent?.value); return n === null ? "" : String(n); });
  const locked = isLocked(state);
  const unit = askText(locale, c.unit_en, c.unit_ar);
  const whole = Number.isInteger(c.step) && Number.isInteger(c.min);
  return (
    <form className="ask-form" onSubmit={(e) => { e.preventDefault(); if (!busy && !locked) onSubmit(shapeNumber(q.config, text)); }} noValidate>
      <div className="ask-number">
        <input className="ask-input ask-number-box mm-lat" type="text" inputMode={c.min < 0 ? "text" : whole ? "numeric" : "decimal"} autoComplete="off" value={text} disabled={locked || busy} aria-labelledby={labelId}
          placeholder={`${c.min} - ${c.max}`} maxLength={16} onChange={(e) => setText(latinDigits(e.target.value))} />
        {unit && <span className="ask-unit" dir="auto">{unit}</span>}
        {!locked && <button type="submit" className="ask-btn" disabled={busy || !shapeNumber(q.config, text).ok}>{busy ? t.sending : t.send}</button>}
      </div>
    </form>
  );
}

/** A kind's form, or nothing for a kind that takes no answer here. */
export function AnswerForm(p: InputProps) {
  switch (p.q.kind) {
    case "cloud": case "open": case "qa": return <WrittenInput {...p} />;
    case "choice": return <ChoiceInput {...p} />;
    case "scales": return <ScalesInput {...p} />;
    case "ranking": return <RankingInput {...p} />;
    case "points": return <PointsInput {...p} />;
    case "number": return <NumberInput {...p} />;
    default: return null;
  }
}
