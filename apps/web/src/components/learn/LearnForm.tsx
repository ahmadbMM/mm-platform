"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { rpc } from "@/lib/rpc-client";
import { AGE, HEARD, HEIGHT, LEVELS, MAX_LEARNERS, WHO, learnPayload, riyadhToday, type Gender, type Heard, type LearnFields, type LearnerFields, type LearnProblem } from "@/lib/learn";
import { monthNames, natOptions, type NatOption } from "@/lib/nationality";
import { useLocalize } from "@/i18n/TxProvider";
import NoticeLink from "@/components/privacy/NoticeLink";
import { T } from "./LearnForm.text";

// The Learn to ride sign-up card (/experiences/learn, right column). Who is learning - one card per
// learner, up to five in one sign-up (the owner, 2026-09-28: a family signs up together): the
// visitor, their child or another adult, each with their age, gender and height (the height picks
// the bike's size) and how much they have ridden - then the details of the person signing up with
// how they heard of us (the owner, 2026-09-28: asked here and on the community form, not at the
// app's sign-up). It goes to the staff page through learn_apply(); it does not ask when suits them -
// the team picks the lessons' date and time and sends it and, for someone new, sets up their
// booking app account - made from what the person gives here, the community form's questions (the
// owner, 2026-09-28): date of birth, gender, nationality, height, Instagram, LinkedIn and
// profession, and the ride news box - and workplace (the owner, 2026-09-29), asked on both forms. A "Me" card asks only the riding so far: the age, gender and
// height are the person's own. Nothing is booked or charged here. The form checks what the database
// checks (lib/learn.ts) and shows one message at a time, about the first thing to fix; a learner's
// names their card and sits in it, and the card is brought into view with the keyboard on it.
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

// A learner's card: what was typed, and a key that stays with the card when one above it goes.
type Card = LearnerFields & { key: number };
type Form = Omit<LearnFields, "learners"> & { learners: Card[] };
type Contact = Omit<Form, "learners">;
const EMPTY: LearnerFields = { who: "", name: "", age: "", gender: "", height: "", level: "" };
// Where the Privacy Notice's name goes in the translated sentence (LearnForm.text.ts, privacy).
const SLOT = "\u0000";
// A range as the box's hint, kept left to right in Arabic and Urdu too ("3–17", never "17–3").
const range = (a: number, b: number) => `⁦${a}–${b}⁩`;
// No store to follow: only whether the page is drawing on the server or in the browser.
const never = () => () => {};
// A typed dash becomes a space, as in every name box on the site (lib/rpc-client.ts, cleanName).
const dashless = (v: string) => v.replace(/[-‐-―]/g, " ");

export default function LearnForm(p: LearnFormProps) {
  const t = useLocalize(T);
  const id = useId();
  const next = useRef(1); // the next card's key
  const [f, setF] = useState<Form>({ learners: [{ key: 0, ...EMPTY }], name: "", birth: "", gender: "", nationality: "", height: "", phone: "", email: "", instagram: "", linkedin: "", profession: "", workplace: "", heard: "", notes: "", privacy: false, news: false });
  // The date of birth as three pickers; the form holds it as YYYY-MM-DD once all three are chosen.
  const [bd, setBd] = useState({ d: "", m: "", y: "" });
  // The names of the months and the countries are the browser's (see lib/nationality.ts): drawn
  // once the page is up, so the server's first draw and the browser's agree.
  const onClient = useSyncExternalStore(never, () => true, () => false);
  const names = useMemo<{ months: string[]; nats: NatOption[] } | null>(() => (onClient ? { months: monthNames(p.locale), nats: natOptions(p.locale) } : null), [onClient, p.locale]);
  const [busy, setBusy] = useState(false);
  // The one message on show; a learner's carries their card's place (from 0).
  const [err, setErr] = useState<{ text: string; index?: number } | null>(null);
  const [done, setDone] = useState(false);
  // Where the keyboard goes once the page has drawn: a new card's first choice, a card with a
  // problem (brought into view), or the add button after a card goes. `n` tells two moves apart.
  const [focus, setFocus] = useState<{ to: string; first?: boolean; n: number } | null>(null);
  const moves = useRef(0);
  const addBtn = useRef<HTMLButtonElement>(null);
  const cardId = (key: number) => `${id}c${key}`;
  // The thank-you card is far shorter than the form it replaces: on a phone it would sit above the
  // screen, the visitor left looking at the footer. It is brought into view.
  const doneBox = useRef<HTMLDivElement>(null);
  useEffect(() => { if (done) doneBox.current?.scrollIntoView({ block: "center" }); }, [done]);
  useEffect(() => {
    if (!focus) return;
    if (focus.to === "add") { addBtn.current?.focus(); return; }
    const card = document.getElementById(focus.to);
    if (!card) return;
    card.scrollIntoView({ block: "center" });
    (focus.first ? card.querySelector<HTMLElement>(".ln-who button:not([disabled])") : card)?.focus({ preventScroll: true });
  }, [focus]);

  const setContact = <K extends keyof Contact>(k: K, v: Contact[K]) => { setF((x) => ({ ...x, [k]: v })); setErr(null); };
  const setBirth = (k: "d" | "m" | "y", v: string) => {
    const n = { ...bd, [k]: v };
    setBd(n);
    setContact("birth", n.y && n.m && n.d ? `${n.y}-${n.m}-${n.d}` : "");
  };
  const thisYear = Number(riyadhToday().slice(0, 4));
  const two = (n: number) => String(n).padStart(2, "0");
  const setLearner = (i: number, patch: Partial<LearnerFields>) => {
    setF((x) => ({ ...x, learners: x.learners.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
    setErr(null);
  };
  function add() {
    if (f.learners.length >= MAX_LEARNERS) return;
    const key = next.current++;
    setF((x) => ({ ...x, learners: [...x.learners, { key, ...EMPTY }] }));
    setErr(null);
    setFocus({ to: cardId(key), first: true, n: ++moves.current });
  }
  function remove(i: number) {
    setF((x) => ({ ...x, learners: x.learners.filter((_, j) => j !== i) }));
    setErr(null);
    setFocus({ to: "add", n: ++moves.current });
  }
  const selfAt = f.learners.findIndex((c) => c.who === "self");
  // Why the height is asked, once: under the first card with its own height, else by the person's.
  const rowAt = f.learners.findIndex((c) => c.who !== "self");
  const anyChild = f.learners.some((c) => c.who === "child");

  // A problem as the visitor reads it. The database answers learner_age and learner_name for every
  // kind of learner, and "learners" for the list; the words follow the kind of learner on the card.
  function show(r: LearnProblem | { error: string; index?: number }) {
    const i = typeof r.index === "number" && Number.isInteger(r.index) && r.index >= 0 && r.index < f.learners.length ? r.index : undefined;
    const who = i === undefined ? "" : f.learners[i].who;
    const e = t.errors;
    const text = r.error === "learner_age" && who === "self" ? e.birth_date
      : r.error === "learner_age" && who === "child" ? e.learner_age_child
      : r.error === "learner_age" && who === "other" ? e.learner_age_other
      : r.error === "learner_name" && who === "other" ? e.learner_name_other
      : r.error === "learners" && i !== undefined ? e.learner_twice
      : e[r.error] || e.generic;
    if (i === undefined) return setErr({ text });
    setErr({ text: t.learnerError(i + 1, text), index: i });
    setFocus({ to: cardId(f.learners[i].key), n: ++moves.current });
  }
  const [before, after] = t.privacy(SLOT).split(SLOT);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErr(null);
    const r = learnPayload(f, p.locale, p.privacyVersion);
    if ("error" in r) return show(r);
    setBusy(true);
    try {
      const res = await rpc<{ ok: boolean; error?: string; index?: number }>("learn_apply", { p: r.payload });
      if (res.ok) setDone(true);
      else show({ error: res.error || "", index: res.index });
    } catch {
      setErr({ text: t.errors.generic });
    }
    setBusy(false);
  }

  if (done) {
    return (
      <div className="ln-card ln-done" role="status" ref={doneBox}>
        <span className="ln-done-mark" aria-hidden="true">✓</span>
        <h2>{p.doneTitle}</h2>
        <p>{p.doneText}</p>
        {/* A new sign-up from the same person: the contact details, how they heard of us and the
            Privacy Notice box stay; the learners start again from one empty card. */}
        <button type="button" className="ln-btn ln-btn-line" onClick={() => { setF((x) => ({ ...x, learners: [{ key: next.current++, ...EMPTY }], notes: "" })); setDone(false); }}>{t.again}</button>
      </div>
    );
  }

  const radio = (on: boolean, pick: () => void, label: string, cls: string, disabled = false) => (
    <button key={label} type="button" role="radio" aria-checked={on} className={cls} onClick={pick} disabled={disabled}>{label}</button>
  );
  const problem = (i?: number) => err && err.index === i && <p className="ln-err" role="alert">{err.text}</p>;
  return (
    <form className="ln-card" onSubmit={send} noValidate>
      <h2>{p.formTitle}</h2>
      <p className="ln-sub">{p.formSub}</p>

      <span className="ln-label">{t.who}</span>
      {f.learners.map((c, i) => {
        const cid = cardId(c.key);
        return (
          <div key={c.key} id={cid} className={`ln-learner${err?.index === i ? " ln-bad" : ""}`} role="group" aria-labelledby={`${cid}h`} tabIndex={-1}>
            <div className="ln-learner-head">
              <h3 id={`${cid}h`}>{t.learner(i + 1)}</h3>
              {f.learners.length > 1 && (
                <button type="button" className="ln-remove" aria-label={t.remove(i + 1)} title={t.remove(i + 1)} onClick={() => remove(i)}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              )}
            </div>
            <div className="ln-who" role="radiogroup" aria-label={t.who}>
              {/* "Me" is one card's at most: taken on another card, it is not offered here. */}
              {WHO.map((w) => radio(c.who === w, () => setLearner(i, { who: w }), t[w], "ln-who-opt", w === "self" && selfAt >= 0 && selfAt !== i))}
            </div>

            {(c.who === "child" || c.who === "other") && (
              <label className="ln-field">
                <span>{c.who === "child" ? t.childName : t.otherName}</span>
                <input className="ln-input" value={c.name} onChange={(e) => setLearner(i, { name: dashless(e.target.value) })} autoComplete="off" maxLength={60} />
                {c.who === "child" && <small className="ln-hint">{t.childNameHint}</small>}
              </label>
            )}
            {c.who === "self" ? <p className="ln-hint ln-hint-row">{t.selfNote}</p> : (
              <>
                <div className="ln-row">
                  <label className="ln-field">
                    <span>{t.age}</span>
                    <input className="ln-input" value={c.age} onChange={(e) => setLearner(i, { age: e.target.value })} inputMode="numeric" maxLength={3} placeholder={range(...AGE)} />
                  </label>
                  <label className="ln-field">
                    <span>{t.height}</span>
                    <input className="ln-input" value={c.height} onChange={(e) => setLearner(i, { height: e.target.value })} inputMode="numeric" maxLength={3} placeholder={range(...HEIGHT)} />
                  </label>
                </div>
                {i === rowAt && <p className="ln-hint ln-hint-row">{t.heightHint}</p>}

                <span className="ln-label" id={`${cid}g`}>{t.gender}</span>
                <div className="ln-pills" role="radiogroup" aria-labelledby={`${cid}g`}>
                  {(["male", "female"] as Gender[]).map((g) => radio(c.gender === g, () => setLearner(i, { gender: g }), t[g], "ln-pill"))}
                </div>
              </>
            )}

            <span className="ln-label" id={`${cid}l`}>{t.level}</span>
            <div className="ln-levels" role="radiogroup" aria-labelledby={`${cid}l`}>
              {LEVELS.map((l) => radio(c.level === l, () => setLearner(i, { level: l }), t[l], "ln-level"))}
            </div>
            {problem(i)}
          </div>
        );
      })}
      {f.learners.length < MAX_LEARNERS && (
        <button type="button" className="ln-add" ref={addBtn} onClick={add}><span aria-hidden="true">+</span> {t.add}</button>
      )}

      <div className="ln-details">
        <span className="ln-label ln-label-h">{t.details}</span>
        {anyChild && <p className="ln-hint">{t.parentHint}</p>}
        <label className="ln-field">
          <span>{t.name}</span>
          <input className="ln-input" value={f.name} onChange={(e) => setContact("name", dashless(e.target.value))} autoComplete="name" maxLength={120} />
        </label>
        <div className="ln-field">
          <span className="ln-label" id={`${id}b`}>{t.birth}</span>
          <div className="ln-dob" role="group" aria-labelledby={`${id}b`}>
            <select className={`ln-input ln-select${bd.d ? "" : " ln-ph"}`} aria-label={t.day} value={bd.d} onChange={(e) => setBirth("d", e.target.value)}>
              <option value="">{t.day}</option>
              {Array.from({ length: 31 }, (_, k) => <option key={k} value={two(k + 1)}>{k + 1}</option>)}
            </select>
            <select className={`ln-input ln-select${bd.m ? "" : " ln-ph"}`} aria-label={t.month} value={bd.m} onChange={(e) => setBirth("m", e.target.value)}>
              <option value="">{t.month}</option>
              {Array.from({ length: 12 }, (_, k) => <option key={k} value={two(k + 1)}>{names ? names.months[k] : two(k + 1)}</option>)}
            </select>
            <select className={`ln-input ln-select${bd.y ? "" : " ln-ph"}`} aria-label={t.year} value={bd.y} onChange={(e) => setBirth("y", e.target.value)}>
              <option value="">{t.year}</option>
              {Array.from({ length: AGE[1] + 1 }, (_, k) => <option key={k} value={String(thisYear - k)}>{thisYear - k}</option>)}
            </select>
          </div>
        </div>
        <span className="ln-label" id={`${id}g`}>{t.gender}</span>
        <div className="ln-pills" role="radiogroup" aria-labelledby={`${id}g`}>
          {(["male", "female"] as Gender[]).map((g) => radio(f.gender === g, () => setContact("gender", g), t[g], "ln-pill"))}
        </div>
        <label className="ln-field">
          <span>{t.nationality}</span>
          <select className={`ln-input ln-select${f.nationality ? "" : " ln-ph"}`} value={f.nationality} onChange={(e) => setContact("nationality", e.target.value)}>
            <option value="">{t.natPick}</option>
            {names?.nats.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label className="ln-field">
          <span>{t.height}</span>
          <input className="ln-input" value={f.height} onChange={(e) => setContact("height", e.target.value)} inputMode="numeric" maxLength={3} placeholder={range(...HEIGHT)} />
          {rowAt < 0 && <small className="ln-hint">{t.heightHint}</small>}
        </label>
        <label className="ln-field">
          <span>{t.phone}</span>
          <input className="ln-input" value={f.phone} onChange={(e) => setContact("phone", e.target.value)} inputMode="tel" autoComplete="tel" dir="ltr" maxLength={20} placeholder="05XXXXXXXX" />
        </label>
        <label className="ln-field">
          <span>{t.email}</span>
          <input className="ln-input" value={f.email} onChange={(e) => setContact("email", e.target.value)} type="email" autoComplete="email" dir="ltr" maxLength={254} />
        </label>
        <label className="ln-field">
          <span>{t.instagram}</span>
          <input className="ln-input" value={f.instagram} onChange={(e) => setContact("instagram", e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} dir="ltr" maxLength={120} placeholder="@username" />
          <small className="ln-hint">{t.instagramHint}</small>
        </label>
        <label className="ln-field">
          <span>{t.linkedin}</span>
          <input className="ln-input" value={f.linkedin} onChange={(e) => setContact("linkedin", e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} dir="ltr" maxLength={200} placeholder="linkedin.com/in/your-name" />
          <small className="ln-hint">{t.linkedinHint}</small>
        </label>
        <label className="ln-field">
          <span>{t.profession}</span>
          <input className="ln-input" value={f.profession} onChange={(e) => setContact("profession", e.target.value)} autoComplete="organization-title" maxLength={80} placeholder={t.professionPh} />
        </label>
        <label className="ln-field">
          <span>{t.workplace}</span>
          <input className="ln-input" value={f.workplace} onChange={(e) => setContact("workplace", e.target.value)} autoComplete="organization" maxLength={120} />
          <small className="ln-hint">{t.workplaceHint}</small>
        </label>
        <label className="ln-field">
          <span>{t.heard}</span>
          <select className={`ln-input ln-select${f.heard ? "" : " ln-ph"}`} value={f.heard} onChange={(e) => setContact("heard", e.target.value as Heard | "")}>
            <option value="">{t.heardPick}</option>
            {HEARD.map((h) => <option key={h} value={h}>{t.heardOpts[h]}</option>)}
          </select>
        </label>
        <label className="ln-field">
          <span>{t.notes}</span>
          <textarea className="ln-input" value={f.notes} onChange={(e) => setContact("notes", e.target.value)} rows={3} maxLength={600} />
        </label>
      </div>

      <label className="ln-check">
        <input type="checkbox" checked={f.privacy} onChange={(e) => setContact("privacy", e.target.checked)} />
        <span>{before}<NoticeLink dialog={p.notice}>{t.privacyLink}</NoticeLink>{after}</span>
      </label>
      <label className="ln-check">
        <input type="checkbox" checked={f.news} onChange={(e) => setContact("news", e.target.checked)} />
        <span>{t.news}</span>
      </label>
      <p className="ln-use">{t.use}</p>

      {problem(undefined)}
      <button type="submit" className="ln-btn ln-btn-green" disabled={busy}>{busy ? t.sending : t.send}</button>
    </form>
  );
}
