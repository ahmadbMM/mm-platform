"use client";

import "./emergency.css";
import { useId, useMemo, useState, useSyncExternalStore } from "react";
import { useTxLocale } from "@/i18n/TxProvider";
import { EM_FIELD, EM_RELS, dialOptions, emBlank, type EmError, type EmFields, type EmRel } from "@/lib/emergency";
import { emergencyWords, type EmergencyWords } from "./Emergency.words";

// The emergency contact's boxes (lib/emergency.ts), in the booking app's order and words: the
// contact's name, their mobile number (a dial code, Saudi Arabia first, and the number) and how they
// are related; then "Add a second contact", which opens the optional second one (all three boxes or
// none). Used by the learn form's two steps and the account's check-up (EmergencyGate), each in its
// own look (`look`: the class names). The problem on show sits under its box.
export type EmLook = { block: string; head: string; sub: string; field: string; input: string; select: string; ph: string; err: string; add: string; opt: string };
export type EmProblem = { error: EmError; which: 1 | 2 } | null;

/** A problem as the rider reads it. */
export function emMessage(w: EmergencyWords, e: EmError): string {
  return e === "em_name" ? w.errName : e === "name_chars" ? w.errNameChars : e === "name_short" ? w.errNameShort
    : e === "em_phone" ? w.errPhone : e === "em_self" ? w.errSelf : e === "em_same" ? w.errSame : w.errRelation;
}

const never = () => () => {};

export default function EmergencyFields({ one, two, onChange, offerTwo, problem, look, head = true }: {
  one: EmFields; two: EmFields;
  onChange: (one: EmFields, two: EmFields) => void;
  /** Whether the database takes a second contact (an older one answers three columns). */
  offerTwo: boolean;
  problem: EmProblem;
  look: EmLook;
  /** The block's own title and line (the check-up has its own). */
  head?: boolean;
}) {
  const locale = useTxLocale();
  const w = emergencyWords(locale);
  const id = useId();
  // The country names are the browser's (lib/emergency.ts dialOptions): drawn once the page is up.
  const onClient = useSyncExternalStore(never, () => true, () => false);
  const dials = useMemo(() => (onClient ? dialOptions(locale) : [{ value: "+966", label: "+966" }]), [onClient, locale]);
  const [open, setOpen] = useState(() => !emBlank(two));
  const showTwo = offerTwo && (open || !emBlank(two));

  const fields = (which: 1 | 2) => {
    const v = which === 1 ? one : two;
    const set = (patch: Partial<EmFields>) => (which === 1 ? onChange({ ...one, ...patch }, two) : onChange(one, { ...two, ...patch }));
    const p = `${id}e${which}`;
    const bad = problem && problem.which === which ? problem.error : null;
    const at = bad ? EM_FIELD[bad] : null;
    const err = (k: "name" | "phone" | "rel") => at === k && bad ? <p className={look.err} role="alert" id={`${p}${k}-err`}>{emMessage(w, bad)}</p> : null;
    const described = (k: "name" | "phone" | "rel") => (at === k ? `${p}${k}-err` : undefined);
    return (
      <>
        <label className={look.field}>
          <span>{w.name}</span>
          <input className={look.input} value={v.name} maxLength={80} autoComplete="off" autoCapitalize="words" data-em={`${which}-name`}
            aria-invalid={at === "name" || undefined} aria-describedby={described("name")}
            onChange={(e) => set({ name: e.target.value.replace(/[-‐-―−]/g, " ") })} />
          {err("name")}
        </label>
        <div className={look.field}>
          <label htmlFor={`${p}phone`}>{w.phone}</label>
          <div className="em-phone" dir="ltr">
            <select className={`${look.select} em-cc`} aria-label={w.dialCode} value={v.cc} data-em={`${which}-cc`} onChange={(e) => set({ cc: e.target.value })}>
              {dials.map((o, i) => <option key={`${i}-${o.value}`} value={o.value}>{o.label}</option>)}
            </select>
            <input id={`${p}phone`} className={look.input} value={v.phone} inputMode="tel" autoComplete="off" maxLength={20} data-em={`${which}-phone`}
              placeholder={v.cc === "+966" ? "5X XXX XXXX" : ""} aria-invalid={at === "phone" || undefined} aria-describedby={described("phone")}
              onChange={(e) => set({ phone: e.target.value })} />
          </div>
          {err("phone")}
        </div>
        <label className={look.field}>
          <span>{w.relation}</span>
          <select className={`${look.select}${v.rel ? "" : ` ${look.ph}`}`} value={v.rel} data-em={`${which}-rel`}
            aria-invalid={at === "rel" || undefined} aria-describedby={described("rel")}
            onChange={(e) => set({ rel: e.target.value as EmRel | "" })}>
            <option value="">{w.pick}</option>
            {EM_RELS.map((r) => <option key={r} value={r}>{w.rel[r]}</option>)}
          </select>
          {err("rel")}
        </label>
      </>
    );
  };

  return (
    <div className={look.block}>
      {head && (
        <>
          <p className={look.head}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
            </svg>
            <span>{w.title}</span>
          </p>
          <p className={look.sub}>{w.sub}</p>
        </>
      )}
      {fields(1)}
      {offerTwo && !showTwo && (
        <button type="button" className={look.add} data-em="add2" onClick={() => setOpen(true)}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          <span>{w.add2}</span>
        </button>
      )}
      {showTwo && (
        <div className="em-two" role="group" aria-labelledby={`${id}t2`}>
          <p className={look.head} id={`${id}t2`}><span>{w.title2}</span> <span className={look.opt}>({w.optional})</span></p>
          <p className={look.sub}>{w.sub2}</p>
          {fields(2)}
        </div>
      )}
    </div>
  );
}
