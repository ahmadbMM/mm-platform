"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { normalizePhone, rpcResult } from "@/lib/rpc-client";
import {
  ACCOUNT_HEIGHT, AGE, HEARD, HEIGHT, LEVELS, MAX_LEARNERS, WHO, accountArgs, accountNameOk, learnPayload, noticeDue, passwordOldRuleMiss, riyadhToday, signinIdentifier,
  type AccountFields, type Gender, type Heard, type LearnFields, type LearnerFields, type LearnPayload, type LearnProblem,
} from "@/lib/learn";
import { monthNames, natOptions, type NatOption } from "@/lib/nationality";
import { useLocalize } from "@/i18n/TxProvider";
import NoticeLink from "@/components/privacy/NoticeLink";
import ChangePassword, { type PwdLook } from "@/components/account/ChangePassword";
import PasswordBox from "@/components/account/PasswordBox";
import Turnstile, { TURNSTILE_SITE_KEY } from "@/components/account/Turnstile";
import EmergencyFields, { type EmLook, type EmProblem } from "@/components/account/EmergencyFields";
import { EM_EMPTY, emAbsent, emReadBoth, emRefusal, emState, type EmContact, type EmFields } from "@/lib/emergency";
import { accountPlan, sameAsHeld } from "@/lib/account-step";
import { emergencyWords } from "@/components/account/Emergency.words";
import LearnClosed from "./LearnClosed";
import { AR_F, T } from "./LearnForm.text";
import { ArrowIcon, TickIcon } from "@/components/site/Icons";

// The Learn to ride sign-up card (/experiences/learn, right column), in two steps (the owner,
// 2026-09-30: "apply the 2 steps registration on learn to ride too and add a question asking if the
// learner has an account or not, if he has skip the sign up procedure"):
//   1. the account. "Do you already have a Micromobility account?" - No: the booking app's own
//      sign-up (first and last name, gender, email, mobile, password with show/hide, height, the Privacy
//      Notice and ride news; customer_exists, customer_signup, customer_consents), after which the
//      card says the account has been created. Yes: sign in with the email or mobile and password,
//      through the site's own sign-in (api/account: its tries a minute and its Turnstile check,
//      the session handed back to this page only, no cookie), which first has a temporary password
//      staff issued replaced (ChangePassword). No Google or Apple sign-in (the owner, 2026-11-09);
//      a one-time code from the booking app (?code=) still signs the page in. A signed-in account
//      with no Privacy Notice on record (or an older one than riders must confirm) confirms it on
//      step 2.
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
// The person signing up gives an emergency contact (the owner, 2026-10-07: required on every sign-up
// and form, a second one optional; lib/emergency.ts): the new account's step asks it with the
// sign-up and saves it the moment the account exists (customer_set_emergency, then
// customer_set_emergency2 for a second), and a signed-in account without one (customer_emergency)
// gives it on step 2, saved before the lesson is sent. A contact the database refuses after the
// account is made is asked again on step 2; a database without those functions asks nothing.
export type LearnFormProps = {
  locale: string;
  formTitle: string; formSub: string;
  doneTitle: string; doneText: string;
  /** What shows in place of the form when the database answers that sign-ups are closed (staff
   *  switched "Taking sign-ups" off after the page was drawn). */
  closedTitle: string; closedText: string;
  /** The Privacy Notice the box confirms (content/privacy-notice.ts). */
  privacyVersion: string;
  /** The last version riders must confirm (PRIVACY_ASK_FROM): a signed-in account with none on
   *  record, or an older one, confirms the notice on step 2. */
  privacyAskFrom: string;
  /** The id of the page's Privacy Notice dialog (NoticeDialog): the box's link opens it there, so
   *  reading the notice never leaves the form, whatever the site's state. */
  notice: string;
};

// A learner's card: what was typed, and a key that stays with the card when one above it goes.
type Card = LearnerFields & { key: number };
type Form = Omit<LearnFields, "learners"> & { learners: Card[] };
type Details = Omit<Form, "learners">;
type Stage = "ask" | "signup" | "signin" | "pwd" | "loading" | "lesson";
/** The signed-in person: the account step made it (`made`) or they signed in to it. */
type Acct = { id: string; token: string; name: string; email: string; phone: string; made: boolean };
/** What customer_community_me() answers about the account, for step 2. */
type Me = { name?: string; email?: string; phone?: string | null; whatsapp_same?: boolean | null; whatsapp?: string | null; gender?: string | null; height?: number | null; birth_date?: string | null; nationality?: string | null;
  instagram?: string | null; linkedin?: string | null; profession?: string | null; workplace?: string | null; heard_from?: string | null;
  flags?: string[] | null };
// The questions a signed-in account is not asked again when it answers them already, unless staff flagged them
// (the owner, 2026-10-25: the same rule as the community form, lib/account-step.ts): customer_community_me's names.
const KNOWN = ["whatsapp", "birth_date", "nationality", "instagram", "linkedin", "profession", "workplace", "heard_from"] as const;
type Known = (typeof KNOWN)[number];
// A problem on step 2 that names one of them brings it back into view.
const KNOWN_OF: Record<string, Known> = { whatsapp: "whatsapp", birth_date: "birth_date", birth_young: "birth_date", nationality: "nationality",
  instagram: "instagram", linkedin: "linkedin", profession: "profession", workplace: "workplace", heard_from: "heard_from" };
// The box a problem on the lesson step is about (a learner's, with the message's index, or the person's): it is
// marked invalid and described by the message, so a screen reader names the field with the problem (WCAG 3.3.1).
const FIELD_OF: Record<string, string> = { learner_who: "who", learner_name: "name", learner_age: "age", learner_height: "height", learner_gender: "gender",
  level: "level", whatsapp: "whatsapp", birth_date: "birth", birth_young: "birth", gender: "gender", nationality: "nationality", height: "height",
  instagram: "instagram", linkedin: "linkedin", profession: "profession", workplace: "workplace", heard_from: "heard", notes: "notes" };
const EMPTY: LearnerFields = { who: "", name: "", age: "", gender: "", height: "", level: "" };
const NO_ACCOUNT: AccountFields = { first: "", last: "", gender: "", email: "", phone: "", password: "", height: "", privacy: false, news: false };
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
// The emergency contact's boxes, in this card's look.
const EM_LOOK: EmLook = { block: "ln-em", head: "ln-em-h", sub: "ln-hint ln-em-sub", field: "ln-field", input: "ln-input", select: "ln-input ln-select", ph: "ln-ph", err: "ln-err", add: "ln-add ln-em-add", opt: "ln-em-opt" };
// Choosing their own password after a temporary one, in this card's look.
const PWD_LOOK: PwdLook = { h: "h3", form: "ln-pc", title: "ln-step-title", sub: "ln-hint ln-pc-sub", field: "ln-field", input: "ln-input", hint: "ln-hint", err: "ln-err", btn: "ln-btn ln-btn-green", back: "ln-back" };

export default function LearnForm(p: LearnFormProps) {
  const t0 = useLocalize(T);
  const id = useId();
  const next = useRef(1); // the next card's key
  const [stage, setStage] = useState<Stage>("ask");
  const [acct, setAcct] = useState<Acct | null>(null);
  const [a, setA] = useState<AccountFields>(NO_ACCOUNT);
  const [si, setSi] = useState({ id: "", password: "" });
  // The sign-in's Turnstile check (once its keys are set), one token a try.
  const [check, setCheck] = useState("");
  const [again, setAgain] = useState(0);
  const onToken = useCallback((tok: string) => setCheck(tok), []);
  // An account made here whose Privacy Notice and ride-news answers could not be saved yet: the
  // next press of Create account saves only those (the account exists - making it again would only
  // say the email is taken).
  const made = useRef<{ id: string; token: string; name: string; email: string; phone: string; gender: Gender; height: number } | null>(null);
  // The emergency contact: the two contacts as typed, the problem on show (under its box), whether
  // step 2 asks for it (a signed-in account without one, or one the account step could not save) and
  // whether the database takes a second one.
  const [em1, setEm1] = useState<EmFields>(EM_EMPTY);
  const [em2, setEm2] = useState<EmFields>(EM_EMPTY);
  const [emErr, setEmErr] = useState<EmProblem>(null);
  const [emNeed, setEmNeed] = useState(false);
  const [emTwo, setEmTwo] = useState(true);
  const emBox = useRef<HTMLDivElement>(null);
  // The contact was saved on step 2 this time: the sign-up says so, and the flag staff put on it goes (customer_learn_apply).
  const emSaved = useRef(false);
  // Asked on step 2 only when the account has none (older accounts): gender, height, and the
  // Privacy Notice (none on record, or one older than riders must confirm), with its box's tick.
  const [need, setNeed] = useState({ gender: false, height: false, privacy: false });
  // What step 2 leaves out for a signed-in account (it holds the answer), and what staff flagged on it.
  const [skip, setSkip] = useState<Known[]>([]);
  const [flagged, setFlagged] = useState<string[]>([]);
  // Every field staff flagged on the account (customer_community_me's flags) and what it holds for them, in
  // sameAsHeld's names: a flagged question takes another answer (the owner, 2026-11-09).
  const fixed = useRef<string[]>([]);
  const held = useRef<Record<string, unknown>>({});
  const [ack, setAck] = useState(false);
  const ackBox = useRef<HTMLInputElement>(null);
  const [f, setF] = useState<Form>({ learners: [{ key: 0, ...EMPTY }], birth: "", gender: "", nationality: "", height: "", instagram: "", linkedin: "", profession: "", workplace: "", heard: "", notes: "", waSame: "", whatsapp: "" });
  // The date of birth as three pickers; the form holds it as YYYY-MM-DD once all three are chosen.
  const [bd, setBd] = useState({ d: "", m: "", y: "" });
  // The Arabic speaks to no one gender until the person's own is known (neutral wording), then to a woman in the
  // feminine (2026-11-10: nearly every learner is a woman; AR_F): her answer on the sign-up, or her account's.
  const fem = p.locale === "ar" && (stage === "lesson" ? f.gender : a.gender) === "female";
  const t = useMemo(() => (fem ? { ...t0, ...AR_F, errors: { ...t0.errors, ...AR_F.errors } } : t0), [t0, fem]);
  // The names of the months and the countries are the browser's (see lib/nationality.ts): drawn
  // once the page is up, so the server's first draw and the browser's agree.
  const onClient = useSyncExternalStore(never, () => true, () => false);
  const names = useMemo<{ months: string[]; nats: NatOption[] } | null>(() => (onClient ? { months: monthNames(p.locale), nats: natOptions(p.locale, t.palestine) } : null), [onClient, p.locale, t.palestine]);
  const [busy, setBusy] = useState(false);
  // The one message on show; a learner's carries their card's place (from 0), and `field` names the box it is about.
  const [err, setErr] = useState<{ text: string; index?: number; field?: string } | null>(null);
  const errId = `${id}err`;
  // The box the message is about: marked invalid and described by the message (WCAG 3.3.1).
  const bad = (field: string, index?: number) => (err && err.field === field && err.index === index ? { "aria-invalid": true as const, "aria-describedby": errId } : {});
  // A step's heading, which takes the keyboard when the step opens (the fields it brings are read from there).
  const stageTop = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (stage !== "signin" && stage !== "signup") return;
    stageTop.current?.focus({ preventScroll: true });
    stageTop.current?.scrollIntoView({ block: "nearest" });
  }, [stage]);
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
    if (focus.to === "ack") { ackBox.current?.scrollIntoView({ block: "center" }); ackBox.current?.focus({ preventScroll: true }); return; }
    if (focus.to === "em") {
      const box = emBox.current;
      const el = box?.querySelector<HTMLElement>("[aria-invalid='true']") || box?.querySelector<HTMLElement>("input");
      el?.scrollIntoView({ block: "center" }); el?.focus({ preventScroll: true });
      return;
    }
    if (focus.to === "step") { stepTop.current?.scrollIntoView({ block: "start" }); stepTop.current?.focus({ preventScroll: true }); return; }
    const card = document.getElementById(focus.to);
    if (!card) return;
    card.scrollIntoView({ block: "center" });
    (focus.first ? card.querySelector<HTMLElement>(".ln-who input:not([disabled])") : card)?.focus({ preventScroll: true });
  }, [focus]);

  // Step 2 for a signed-in account: what it holds fills the questions it answers already. `due`:
  // the account still has to confirm the Privacy Notice (null: not known - the database says so if
  // it does, and the box is shown then).
  // The account's mobile, which the WhatsApp question names.
  const [mobile, setMobile] = useState("");
  function toLesson(who: Acct, me: Me | null, due: boolean | null = false, em: { need: boolean; two: boolean } = { need: false, two: true }) {
    setMobile(me?.phone || (who.made ? normalizePhone(a.phone) : ""));
    const waSame = me?.whatsapp_same === true ? "yes" : me?.whatsapp_same === false ? "no" : "";
    const g = me?.gender === "male" || me?.gender === "female" ? me.gender : "";
    // a height the form would refuse (an old row, a typo: 6, 300) is asked again, or step 2 could never be sent
    const h = typeof me?.height === "number" && me.height >= HEIGHT[0] && me.height <= HEIGHT[1] ? String(me.height) : "";
    const heard = (HEARD as readonly string[]).includes(me?.heard_from || "") ? (me?.heard_from as Heard) : "";
    const birth = /^\d{4}-\d{2}-\d{2}$/.test(me?.birth_date || "") ? me!.birth_date! : "";
    if (birth) setBd({ y: birth.slice(0, 4), m: birth.slice(5, 7), d: birth.slice(8, 10) });
    setF((x) => ({ ...x, gender: g, height: h, birth: birth || x.birth, nationality: me?.nationality || x.nationality, instagram: me?.instagram || x.instagram,
      linkedin: me?.linkedin || x.linkedin, profession: me?.profession || x.profession, workplace: me?.workplace || x.workplace, heard: heard || x.heard,
      waSame: waSame || x.waSame, whatsapp: me?.whatsapp || x.whatsapp }));
    // Signed in (not made here): what the account holds is not asked again, unless staff flagged it.
    const plan = who.made ? null : accountPlan(me, [...KNOWN]);
    const fl = me && Array.isArray(me.flags) ? me.flags.map(String) : [];
    setSkip(plan ? (plan.skip as Known[]) : []);
    setFlagged(plan ? plan.flagged : []);
    fixed.current = who.made ? [] : fl;
    held.current = { ...(me ?? {}) };
    setNeed({ gender: !g, height: !h || (!who.made && fl.includes("height")), privacy: due === true });
    setEmNeed(em.need || (!who.made && fl.includes("emergency")));
    emSaved.current = false;
    setEmTwo(em.two);
    setAck(false);
    setAcct(who);
    setErr(null);
    setStage("lesson");
    setFocus({ to: "step", n: ++moves.current });
  }

  // A signed-in account (a sign-in, the booking app's hand-over, a temporary password replaced):
  // what it holds (customer_community_me), and whether it has confirmed the Privacy Notice
  // (customer_consents, asked only to read), then step 2.
  async function enter(id: string, token: string, name: string, email: string) {
    const [m, c, e] = await Promise.all([
      rpcResult<Me>("customer_community_me", { p_id: id, p_token: token }),
      rpcResult<{ privacy_version?: unknown } | null>("customer_consents", { p_id: id, p_token: token }),
      rpcResult<unknown[]>("customer_emergency", { p_id: id, p_token: token }),
    ]);
    const me = "data" in m && m.data && typeof m.data === "object" ? m.data : null;
    const due = "data" in c && c.data && typeof c.data === "object" ? noticeDue(c.data.privacy_version, p.privacyAskFrom) : null;
    // The emergency contact on the account: asked on step 2 when there is none; a database without
    // customer_emergency asks nothing, and one that cannot be read asks (saving it is harmless).
    const st = "data" in e ? emState(Array.isArray(e.data) ? e.data[0] : null) : null;
    const em = st ? { need: !st.has, two: st.two } : { need: !("error" in e && emAbsent(e.error)), two: true };
    toLesson({ id, token, name: me?.name || name, email: me?.email || email, phone: me?.phone || "", made: false }, me, due, em);
    // the contacts the account holds, which a flagged one is checked against
    const row = "data" in e && Array.isArray(e.data) && e.data[0] && typeof e.data[0] === "object" ? (e.data[0] as Record<string, unknown>) : null;
    const contact = (n: string) => (row ? { name: row[`${n}_name`], phone: row[`${n}_phone`], relation: row[`${n}_relation`] } : null);
    held.current = { ...held.current, emergency: contact("emergency"), emergency2: contact("emergency2") };
  }

  // The emergency contact saved on the account: true, or what to show. A database without
  // customer_set_emergency lets the rider through; without customer_set_emergency2, the second
  // contact is left out.
  async function saveEm(who: { id: string; token: string }, first: EmContact, second: EmContact | null): Promise<true | { problem: NonNullable<EmProblem> } | { text: string; signedOut?: boolean }> {
    const calls: [string, EmContact, 1 | 2][] = [["customer_set_emergency", first, 1]];
    if (second && emTwo) calls.push(["customer_set_emergency2", second, 2]);
    for (const [fn, x, which] of calls) {
      const r = await rpcResult<boolean>(fn, { p_id: who.id, p_token: who.token, p_name: x.name, p_phone: x.phone, p_relation: x.rel });
      if ("error" in r) {
        if (emAbsent(r.error)) { if (which === 1) return true; continue; }
        const bad = emRefusal(r.error);
        if (bad) return { problem: { error: bad, which } };
        return { text: /RATE_LIMITED/.test(r.error.message || "") ? t.errors.rate_limited : t.errors.generic };
      }
      if (r.data === false) return { text: t.errors.signed_out, signedOut: true };
    }
    return true;
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
      await enter(row.id, row.session_token, row.name || "", "");
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
  const onEm = (a: EmFields, b: EmFields) => { setEm1(a); setEm2(b); setEmErr(null); setErr(null); };
  // The problem shown, and the box brought into view with the keyboard on it.
  const emShow = (pr: NonNullable<EmProblem>) => { setEmErr(pr); setFocus({ to: "em", n: ++moves.current }); };
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
    const k = KNOWN_OF[r.error];
    if (k && skip.includes(k)) setSkip((x) => x.filter((y) => y !== k)); // a saved answer that no longer passes: asked again
    const i = typeof r.index === "number" && Number.isInteger(r.index) && r.index >= 0 && r.index < f.learners.length ? r.index : undefined;
    const who = i === undefined ? "" : f.learners[i].who;
    const e = t.errors;
    const text = r.error === "learner_age" && who === "self" ? e.birth_date
      : r.error === "learner_age" && who === "child" ? e.learner_age_child
      : r.error === "learner_age" && who === "other" ? e.learner_age_other
      : r.error === "learner_name" && who === "other" ? e.learner_name_other
      : r.error === "learners" && i !== undefined ? e.learner_twice
      : e[r.error] || e.generic;
    const field = FIELD_OF[r.error];
    if (i === undefined) return setErr({ text, field });
    setErr({ text: t.learnerError(i + 1, text), index: i, field });
    setFocus({ to: cardId(f.learners[i].key), n: ++moves.current });
  }
  const [before, after] = t.privacy(SLOT).split(SLOT);

  // Step 1, new: the booking app's sign-up, then straight on to the lesson.
  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErr(null);
    const r = accountArgs(a);
    if ("error" in r) return setErr({ text: t.errors[r.error] || t.errors.generic, field: r.error === "password_common" ? "password" : r.error });
    // The emergency contact, before the account is made: required, the second when filled.
    const ec = emReadBoth(em1, em2, r.args.p_phone);
    if ("error" in ec) return emShow(ec);
    setBusy(true);
    try {
      if (made.current) return await consent(made.current);
      // Each on its own, so the message says which one is taken (as the sign-up page does).
      const ex = await rpcResult<boolean>("customer_exists", { p_email: r.args.p_email, p_phone: "" });
      if ("data" in ex && ex.data === true) return setErr({ text: t.errors.email_taken, field: "email" });
      const ex2 = await rpcResult<boolean>("customer_exists", { p_email: "", p_phone: r.args.p_phone });
      if ("data" in ex2 && ex2.data === true) return setErr({ text: t.errors.phone_taken, field: "phone" });
      const newId = uid();
      const s = await rpcResult<{ id: string; session_token: string }[]>("customer_signup", { p_id: newId, ...r.args });
      if ("error" in s) {
        const m = `${s.error.code || ""} ${s.error.message || ""}`;
        // WEAK_PASSWORD: the database still asks the old rule (an upper-case letter and a digit), or knows it as a common one
        if (/WEAK_PASSWORD/.test(m)) return setErr({ text: passwordOldRuleMiss(r.args.p_pwd) ? t.errors.password_old : t.errors.password_common, field: "password" });
        return setErr({ text: /name_short|name_chars/.test(m) ? t.errors.first : /23505|DUPLICATE/i.test(m) ? t.errors.email_taken : /RATE_LIMITED/.test(m) ? t.errors.rate_limited : t.errors.generic });
      }
      const tok = Array.isArray(s.data) ? s.data[0]?.session_token : "";
      if (!tok) return setErr({ text: t.errors.generic });
      await consent({ id: newId, token: tok, name: r.args.p_name, email: r.args.p_email, phone: r.args.p_phone, gender: r.args.p_gender, height: r.args.p_height });
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
    setA((x) => ({ ...x, password: "" }));
    // Then the emergency contact typed with the sign-up. Should it not save, the account stays made:
    // step 2 asks for it again, with what was typed and why, and saves it before the lesson is sent.
    const ec = emReadBoth(em1, em2, acc.phone);
    const saved = "error" in ec ? { problem: ec } : await saveEm(acc, ec.first, ec.second);
    toLesson({ id: acc.id, token: acc.token, name: acc.name, email: acc.email, phone: acc.phone, made: true }, { gender: acc.gender, height: acc.height }, false, { need: saved !== true, two: true });
    if (saved !== true) {
      if ("problem" in saved) emShow(saved.problem);
      else setErr({ text: saved.text });
    }
  }

  // Step 1, known: sign in with the email or mobile and password, through the site's sign-in
  // (api/account, its tries a minute and its Turnstile check), for this page only (page: true -
  // the session comes back here and no cookie is set). A temporary password staff issued is
  // replaced first (the "pwd" step).
  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErr(null);
    const ident = signinIdentifier(si.id);
    if (!ident || !si.password) return setErr({ text: t.errors.signin_empty, field: "signin" });
    if (TURNSTILE_SITE_KEY && !check) return setErr({ text: t.errors.check });
    setBusy(true);
    try {
      let b: { ok?: boolean; error?: string; id?: unknown; token?: unknown; name?: unknown; email?: unknown } = {};
      try {
        const r = await fetch("/api/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: ident, password: si.password, check, page: true }) });
        b = (await r.json().catch(() => ({}))) as typeof b;
      } catch { /* offline: the generic message below */ }
      if (b.error === "must_change") {
        setSi({ id: "", password: "" });
        setCheck("");
        setStage("pwd");
        return;
      }
      if (!b.ok || typeof b.id !== "string" || typeof b.token !== "string") {
        if (TURNSTILE_SITE_KEY) { setCheck(""); setAgain((n) => n + 1); } // a token is good for one try
        const m = t.errors;
        return setErr({ text: b.error === "wrong" ? m.signin_bad : b.error === "locked" ? m.signin_locked : b.error === "slow" ? m.slow
          : b.error === "check" ? m.check : b.error === "missing" ? m.signin_empty : m.generic,
          field: b.error === "wrong" || b.error === "missing" ? "signin" : undefined });
      }
      setSi({ id: "", password: "" });
      await enter(b.id, b.token, typeof b.name === "string" ? b.name : "", typeof b.email === "string" ? b.email : "");
    } finally { setBusy(false); }
  }

  // A question staff flagged answered with what the account already holds (the owner, 2026-11-09: "don't allow a
  // flagged account field to type in the same info in the field again"), as the booking app's check-up refuses it:
  // the first such question's name and key, or null. "I don't have one" (nothing typed) is an answer, never the same.
  function sameAgain(pl: LearnPayload, ec: { first: EmContact; second: EmContact | null } | null): [string, string] | null {
    if (!fixed.current.length) return null;
    const ew = emergencyWords(p.locale), em = (x: EmContact | null | undefined) => (x ? { name: x.name, phone: x.phone, relation: x.rel } : null);
    const asked: [string, unknown, string][] = [
      ["whatsapp", { same: pl.whatsapp_same, phone: pl.whatsapp ?? "" }, t.waLabel], ["birth_date", pl.birth_date, t.birth],
      ["nationality", pl.nationality, t.nationality], ["height", String(pl.height), t.height], ["instagram", pl.instagram, t.instagram],
      ["linkedin", pl.linkedin, t.linkedin], ["profession", pl.profession, t.profession], ["workplace", pl.workplace, t.workplace],
      ["heard_from", pl.heard_from, t.heard], ["emergency", em(ec?.first), ew.title], ["emergency2", em(ec?.second), ew.title2],
    ];
    const hit = asked.find(([k, a]) => fixed.current.includes(k) && sameAsHeld(k, a, held.current));
    return hit ? [hit[2], hit[0]] : null;
  }

  // Step 2: the lesson, from the account.
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !acct) return;
    setErr(null);
    const r = learnPayload(f, p.locale);
    if ("error" in r) return show(r);
    // An account that has not confirmed the Privacy Notice confirms it here, with the box above
    // the button.
    // An account without an emergency contact gives it here (lib/emergency.ts).
    const ec = emNeed ? emReadBoth(em1, emTwo ? em2 : null, acct.phone) : null;
    if (ec && "error" in ec) return emShow(ec);
    if (need.privacy && !ack) { setErr({ text: t.errors.privacy, field: "ack" }); setFocus({ to: "ack", n: ++moves.current }); return; }
    const again = sameAgain(r.payload, ec);
    if (again) return setErr({ text: t.sameAsAccount(again[0]), field: FIELD_OF[again[1]] });
    setBusy(true);
    try {
      // The contact first: the lesson waits until the account has it.
      if (ec) {
        const saved = await saveEm(acct, ec.first, ec.second);
        if (saved !== true) {
          if ("problem" in saved) return emShow(saved.problem);
          if (saved.signedOut) { setAcct(null); setStage("signin"); }
          return setErr({ text: saved.text });
        }
        setEmNeed(false);
        emSaved.current = true;
      }
      // The notice they confirmed goes on the account, as the booking app records it, and with the
      // sign-up, which takes it when the account still has none (customer_learn_apply).
      if (need.privacy) await rpcResult("customer_consents", { p_id: acct.id, p_token: acct.token, p_privacy: p.privacyVersion });
      const payload = { ...r.payload, ...(need.privacy ? { privacy_version: p.privacyVersion } : {}), ...(emSaved.current ? { emergency_saved: true } : {}) };
      const res = await rpcResult<{ ok: boolean; error?: string; index?: number }>("customer_learn_apply", { p_id: acct.id, p_token: acct.token, p: payload });
      if (!("data" in res) || !res.data) return setErr({ text: t.errors.generic });
      if (res.data.ok) return setDone(true);
      const code = res.data.error || "";
      if (code === "signed_out") { setAcct(null); setStage("signin"); return setErr({ text: t.errors.signed_out }); }
      if (code === "closed") return setClosed(true);
      // An account with no notice on record the form could not tell of: the box is shown now.
      if (code === "privacy") { setNeed((x) => ({ ...x, privacy: true })); setErr({ text: t.errors.privacy, field: "ack" }); setFocus({ to: "ack", n: ++moves.current }); return; }
      // The account's own name, email or mobile, which learn_apply refuses: a one-word name is the
      // usual one, and the message says which.
      if (code === "account") return setErr({ text: accountNameOk(acct.name) ? t.errors.account : t.errors.account_name });
      // The list itself passed here (1 to 5, each once): what is over is the total with the learners
      // already signed up, which a second sign-up joins.
      if (code === "learners" && typeof res.data.index !== "number") return setErr({ text: t.errors.learners_total });
      show({ error: code, index: res.data.index });
    } finally { setBusy(false); }
  }

  if (closed) return <LearnClosed title={p.closedTitle} text={p.closedText} />;

  if (done) {
    return (
      <div className="ln-card ln-done" role="status" ref={doneBox}>
        <span className="ln-done-mark" aria-hidden="true"><TickIcon size={22} /></span>
        <h2>{p.doneTitle}</h2>
        <p>{p.doneText}</p>
        <p>{t.surge}</p>
        {/* A new sign-up from the same person, still signed in: their details stay; the learners
            start again from one empty card. */}
        <button type="button" className="ln-btn ln-btn-line" onClick={() => { setF((x) => ({ ...x, learners: [{ key: next.current++, ...EMPTY }], notes: "" })); setDone(false); }}>{t.again}</button>
      </div>
    );
  }

  // A question staff flagged on the account: said under it (the account's answer is in the box, to be checked).
  const flagNote = (k: string) => flagged.includes(k) && <small className="ln-hint ln-flag">{t.flagged}</small>;
  const knownLabel = (k: Known) => ({ whatsapp: t.waLabel, birth_date: t.birth, nationality: t.nationality, instagram: t.instagram, linkedin: t.linkedin,
    profession: t.profession, workplace: t.workplace, heard_from: t.heard })[k];
  // One choice of a group: a real radio button in its label, drawn as the card, pill or row (one tab stop per
  // group, arrow keys move within it; WCAG 4.1.2). `name` keeps each group apart.
  const radio = (name: string, on: boolean, pick: () => void, label: string, cls: string, disabled = false) => (
    <label key={label} className={`${cls} ln-opt${on ? " on" : ""}${disabled ? " off" : ""}`}>
      <input type="radio" name={name} checked={on} onChange={pick} disabled={disabled} />
      <span>{label}</span>
    </label>
  );
  const problem = (i?: number) => err && err.index === i && <p className="ln-err" role="alert" id={errId}>{err.text}</p>;
  // The mobile number's form, in its label rather than a placeholder that goes on typing (left to right in Arabic too).
  const fmt = <bdi className="ln-fmt">05XXXXXXXX</bdi>;
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
            {/* Each answer opens its step at once, so they are buttons, not radio buttons. */}
            <div className="ln-have" role="group" aria-labelledby={`${id}have`}>
              <button type="button" className="ln-go" onClick={() => { setErr(null); setStage("signin"); }}><span>{t.haveYes}</span><ArrowIcon size={18} /></button>
              <button type="button" className="ln-go" onClick={() => { setErr(null); setStage("signup"); }}><span>{t.haveNo}</span><ArrowIcon size={18} /></button>
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
        <h3 className="ln-step-title" ref={stageTop} tabIndex={-1}>{t.signinTitle}</h3>
        <label className="ln-field">
          <span>{t.identifier}</span>
          <input className="ln-input" value={si.id} onChange={(e) => { setSi((x) => ({ ...x, id: e.target.value })); setErr(null); }} autoComplete="username" autoCapitalize="off" spellCheck={false} dir="ltr" maxLength={254} {...bad("signin")} />
        </label>
        <label className="ln-field">
          <span>{t.password}</span>
          <input className="ln-input" type="password" value={si.password} onChange={(e) => { setSi((x) => ({ ...x, password: e.target.value })); setErr(null); }} autoComplete="current-password" dir="ltr" maxLength={72} {...bad("signin")} />
        </label>
        <Turnstile locale={p.locale} onToken={onToken} resetKey={again} />
        {problem(undefined)}
        <button type="submit" className="ln-btn ln-btn-green" disabled={busy}>{busy ? t.signingIn : t.signin}</button>
        {back}
      </form>
    );
  }

  if (stage === "pwd") {
    return (
      <div className="ln-card">
        {head}
        <ChangePassword page look={PWD_LOOK}
          onDone={(s) => { if (s) { setStage("loading"); void enter(s.id, s.token, "", ""); } }}
          onBack={() => { setErr(null); setStage("signin"); }} />
      </div>
    );
  }

  if (stage === "signup") {
    return (
      <form className="ln-card" onSubmit={createAccount} noValidate>
        {head}
        <h3 className="ln-step-title" ref={stageTop} tabIndex={-1}>{t.createTitle}</h3>
        <p className="ln-hint">{t.createSub}</p>
        <p className="ln-hint">{t.accountFor}</p>
        <div className="ln-row">
          <label className="ln-field">
            <span>{t.first}</span>
            <input className="ln-input" value={a.first} onChange={(e) => setAcc("first", dashless(e.target.value))} autoComplete="given-name" maxLength={60} {...bad("first")} />
          </label>
          <label className="ln-field">
            <span>{t.last}</span>
            <input className="ln-input" value={a.last} onChange={(e) => setAcc("last", dashless(e.target.value))} autoComplete="family-name" maxLength={60} {...bad("last")} />
          </label>
        </div>
        <span className="ln-label" id={`${id}ag`}>{t.gender}</span>
        <div className="ln-pills" role="radiogroup" aria-labelledby={`${id}ag`} {...bad("gender")}>
          {(["male", "female"] as Gender[]).map((g) => radio(`${id}ag`, a.gender === g, () => setAcc("gender", g), t[g], "ln-pill"))}
        </div>
        <label className="ln-field">
          <span>{t.email}</span>
          <input className="ln-input" value={a.email} onChange={(e) => setAcc("email", e.target.value)} type="email" autoComplete="email" dir="ltr" maxLength={254} {...bad("email")} />
        </label>
        <label className="ln-field">
          <span>{t.phone} {fmt}</span>
          <input className="ln-input" value={a.phone} onChange={(e) => setAcc("phone", e.target.value)} inputMode="tel" autoComplete="tel" dir="ltr" maxLength={20} {...bad("phone")} />
        </label>
        <label className="ln-field">
          <span>{t.password}</span>
          <PasswordBox className="ln-input" value={a.password} onChange={(e) => setAcc("password", e.target.value)} autoComplete="new-password" dir="ltr" maxLength={72} {...bad("password")} />
          <small className="ln-hint">{t.pwdHint}</small>
        </label>
        <label className="ln-field">
          <span>{t.height}</span>
          <input className="ln-input" value={a.height} onChange={(e) => setAcc("height", e.target.value)} inputMode="numeric" maxLength={3} placeholder={range(...ACCOUNT_HEIGHT)} {...bad("acct_height")} />
        </label>
        <div ref={emBox}>
          <EmergencyFields one={em1} two={em2} onChange={onEm} offerTwo problem={emErr} look={EM_LOOK} />
        </div>
        <label className="ln-check">
          <input type="checkbox" checked={a.privacy} onChange={(e) => setAcc("privacy", e.target.checked)} {...bad("privacy")} />
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
            <span className="ln-made-mark" aria-hidden="true"><TickIcon size={22} /></span>
            <span><b>{t.madeTitle}</b><span>{t.madeText}</span></span>
          </div>
        ) : acct?.name ? <p className="ln-who-am">{t.signedAs(acct.name)}{acct.email ? ` · ⁦${acct.email}⁩` : ""}</p> : null}
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
            <div className="ln-who" role="radiogroup" aria-label={t.who} {...bad("who", i)}>
              {/* "Me" is one card's at most: taken on another card, it is not offered here. */}
              {WHO.map((w) => radio(`${cid}w`, c.who === w, () => setLearner(i, { who: w }), t[w], "ln-who-opt", w === "self" && selfAt >= 0 && selfAt !== i))}
            </div>

            {(c.who === "child" || c.who === "other") && (
              <label className="ln-field">
                <span>{c.who === "child" ? t.childName : t.otherName}</span>
                <input className="ln-input" value={c.name} onChange={(e) => setLearner(i, { name: dashless(e.target.value) })} autoComplete="off" maxLength={60} {...bad("name", i)} />
                {c.who === "child" && <small className="ln-hint">{t.childNameHint}</small>}
              </label>
            )}
            {c.who === "self" ? <p className="ln-hint ln-hint-row">{t.selfNote}</p> : (
              <>
                <div className="ln-row">
                  <label className="ln-field">
                    <span>{t.age}</span>
                    <input className="ln-input" value={c.age} onChange={(e) => setLearner(i, { age: e.target.value })} inputMode="numeric" maxLength={3} placeholder={range(...AGE)} {...bad("age", i)} />
                  </label>
                  <label className="ln-field">
                    <span>{t.height}</span>
                    <input className="ln-input" value={c.height} onChange={(e) => setLearner(i, { height: e.target.value })} inputMode="numeric" maxLength={3} placeholder={range(...HEIGHT)} {...bad("height", i)} />
                  </label>
                </div>
                {i === rowAt && <p className="ln-hint ln-hint-row">{t.heightHint}</p>}

                <span className="ln-label" id={`${cid}g`}>{t.gender}</span>
                <div className="ln-pills" role="radiogroup" aria-labelledby={`${cid}g`} {...bad("gender", i)}>
                  {(["male", "female"] as Gender[]).map((g) => radio(`${cid}g`, c.gender === g, () => setLearner(i, { gender: g }), t[g], "ln-pill"))}
                </div>
              </>
            )}

            <span className="ln-label" id={`${cid}l`}>{t.level}</span>
            <div className="ln-levels" role="radiogroup" aria-labelledby={`${cid}l`} {...bad("level", i)}>
              {LEVELS.map((l) => radio(`${cid}l`, c.level === l, () => setLearner(i, { level: l }), t[l], "ln-level"))}
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
        {/* A signed-in account is not asked again what it holds (the owner, 2026-10-25): named here, a tap away. */}
        {skip.length > 0 && (
          <p className="ln-hint ln-skip">{t.skipped(skip.map(knownLabel).join(", "))} <button type="button" className="ln-link" onClick={() => setSkip([])}>{t.showThem}</button></p>
        )}
        {/* WhatsApp (the owner, 2026-10-07): Yes - the mobile - or No and the number, typed as the mobile is. */}
        {!skip.includes("whatsapp") && mobile && (
          <>
            <span className="ln-label" id={`${id}wa`}>{t.waAsk(`\u2066${mobile}\u2069`)}</span>
            {flagNote("whatsapp")}
            <div className="ln-pills" role="radiogroup" aria-labelledby={`${id}wa`} {...(mobile ? bad("whatsapp") : {})}>
              {(["yes", "no"] as const).map((v) => radio(`${id}wa`, f.waSame === v, () => setContact("waSame", v), v === "yes" ? t.waYes : t.waNo, "ln-pill"))}
            </div>
          </>
        )}
        {!skip.includes("whatsapp") && (f.waSame === "no" || !mobile) && (
          <label className="ln-field">
            <span>{t.waLabel} {fmt}</span>
            <input className="ln-input" value={f.whatsapp} onChange={(e) => { setF((x) => ({ ...x, waSame: "no", whatsapp: e.target.value })); setErr(null); }}
              inputMode="tel" autoComplete="off" dir="ltr" maxLength={20} {...(f.waSame === "no" || !mobile ? bad("whatsapp") : {})} />
          </label>
        )}
        {!skip.includes("birth_date") && <div className="ln-field">
          <span className="ln-label" id={`${id}b`}>{t.birth}</span>
          <div className="ln-dob" role="group" aria-labelledby={`${id}b`}>
            <select className={`ln-input ln-select${bd.d ? "" : " ln-ph"}`} aria-label={t.day} value={bd.d} onChange={(e) => setBirth("d", e.target.value)} autoComplete="bday-day" {...bad("birth")}>
              <option value="">{t.day}</option>
              {Array.from({ length: 31 }, (_, k) => <option key={k} value={two(k + 1)}>{k + 1}</option>)}
            </select>
            <select className={`ln-input ln-select${bd.m ? "" : " ln-ph"}`} aria-label={t.month} value={bd.m} onChange={(e) => setBirth("m", e.target.value)} autoComplete="bday-month" {...bad("birth")}>
              <option value="">{t.month}</option>
              {Array.from({ length: 12 }, (_, k) => <option key={k} value={two(k + 1)}>{names ? names.months[k] : two(k + 1)}</option>)}
            </select>
            <select className={`ln-input ln-select${bd.y ? "" : " ln-ph"}`} aria-label={t.year} value={bd.y} onChange={(e) => setBirth("y", e.target.value)} autoComplete="bday-year" {...bad("birth")}>
              <option value="">{t.year}</option>
              {Array.from({ length: AGE[1] + 1 }, (_, k) => <option key={k} value={String(thisYear - k)}>{thisYear - k}</option>)}
            </select>
          </div>
          {flagNote("birth_date")}
        </div>}
        {need.gender && (
          <>
            <span className="ln-label" id={`${id}g`}>{t.gender}</span>
            <div className="ln-pills" role="radiogroup" aria-labelledby={`${id}g`} {...bad("gender")}>
              {(["male", "female"] as Gender[]).map((g) => radio(`${id}g`, f.gender === g, () => setContact("gender", g), t[g], "ln-pill"))}
            </div>
          </>
        )}
        {!skip.includes("nationality") && <label className="ln-field">
          <span>{t.nationality}</span>
          <select className={`ln-input ln-select${f.nationality ? "" : " ln-ph"}`} value={f.nationality} onChange={(e) => setContact("nationality", e.target.value)} {...bad("nationality")}>
            <option value="">{t.natPick}</option>
            {names?.nats.map((o, i) => <option key={`${i}-${o.value}`} value={o.value}>{o.label}</option>)}
          </select>
          {flagNote("nationality")}
        </label>}
        {need.height && (
          <label className="ln-field">
            <span>{t.height}</span>
            <input className="ln-input" value={f.height} onChange={(e) => setContact("height", e.target.value)} inputMode="numeric" maxLength={3} placeholder={range(...HEIGHT)} {...bad("height")} />
            {rowAt < 0 && <small className="ln-hint">{t.heightHint}</small>}
          </label>
        )}
        {!skip.includes("instagram") && <label className="ln-field">
          <span>{t.instagram}</span>
          <input className="ln-input" value={f.instagram} onChange={(e) => setContact("instagram", e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} dir="ltr" maxLength={120} placeholder="@username" {...bad("instagram")} />
          <small className="ln-hint">{t.instagramHint}</small>
          {flagNote("instagram")}
        </label>}
        {!skip.includes("linkedin") && <label className="ln-field">
          <span>{t.linkedin}</span>
          <input className="ln-input" value={f.linkedin} onChange={(e) => setContact("linkedin", e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} dir="ltr" maxLength={200} placeholder="linkedin.com/in/your-name" {...bad("linkedin")} />
          <small className="ln-hint">{t.linkedinHint}</small>
          {flagNote("linkedin")}
        </label>}
        {!skip.includes("profession") && <label className="ln-field">
          <span>{t.profession}</span>
          <input className="ln-input" value={f.profession} onChange={(e) => setContact("profession", e.target.value)} autoComplete="organization-title" maxLength={80} placeholder={t.professionPh} {...bad("profession")} />
          {flagNote("profession")}
        </label>}
        {!skip.includes("workplace") && <label className="ln-field">
          <span>{t.workplace}</span>
          <input className="ln-input" value={f.workplace} onChange={(e) => setContact("workplace", e.target.value)} autoComplete="organization" maxLength={120} {...bad("workplace")} />
          <small className="ln-hint">{t.workplaceHint}</small>
          {flagNote("workplace")}
        </label>}
        {!skip.includes("heard_from") && <label className="ln-field">
          <span>{t.heard}</span>
          <select className={`ln-input ln-select${f.heard ? "" : " ln-ph"}`} value={f.heard} onChange={(e) => setContact("heard", e.target.value as Heard | "")} {...bad("heard")}>
            <option value="">{t.heardPick}</option>
            {HEARD.map((h) => <option key={h} value={h}>{t.heardOpts[h]}</option>)}
          </select>
        </label>}
        <label className="ln-field">
          <span>{t.notes}</span>
          <textarea className="ln-input" value={f.notes} onChange={(e) => setContact("notes", e.target.value)} rows={3} maxLength={600} {...bad("notes")} />
        </label>
      </div>
      {/* An account without an emergency contact (or one the account step could not save) gives it here. */}
      {emNeed && (
        <div ref={emBox}>
          <EmergencyFields one={em1} two={em2} onChange={onEm} offerTwo={emTwo} problem={emErr} look={EM_LOOK} />
        </div>
      )}
      {/* An account with no Privacy Notice on record (or an older one than riders must confirm)
          confirms it here: the sign-up cannot go without it. */}
      {need.privacy && (
        <label className="ln-check ln-ack">
          <input ref={ackBox} type="checkbox" checked={ack} onChange={(e) => { setAck(e.target.checked); setErr(null); }} {...bad("ack")} />
          <span>{before}<NoticeLink dialog={p.notice}>{t.privacyLink}</NoticeLink>{after}</span>
        </label>
      )}
      <p className="ln-use">{t.use}</p>

      {problem(undefined)}
      <button type="submit" className="ln-btn ln-btn-green" disabled={busy}>{busy ? t.sending : t.send}</button>
    </form>
  );
}
