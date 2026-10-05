"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { rpcResult } from "@/lib/rpc-client";
import { BOOKING_URL } from "@/lib/links";
import {
  ACCOUNT_HEIGHT, AGE, HEARD, HEIGHT, LEVELS, MAX_LEARNERS, WHO, accountArgs, learnPayload, riyadhToday, signinIdentifier,
  type AccountFields, type Gender, type Heard, type LearnFields, type LearnerFields, type LearnProblem,
} from "@/lib/learn";
import { monthNames, natOptions, type NatOption } from "@/lib/nationality";
import { useLocalize } from "@/i18n/TxProvider";
import NoticeLink from "@/components/privacy/NoticeLink";
import LearnClosed from "./LearnClosed";
import { T } from "./LearnForm.text";

// The Learn to ride sign-up card (/experiences/learn, right column), in two steps (the owner,
// 2026-09-30: "apply the 2 steps registration on learn to ride too and add a question asking if the
// learner has an account or not, if he has skip the sign up procedure"):
//   1. the account. "Do you already have a Micromobility account?" - No: the booking app's own
//      sign-up (first and last name, gender, email, mobile, password twice, height, the Privacy
//      Notice and ride news; customer_exists, customer_signup, customer_consents), after which the
//      card says the account has been created. Yes: sign in with the email or mobile and password
//      (customer_login); an account that signs in with Google or Apple does it on the booking site
//      (?handoff=learn), which sends them back signed in with a one-time code (?code=).
//   2. the lesson: who is learning - one card per learner, up to five (the owner, 2026-09-28: a
//      family signs up together): the visitor, their child or another adult, each with their age,
//      gender and height (the height picks the bike's size) and how much they have ridden - then
//      what the community form asks that the sign-up does not (date of birth, nationality,
//      Instagram, LinkedIn, profession, company, how they heard of us) and a note, prefilled from
//      the account (customer_community_me). It goes to the staff page through
//      customer_learn_apply(), from the account: its name, email, mobile, gender, height and ride
//      news are the account's. It does not ask when suits them - the team picks the lessons' date
//      and time. A "Me" card asks only the riding so far. Nothing is booked or charged here. The
//      form checks what the database checks (lib/learn.ts) and shows one message at a time, about
//      the first thing to fix; a learner's names their card and sits in it, and the card is
//      brought into view with the keyboard on it. The session lives in the page only.
export type LearnFormProps = {
  locale: string;
  formTitle: string; formSub: string;
  doneTitle: string; doneText: string;
  /** What shows in place of the form when the database answers that sign-ups are closed (staff
   *  switched "Taking sign-ups" off after the page was drawn). */
  closedTitle: string; closedText: string;
  /** The Privacy Notice the box confirms (content/privacy-notice.ts). */
  privacyVersion: string;
  /** The id of the page's Privacy Notice dialog (NoticeDialog): the box's link opens it there, so
   *  reading the notice never leaves the form, whatever the site's state. */
  notice: string;
};

// A learner's card: what was typed, and a key that stays with the card when one above it goes.
type Card = LearnerFields & { key: number };
type Form = Omit<LearnFields, "learners"> & { learners: Card[] };
type Details = Omit<Form, "learners">;
type Stage = "ask" | "signup" | "signin" | "loading" | "lesson";
/** The signed-in person: the account step made it (`made`) or they signed in to it. */
type Acct = { id: string; token: string; name: string; email: string; made: boolean };
/** What customer_community_me() answers about the account, for step 2. */
type Me = { name?: string; email?: string; gender?: string | null; height?: number | null; birth_date?: string | null; nationality?: string | null;
  instagram?: string | null; linkedin?: string | null; profession?: string | null; workplace?: string | null; heard_from?: string | null };
const EMPTY: LearnerFields = { who: "", name: "", age: "", gender: "", height: "", level: "" };
const NO_ACCOUNT: AccountFields = { first: "", last: "", gender: "", email: "", phone: "", password: "", password2: "", height: "", privacy: false, news: false };
// Where the Privacy Notice's name goes in the translated sentence (LearnForm.text.ts, privacy).
const SLOT = "\u0000";
// A range as the box's hint, kept left to right in Arabic and Urdu too ("3–17", never "17–3").
const range = (a: number, b: number) => `⁦${a}–${b}⁩`;
// No store to follow: only whether the page is drawing on the server or in the browser.
const never = () => () => {};
// A typed dash becomes a space, as in every name box on the site (lib/rpc-client.ts, cleanName).
const dashless = (v: string) => v.replace(/[-‐-―]/g, " ");
// The booking app's own account ids.
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

export default function LearnForm(p: LearnFormProps) {
  const t = useLocalize(T);
  const id = useId();
  const next = useRef(1); // the next card's key
  const [stage, setStage] = useState<Stage>("ask");
  const [acct, setAcct] = useState<Acct | null>(null);
  const [a, setA] = useState<AccountFields>(NO_ACCOUNT);
  const [si, setSi] = useState({ id: "", password: "" });
  // An account made here whose Privacy Notice and ride-news answers could not be saved yet: the
  // next press of Create account saves only those (the account exists - making it again would only
  // say the email is taken).
  const made = useRef<{ id: string; token: string; name: string; email: string; gender: Gender; height: number } | null>(null);
  // Asked on step 2 only when the account has none (older accounts).
  const [need, setNeed] = useState({ gender: false, height: false });
  const [f, setF] = useState<Form>({ learners: [{ key: 0, ...EMPTY }], birth: "", gender: "", nationality: "", height: "", instagram: "", linkedin: "", profession: "", workplace: "", heard: "", notes: "" });
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
  const [closed, setClosed] = useState(false);
  // Where the keyboard goes once the page has drawn: a new card's first choice, a card with a
  // problem (brought into view), or the add button after a card goes. `n` tells two moves apart.
  const [focus, setFocus] = useState<{ to: string; first?: boolean; n: number } | null>(null);
  const moves = useRef(0);
  const addBtn = useRef<HTMLButtonElement>(null);
  const stepTop = useRef<HTMLDivElement>(null);
  const cardId = (key: number) => `${id}c${key}`;
  // The thank-you card is far shorter than the form it replaces: on a phone it would sit above the
  // screen, the visitor left looking at the footer. It is brought into view.
  const doneBox = useRef<HTMLDivElement>(null);
  useEffect(() => { if (done) doneBox.current?.scrollIntoView({ block: "center" }); }, [done]);
  useEffect(() => {
    if (!focus) return;
    if (focus.to === "add") { addBtn.current?.focus(); return; }
    if (focus.to === "step") { stepTop.current?.scrollIntoView({ block: "start" }); stepTop.current?.focus({ preventScroll: true }); return; }
    const card = document.getElementById(focus.to);
    if (!card) return;
    card.scrollIntoView({ block: "center" });
    (focus.first ? card.querySelector<HTMLElement>(".ln-who button:not([disabled])") : card)?.focus({ preventScroll: true });
  }, [focus]);

  // Step 2 for a signed-in account: what it holds fills the questions it answers already.
  function toLesson(who: Acct, me: Me | null) {
    const g = me?.gender === "male" || me?.gender === "female" ? me.gender : "";
    const h = typeof me?.height === "number" && me.height > 0 ? String(me.height) : "";
    const heard = (HEARD as readonly string[]).includes(me?.heard_from || "") ? (me?.heard_from as Heard) : "";
    const birth = /^\d{4}-\d{2}-\d{2}$/.test(me?.birth_date || "") ? me!.birth_date! : "";
    if (birth) setBd({ y: birth.slice(0, 4), m: birth.slice(5, 7), d: birth.slice(8, 10) });
    setF((x) => ({ ...x, gender: g, height: h, birth: birth || x.birth, nationality: me?.nationality || x.nationality, instagram: me?.instagram || x.instagram,
      linkedin: me?.linkedin || x.linkedin, profession: me?.profession || x.profession, workplace: me?.workplace || x.workplace, heard: heard || x.heard }));
    setNeed({ gender: !g, height: !h });
    setAcct(who);
    setErr(null);
    setStage("lesson");
    setFocus({ to: "step", n: ++moves.current });
  }

  // Arriving from the booking app signed in (?code=, a one-time code: two minutes, one use). It
  // leaves the address at once; the session it trades for stays in this page only.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search), code = q.get("code");
    if (code === null) return;
    q.delete("code");
    window.history.replaceState(null, "", window.location.pathname + (q.toString() ? `?${q}` : "") + window.location.hash);
    (async () => {
      if (!/^[0-9a-f]{48}$/.test(code)) { setErr({ text: t.errors.expired }); setStage("signin"); return; }
      setStage("loading");
      const r = await rpcResult<{ id: string; name: string; session_token: string }[]>("customer_handoff_redeem", { p_code: code });
      const row = "data" in r && Array.isArray(r.data) ? r.data[0] : null;
      if (!row?.id || !row.session_token) { setErr({ text: "error" in r && r.error.network ? t.errors.generic : t.errors.expired }); setStage("signin"); return; }
      const m = await rpcResult<Me>("customer_community_me", { p_id: row.id, p_token: row.session_token });
      const me = "data" in m && m.data && typeof m.data === "object" ? m.data : null;
      toLesson({ id: row.id, token: row.session_token, name: me?.name || row.name, email: me?.email || "", made: false }, me);
    })();
    // Once, on arrival; t is the page's language, which does not change the code's meaning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setAcc = <K extends keyof AccountFields>(k: K, v: AccountFields[K]) => { setA((x) => ({ ...x, [k]: v })); setErr(null); };
  const setContact = <K extends keyof Details>(k: K, v: Details[K]) => { setF((x) => ({ ...x, [k]: v })); setErr(null); };
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

  // Step 1, new: the booking app's sign-up, then straight on to the lesson.
  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErr(null);
    const r = accountArgs(a);
    if ("error" in r) return setErr({ text: t.errors[r.error] || t.errors.generic });
    setBusy(true);
    try {
      if (made.current) return await consent(made.current);
      // Each on its own, so the message says which one is taken (as the sign-up page does).
      const ex = await rpcResult<boolean>("customer_exists", { p_email: r.args.p_email, p_phone: "" });
      if ("data" in ex && ex.data === true) return setErr({ text: t.errors.email_taken });
      const ex2 = await rpcResult<boolean>("customer_exists", { p_email: "", p_phone: r.args.p_phone });
      if ("data" in ex2 && ex2.data === true) return setErr({ text: t.errors.phone_taken });
      const newId = uid();
      const s = await rpcResult<{ id: string; session_token: string }[]>("customer_signup", { p_id: newId, ...r.args });
      if ("error" in s) {
        const m = `${s.error.code || ""} ${s.error.message || ""}`;
        return setErr({ text: /name_short|name_chars/.test(m) ? t.errors.first : /23505|DUPLICATE/i.test(m) ? t.errors.email_taken : /RATE_LIMITED/.test(m) ? t.errors.rate_limited : t.errors.generic });
      }
      const tok = Array.isArray(s.data) ? s.data[0]?.session_token : "";
      if (!tok) return setErr({ text: t.errors.generic });
      await consent({ id: newId, token: tok, name: r.args.p_name, email: r.args.p_email, gender: r.args.p_gender, height: r.args.p_height });
    } finally { setBusy(false); }
  }

  // The notice they confirmed and their ride-news answer, recorded the moment the account exists;
  // the lesson waits until they are (customer_consents answers the record, with ride_news, once saved).
  async function consent(acc: NonNullable<typeof made.current>) {
    const c = await rpcResult<{ ride_news?: unknown }>("customer_consents", { p_id: acc.id, p_token: acc.token, p_privacy: p.privacyVersion, p_ride_news: a.news });
    if (!("data" in c) || !c.data || typeof c.data.ride_news !== "boolean") {
      made.current = acc;
      return setErr({ text: t.errors.consents });
    }
    made.current = null;
    setA((x) => ({ ...x, password: "", password2: "" }));
    toLesson({ id: acc.id, token: acc.token, name: acc.name, email: acc.email, made: true }, { gender: acc.gender, height: acc.height });
  }

  // Step 1, known: sign in with the email or mobile and password.
  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErr(null);
    const ident = signinIdentifier(si.id);
    if (!ident || !si.password) return setErr({ text: t.errors.signin_empty });
    setBusy(true);
    try {
      const r = await rpcResult<{ id: string; name: string; email: string; session_token: string }[]>("customer_login", { p_identifier: ident, p_pwd: si.password });
      if ("error" in r) return setErr({ text: r.error.network ? t.errors.generic : /LOCKED/.test(r.error.message || "") ? t.errors.signin_locked : t.errors.signin_bad });
      const row = Array.isArray(r.data) ? r.data[0] : null;
      if (!row?.id || !row.session_token) return setErr({ text: t.errors.signin_bad });
      const m = await rpcResult<Me>("customer_community_me", { p_id: row.id, p_token: row.session_token });
      const me = "data" in m && m.data && typeof m.data === "object" ? m.data : null;
      setSi({ id: "", password: "" });
      toLesson({ id: row.id, token: row.session_token, name: row.name, email: row.email || "", made: false }, me);
    } finally { setBusy(false); }
  }

  // Step 2: the lesson, from the account.
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !acct) return;
    setErr(null);
    const r = learnPayload(f, p.locale);
    if ("error" in r) return show(r);
    setBusy(true);
    try {
      const res = await rpcResult<{ ok: boolean; error?: string; index?: number }>("customer_learn_apply", { p_id: acct.id, p_token: acct.token, p: r.payload });
      if (!("data" in res) || !res.data) return setErr({ text: t.errors.generic });
      if (res.data.ok) return setDone(true);
      if (res.data.error === "signed_out") { setAcct(null); setStage("signin"); return setErr({ text: t.errors.signed_out }); }
      if (res.data.error === "closed") return setClosed(true);
      show({ error: res.data.error || "", index: res.data.index });
    } finally { setBusy(false); }
  }

  if (closed) return <LearnClosed title={p.closedTitle} text={p.closedText} />;

  if (done) {
    return (
      <div className="ln-card ln-done" role="status" ref={doneBox}>
        <span className="ln-done-mark" aria-hidden="true">✓</span>
        <h2>{p.doneTitle}</h2>
        <p>{p.doneText}</p>
        {/* A new sign-up from the same person, still signed in: their details stay; the learners
            start again from one empty card. */}
        <button type="button" className="ln-btn ln-btn-line" onClick={() => { setF((x) => ({ ...x, learners: [{ key: next.current++, ...EMPTY }], notes: "" })); setDone(false); }}>{t.again}</button>
      </div>
    );
  }

  const radio = (on: boolean, pick: () => void, label: string, cls: string, disabled = false) => (
    <button key={label} type="button" role="radio" aria-checked={on} className={cls} onClick={pick} disabled={disabled}>{label}</button>
  );
  const problem = (i?: number) => err && err.index === i && <p className="ln-err" role="alert">{err.text}</p>;
  const lesson = stage === "lesson";
  const steps = (
    <ol className="ln-steps" aria-label={t.stepsLabel}>
      <li className={lesson ? "done" : "on"} aria-current={lesson ? undefined : "step"}>{t.step1}</li>
      <li className={lesson ? "on" : ""} aria-current={lesson ? "step" : undefined}>{t.step2}</li>
    </ol>
  );
  const back = <button type="button" className="ln-back" onClick={() => { setErr(null); setStage("ask"); }}>{t.back}</button>;
  const head = (
    <>
      <h2>{p.formTitle}</h2>
      <p className="ln-sub">{p.formSub}</p>
      {steps}
    </>
  );

  if (stage === "ask" || stage === "loading") {
    return (
      <div className="ln-card">
        {head}
        {stage === "loading" ? <p className="ln-hint" role="status">{t.loading}</p> : (
          <>
            <span className="ln-label" id={`${id}have`}>{t.haveQ}</span>
            <div className="ln-have" role="radiogroup" aria-labelledby={`${id}have`}>
              {radio(false, () => { setErr(null); setStage("signin"); }, t.haveYes, "ln-who-opt")}
              {radio(false, () => { setErr(null); setStage("signup"); }, t.haveNo, "ln-who-opt")}
            </div>
          </>
        )}
      </div>
    );
  }

  if (stage === "signin") {
    return (
      <form className="ln-card" onSubmit={signIn} noValidate>
        {head}
        <h3 className="ln-step-title">{t.signinTitle}</h3>
        <label className="ln-field">
          <span>{t.identifier}</span>
          <input className="ln-input" value={si.id} onChange={(e) => { setSi((x) => ({ ...x, id: e.target.value })); setErr(null); }} autoComplete="username" autoCapitalize="off" spellCheck={false} dir="ltr" maxLength={254} />
        </label>
        <label className="ln-field">
          <span>{t.password}</span>
          <input className="ln-input" type="password" value={si.password} onChange={(e) => { setSi((x) => ({ ...x, password: e.target.value })); setErr(null); }} autoComplete="current-password" dir="ltr" maxLength={72} />
        </label>
        {problem(undefined)}
        <button type="submit" className="ln-btn ln-btn-green" disabled={busy}>{busy ? t.signingIn : t.signin}</button>
        <p className="ln-hint ln-oauth">{t.oauthAsk} <a href={`${BOOKING_URL}?handoff=learn&lang=${p.locale}`}>{t.oauthLink}</a></p>
        {back}
      </form>
    );
  }

  if (stage === "signup") {
    return (
      <form className="ln-card" onSubmit={createAccount} noValidate>
        {head}
        <h3 className="ln-step-title">{t.createTitle}</h3>
        <p className="ln-hint">{t.createSub}</p>
        <p className="ln-hint">{t.accountFor}</p>
        <div className="ln-row">
          <label className="ln-field">
            <span>{t.first}</span>
            <input className="ln-input" value={a.first} onChange={(e) => setAcc("first", dashless(e.target.value))} autoComplete="given-name" maxLength={60} />
          </label>
          <label className="ln-field">
            <span>{t.last}</span>
            <input className="ln-input" value={a.last} onChange={(e) => setAcc("last", dashless(e.target.value))} autoComplete="family-name" maxLength={60} />
          </label>
        </div>
        <span className="ln-label" id={`${id}ag`}>{t.gender}</span>
        <div className="ln-pills" role="radiogroup" aria-labelledby={`${id}ag`}>
          {(["male", "female"] as Gender[]).map((g) => radio(a.gender === g, () => setAcc("gender", g), t[g], "ln-pill"))}
        </div>
        <label className="ln-field">
          <span>{t.email}</span>
          <input className="ln-input" value={a.email} onChange={(e) => setAcc("email", e.target.value)} type="email" autoComplete="email" dir="ltr" maxLength={254} />
        </label>
        <label className="ln-field">
          <span>{t.phone}</span>
          <input className="ln-input" value={a.phone} onChange={(e) => setAcc("phone", e.target.value)} inputMode="tel" autoComplete="tel" dir="ltr" maxLength={20} placeholder="05XXXXXXXX" />
        </label>
        <label className="ln-field">
          <span>{t.password}</span>
          <input className="ln-input" type="password" value={a.password} onChange={(e) => setAcc("password", e.target.value)} autoComplete="new-password" dir="ltr" maxLength={72} />
          <small className="ln-hint">{t.pwdHint}</small>
        </label>
        <label className="ln-field">
          <span>{t.password2}</span>
          <input className="ln-input" type="password" value={a.password2} onChange={(e) => setAcc("password2", e.target.value)} autoComplete="new-password" dir="ltr" maxLength={72} />
        </label>
        <label className="ln-field">
          <span>{t.height}</span>
          <input className="ln-input" value={a.height} onChange={(e) => setAcc("height", e.target.value)} inputMode="numeric" maxLength={3} placeholder={range(...ACCOUNT_HEIGHT)} />
        </label>
        <label className="ln-check">
          <input type="checkbox" checked={a.privacy} onChange={(e) => setAcc("privacy", e.target.checked)} />
          <span>{before}<NoticeLink dialog={p.notice}>{t.privacyLink}</NoticeLink>{after}</span>
        </label>
        <label className="ln-check">
          <input type="checkbox" checked={a.news} onChange={(e) => setAcc("news", e.target.checked)} />
          <span>{t.news}</span>
        </label>
        {problem(undefined)}
        <button type="submit" className="ln-btn ln-btn-green" disabled={busy}>{busy ? t.creating : t.create}</button>
        {back}
      </form>
    );
  }

  return (
    <form className="ln-card" onSubmit={send} noValidate>
      {head}
      <div ref={stepTop} tabIndex={-1} className="ln-step-top">
        {acct?.made ? (
          <div className="ln-made" role="status">
            <span className="ln-made-mark" aria-hidden="true">✓</span>
            <span><b>{t.madeTitle}</b><span>{t.madeText}</span></span>
          </div>
        ) : acct ? <p className="ln-who-am">{t.signedAs(acct.name)}{acct.email ? ` · ⁦${acct.email}⁩` : ""}</p> : null}
      </div>

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
        {need.gender && (
          <>
            <span className="ln-label" id={`${id}g`}>{t.gender}</span>
            <div className="ln-pills" role="radiogroup" aria-labelledby={`${id}g`}>
              {(["male", "female"] as Gender[]).map((g) => radio(f.gender === g, () => setContact("gender", g), t[g], "ln-pill"))}
            </div>
          </>
        )}
        <label className="ln-field">
          <span>{t.nationality}</span>
          <select className={`ln-input ln-select${f.nationality ? "" : " ln-ph"}`} value={f.nationality} onChange={(e) => setContact("nationality", e.target.value)}>
            <option value="">{t.natPick}</option>
            {names?.nats.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        {need.height && (
          <label className="ln-field">
            <span>{t.height}</span>
            <input className="ln-input" value={f.height} onChange={(e) => setContact("height", e.target.value)} inputMode="numeric" maxLength={3} placeholder={range(...HEIGHT)} />
            {rowAt < 0 && <small className="ln-hint">{t.heightHint}</small>}
          </label>
        )}
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
      <p className="ln-use">{t.use}</p>

      {problem(undefined)}
      <button type="submit" className="ln-btn ln-btn-green" disabled={busy}>{busy ? t.sending : t.send}</button>
    </form>
  );
}
