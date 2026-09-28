"use client";

import { useEffect, useId, useRef, useState } from "react";
import { rpc } from "@/lib/rpc-client";
import { AGES, HEARD, HEIGHT, LEVELS, learnPayload, type ForWhom, type Gender, type Heard, type LearnFields } from "@/lib/learn";
import { useLocalize } from "@/i18n/TxProvider";
import NoticeLink from "@/components/privacy/NoticeLink";
import { T } from "./LearnForm.text";

// The Learn to ride sign-up card (/experiences/learn, right column). Who is learning - the visitor
// or their child - with the learner's age, gender and height (the height picks the bike's size),
// how much they have ridden, and the details of the person signing up (a child's parent) with how they
// heard of us (the owner, 2026-09-28: asked here and on the community form, not at the app's sign-up). It goes
// to the staff page through learn_apply(); it does not ask when suits them - the team picks the
// lesson's date and time and sends it and, for someone new, sets up their booking app account. Nothing
// is booked or charged here. The form checks what the database checks (lib/learn.ts) and shows one
// message at a time, about the first thing to fix.
export type LearnFormProps = {
  locale: string;
  formTitle: string; formSub: string;
  doneTitle: string; doneText: string;
  /** The Privacy Notice the box confirms (content/privacy-notice.ts). */
  privacyVersion: string;
  /** The id of the page's Privacy Notice dialog (NoticeDialog): the box's link opens it there, so
   *  reading the notice never leaves the form, whatever the site's state. */
  notice: string;
};

// What a new learner starts from: "Sign up someone else" keeps the contact details, how they heard
// of us and the Privacy Notice box, and clears the rest.
const LEARNER = { forWhom: "", learnerName: "", age: "", gender: "", height: "", level: "", notes: "" } as const;
const BLANK: LearnFields = { ...LEARNER, name: "", phone: "", email: "", heard: "", privacy: false };
// Where the Privacy Notice's name goes in the translated sentence (LearnForm.text.ts, privacy).
const SLOT = "\u0000";
// A range as the box's hint, kept left to right in Arabic and Urdu too ("3–17", never "17–3").
const range = (a: number, b: number) => `\u2066${a}–${b}\u2069`;

export default function LearnForm(p: LearnFormProps) {
  const t = useLocalize(T);
  const id = useId();
  const [f, setF] = useState<LearnFields>(BLANK);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  // The thank-you card is far shorter than the form it replaces: on a phone it would sit above the
  // screen, the visitor left looking at the footer. It is brought into view.
  const doneBox = useRef<HTMLDivElement>(null);
  useEffect(() => { if (done) doneBox.current?.scrollIntoView({ block: "center" }); }, [done]);
  const set = <K extends keyof LearnFields>(k: K, v: LearnFields[K]) => { setF((x) => ({ ...x, [k]: v })); setErr(""); };
  const child = f.forWhom === "child";
  // The database answers learner_age for both kinds of learner; the message names the right range.
  const message = (code: string) => (code === "learner_age" && child ? t.errors.learner_age_child : t.errors[code] || t.errors.generic);
  const [before, after] = t.privacy(SLOT).split(SLOT);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErr("");
    const r = learnPayload(f, p.locale, p.privacyVersion);
    if ("error" in r) return setErr(message(r.error));
    setBusy(true);
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("learn_apply", { p: r.payload });
      if (res.ok) setDone(true);
      else setErr(message(res.error || ""));
    } catch {
      setErr(t.errors.generic);
    }
    setBusy(false);
  }

  if (done) {
    return (
      <div className="ln-card ln-done" role="status" ref={doneBox}>
        <span className="ln-done-mark" aria-hidden="true">✓</span>
        <h2>{p.doneTitle}</h2>
        <p>{p.doneText}</p>
        <button type="button" className="ln-btn ln-btn-line" onClick={() => { setF((x) => ({ ...x, ...LEARNER })); setDone(false); }}>{t.again}</button>
      </div>
    );
  }

  const radio = (on: boolean, pick: () => void, label: string, cls: string) => (
    <button key={label} type="button" role="radio" aria-checked={on} className={cls} onClick={pick}>{label}</button>
  );
  return (
    <form className="ln-card" onSubmit={send} noValidate>
      <h2>{p.formTitle}</h2>
      <p className="ln-sub">{p.formSub}</p>

      <span className="ln-label" id={`${id}who`}>{t.who}</span>
      <div className="ln-who" role="radiogroup" aria-labelledby={`${id}who`}>
        {(["self", "child"] as ForWhom[]).map((w) => radio(f.forWhom === w, () => set("forWhom", w), t[w], "ln-who-opt"))}
      </div>

      {child && (
        <label className="ln-field">
          <span>{t.childName}</span>
          <input className="ln-input" value={f.learnerName} onChange={(e) => set("learnerName", e.target.value.replace(/[-‐-―]/g, " "))} autoComplete="off" maxLength={60} />
          <small className="ln-hint">{t.childNameHint}</small>
        </label>
      )}
      <div className="ln-row">
        <label className="ln-field">
          <span>{t.age}</span>
          <input className="ln-input" value={f.age} onChange={(e) => set("age", e.target.value)} inputMode="numeric" maxLength={3} placeholder={child ? range(...AGES.child) : range(...AGES.self)} />
        </label>
        <label className="ln-field">
          <span>{t.height}</span>
          <input className="ln-input" value={f.height} onChange={(e) => set("height", e.target.value)} inputMode="numeric" maxLength={3} placeholder={range(...HEIGHT)} />
        </label>
      </div>
      <p className="ln-hint ln-hint-row">{t.heightHint}</p>

      <span className="ln-label" id={`${id}gender`}>{t.gender}</span>
      <div className="ln-pills" role="radiogroup" aria-labelledby={`${id}gender`}>
        {(["male", "female"] as Gender[]).map((g) => radio(f.gender === g, () => set("gender", g), t[g], "ln-pill"))}
      </div>

      <span className="ln-label" id={`${id}level`}>{t.level}</span>
      <div className="ln-levels" role="radiogroup" aria-labelledby={`${id}level`}>
        {LEVELS.map((l) => radio(f.level === l, () => set("level", l), t[l], "ln-level"))}
      </div>

      <div className="ln-details">
        <span className="ln-label ln-label-h">{t.details}</span>
        {child && <p className="ln-hint">{t.parentHint}</p>}
        <label className="ln-field">
          <span>{t.name}</span>
          <input className="ln-input" value={f.name} onChange={(e) => set("name", e.target.value.replace(/[-‐-―]/g, " "))} autoComplete="name" maxLength={120} />
        </label>
        <label className="ln-field">
          <span>{t.phone}</span>
          <input className="ln-input" value={f.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" autoComplete="tel" dir="ltr" maxLength={20} placeholder="05XXXXXXXX" />
        </label>
        <label className="ln-field">
          <span>{t.email}</span>
          <input className="ln-input" value={f.email} onChange={(e) => set("email", e.target.value)} type="email" autoComplete="email" dir="ltr" maxLength={254} />
        </label>
        <label className="ln-field">
          <span>{t.heard}</span>
          <select className={`ln-input ln-select${f.heard ? "" : " ln-ph"}`} value={f.heard} onChange={(e) => set("heard", e.target.value as Heard | "")}>
            <option value="">{t.heardPick}</option>
            {HEARD.map((h) => <option key={h} value={h}>{t.heardOpts[h]}</option>)}
          </select>
        </label>
        <label className="ln-field">
          <span>{t.notes}</span>
          <textarea className="ln-input" value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={3} maxLength={600} />
        </label>
      </div>

      <label className="ln-check">
        <input type="checkbox" checked={f.privacy} onChange={(e) => set("privacy", e.target.checked)} />
        <span>{before}<NoticeLink dialog={p.notice}>{t.privacyLink}</NoticeLink>{after}</span>
      </label>
      <p className="ln-use">{t.use}</p>

      {err && <p className="ln-err" role="alert">{err}</p>}
      <button type="submit" className="ln-btn ln-btn-green" disabled={busy}>{busy ? t.sending : t.send}</button>
    </form>
  );
}
