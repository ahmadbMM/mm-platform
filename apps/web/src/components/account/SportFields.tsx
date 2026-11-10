"use client";

import "./emergency.css";
import "./sport.css";
import { useEffect, useRef } from "react";
import { SPORT_GROUPS, SP_OTHER, spClean, spGroupName, spName, type SportAnswer, type SportOption } from "@/lib/sport";
import type { SportWords } from "./Sport.words";

// The sport question's answer, as the booking app asks it (_spQHtml, 2026-11-10): Yes and No, and after a yes what they
// compete in - the ones picked as chips, each with its remove button, and a list that adds one more: the user's ten
// groups, then the sports staff added to the list ("More sports", when there are any), then Other on its own line (the
// ones picked are not offered again). Other picked opens a box for their own (the user, the same day: "add an option
// called other that opens a text field to allow them to write their choice"). The pop-up (SportGate) and My Account's
// card (SportCard) hold the answer; this draws it. After an add or a remove the list keeps the keyboard, so several can
// be picked in a row; picking Other gives the box the keyboard. Its list and box are emergency.css's (eg-input).
export default function SportFields({ value, onChange, onNo, w, locale, id, labelledBy, added, disabled, problem }: {
  value: SportAnswer; onChange: (v: SportAnswer) => void;
  /** No was picked (the pop-up saves it at once). */
  onNo?: () => void;
  w: SportWords; locale: string; id: string; labelledBy: string;
  /** The sports staff added to the list (sport_option_list). */
  added: readonly SportOption[];
  disabled?: boolean;
  /** Which part the error under the fields is about (marks the list or the box). */
  problem?: "feds" | "other" | null;
}) {
  const list = useRef<HTMLSelectElement>(null);
  const box = useRef<HTMLInputElement>(null);
  const focus = useRef<"list" | "box" | null>(null);
  useEffect(() => {
    const f = focus.current;
    if (!f) return;
    focus.current = null;
    (f === "box" ? box.current : list.current)?.focus({ preventScroll: true });
  });
  const on = new Set(value.feds);
  const name = (c: string) => (c === SP_OTHER ? w.other : spName(c, locale, added));
  const pick = (yes: boolean) => {
    onChange({ competes: yes, feds: yes ? value.feds : [], other: yes ? value.other : "" });
    if (yes) focus.current = "list";
    else onNo?.();
  };
  const add = (code: string) => {
    if (!code) return;
    focus.current = code === SP_OTHER ? "box" : "list";
    onChange({ ...value, competes: true, feds: spClean([...value.feds, code], added) });
  };
  const drop = (code: string) => {
    focus.current = "list";
    onChange({ ...value, competes: true, feds: value.feds.filter((c) => c !== code), other: code === SP_OTHER ? "" : value.other });
  };
  const addedLeft = added.filter((o) => !on.has(o.code));

  return (
    <div className="sp-fields">
      <div className="sp-yn" role="group" aria-labelledby={labelledBy}>
        <button type="button" aria-pressed={value.competes === true} disabled={disabled} onClick={() => pick(true)}>{w.yes}</button>
        <button type="button" aria-pressed={value.competes === false} disabled={disabled} onClick={() => pick(false)}>{w.no}</button>
      </div>
      {value.competes === true && (
        <div className="sp-feds">
          <label className="sp-feds-lbl" htmlFor={`${id}-add`}>{w.fedsLabel}</label>
          {value.feds.length > 0 && (
            <ul className="sp-chips">
              {value.feds.map((c) => (
                <li key={c} className="sp-chip">
                  <span>{name(c)}</span>
                  <button type="button" className="sp-x" aria-label={w.remove.replace("{0}", name(c))} disabled={disabled} onClick={() => drop(c)}>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <select ref={list} id={`${id}-add`} className="eg-input eg-ph sp-add" value="" disabled={disabled}
            aria-invalid={problem === "feds" ? true : undefined} onChange={(e) => add(e.target.value)}>
            <option value="">{w.add}</option>
            {SPORT_GROUPS.map((g) => {
              const left = g[2].filter((f) => !on.has(f[0]));
              return left.length ? (
                <optgroup key={g[0]} label={spGroupName(g, locale)}>
                  {left.map((f) => <option key={f[0]} value={f[0]}>{spName(f[0], locale)}</option>)}
                </optgroup>
              ) : null;
            })}
            {addedLeft.length > 0 && (
              <optgroup label={w.added}>
                {addedLeft.map((o) => <option key={o.code} value={o.code}>{spName(o.code, locale, added)}</option>)}
              </optgroup>
            )}
            {!on.has(SP_OTHER) && <option value={SP_OTHER}>{w.other}</option>}
          </select>
          {on.has(SP_OTHER) && (
            <div className="eg-field sp-other">
              <label htmlFor={`${id}-other`}>{w.otherLabel}</label>
              <input ref={box} id={`${id}-other`} className="eg-input" type="text" maxLength={60} autoComplete="off" value={value.other} disabled={disabled}
                aria-invalid={problem === "other" ? true : undefined} onChange={(e) => onChange({ ...value, other: e.target.value })} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
