"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useLocalize } from "@/i18n/TxProvider";
import {
  REREAD_MS, applyLive, applySame, askNum, askSent, askText, askView, askWhen, hasPending, isDrawn, pageOpen, rereadDue, stepAt, withMine, withVote, withoutMine,
  type AskQuestion, type AskView, type LiveAnswer, type SendAnswer,
} from "@/lib/ask";
import { pageLook } from "@/lib/ask-look";
import { betterOffset, isLivePaced, liveQuestion, meLine, offsetOf, quizSeconds, withReaction, type Offset } from "@/lib/ask-pace";
import { T } from "./Ask.text";
import AskQuestionCard, { type QuestionActions } from "./AskQuestion";
import AskSignIn from "./AskSignIn";
import { IconClose } from "./icons";
import { useAskLive, type LiveMeta } from "./useAskLive";

// micromobility.sa/ask/<slug>: one page of questions, drawn from what ask_page answered on the server and kept up to
// date in the browser. The results come straight from the database (useAskLive); the page itself is read again
// through the site (GET /api/ask/<slug>, which reads the account cookie) only when it must be: the live key ran out,
// staff put a new question on or started a new round, a waiting answer may have been reviewed (the version moved; at
// most once every 30 seconds), or an answer came back without the viewer's list. Answers, taking one back and upvotes
// go through the site's own routes too (/api/ask/send, /unsend, /vote): the session's token never reaches this script.
//
// How the page looks is staff's (the page's `look`, lib/ask-look.ts pageLook): its theme, a picture across the top, the
// line said after an answer, and whether the questions stand one under another or come one at a time ("steps": Back
// and Next under the question, and where the reader is among them over it).
//
// A page staff pace (contract H5) shows ONE question, the one they put on screen, and moves to the next by itself:
// it asks for news every 2 seconds, and reads itself again at once when staff show a question it does not hold. Before
// the first it waits. A quiz question's clock counts against the database's time, read off those same polls. The
// viewer's own quiz line - their points and their place, never anyone else's - stands once, above the questions.
type Props = {
  locale: string; slug: string; initial: AskView;
  /** A staff preview's key (?k=), sent with every read of the page. */
  pageKey: string | null;
  /** Where an account is created (the booking app, which hands the rider back here). */
  create: string;
};

const post = async (path: string, body: unknown): Promise<unknown> => {
  const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return r.json().catch(() => null);
};

export default function AskPage({ locale, slug, initial, pageKey, create }: Props) {
  const t = useLocalize(T);
  const [view, setView] = useState(initial);
  const [signIn, setSignIn] = useState(false);
  // the question the reader answered last: the page's thanks line stands under it
  const [thanked, setThanked] = useState<number | null>(null);
  const held = useRef(view);
  useEffect(() => { held.current = view; });

  // The page read again through the site: at most once every 30 seconds unless it must be now.
  const readAt = useRef(0);
  const reading = useRef(false);
  const later = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reread = useCallback(async function again(must = false): Promise<void> {
    const now = Date.now();
    if (reading.current) return;
    // even a read that cannot wait keeps a second and a half from the last (a poll every 2 seconds may ask for it twice)
    if (must && readAt.current && now - readAt.current < 1500) return;
    if (!must && !rereadDue(readAt.current, now)) {
      later.current ??= setTimeout(() => { later.current = undefined; again(); }, REREAD_MS - (now - readAt.current));
      return;
    }
    reading.current = true;
    readAt.current = now;
    try {
      const r = await fetch(`/api/ask/${slug}${pageKey ? `?k=${encodeURIComponent(pageKey)}` : ""}`, { cache: "no-store", credentials: "same-origin" });
      const b = (await r.json().catch(() => null)) as { ok?: boolean; page?: unknown } | null;
      if (b?.ok) setView(askView(b.page));
    } catch { /* out of reach: the page keeps what it shows */ }
    reading.current = false;
  }, [slug, pageKey]);
  useEffect(() => () => clearTimeout(later.current), []);

  // The poll asked for right after the viewer's own answer: the version it brings moved because of that answer.
  const own = useRef(false);
  // A key the database refuses is replaced by reading the page again. Three refusals in a row with no answer between
  // them (a page whose results cannot be asked for at all): the page stops asking until it is opened again.
  const refused = useRef(0);
  const [quiet, setQuiet] = useState(false);
  // How far this device's clock stands from the database's, read off the polls (a quiz clock counts against theirs).
  const [offset, setOffset] = useState<Offset | null>(null);
  const onLive = useCallback((a: LiveAnswer, meta: LiveMeta) => {
    const now = held.current.full;
    const mine = own.current;
    own.current = false;
    if (!now) return;
    const read = offsetOf(meta.sentAt, meta.gotAt, a.kind === "full" ? a.live.now : a.kind === "same" ? a.now : null);
    if (read) setOffset((o) => betterOffset(o, read));
    if (a.kind === "gone") {
      if (++refused.current >= 3) setQuiet(true); else reread();
      return;
    }
    refused.current = 0;
    if (a.kind === "same") { setView((v) => (v.full ? { ...v, full: applySame(v.full, a) } : v)); return; }
    const { reload } = applyLive(now, a.live);
    // the version moved while an answer of theirs waits (and not by their own answer): staff may have approved it, or not
    const reviewed = !mine && hasPending(now) && !!now.live && a.live.ver > now.live.ver;
    setView((v) => (v.full ? { ...v, full: applyLive(v.full, a.live).full } : v));
    // on a page staff pace the question they have just shown (or revealed) cannot wait for the half minute
    if (reload || reviewed) reread(reload && (isLivePaced(now) || a.live.pace === "live"));
  }, [reread]);
  const full = view.full;
  // a staff preview of a page that is not open asks with the key in its own address: the database refuses a preview's
  // reading key, and takes that one (contract G2)
  const liveKey = full ? (full.preview && pageKey ? pageKey : full.rk) : "";
  const paced = !!full && isLivePaced(full) && pageOpen(full);
  const poke = useAskLive(slug, "page", full && liveKey && !quiet ? { key: liveKey, ver: full.live?.ver ?? 0 } : null, onLive, paced);
  // a quiz clock running on a page at its own pace: the database's time is asked for now, not at the next poll
  const clocked = !!full && !paced && full.questions.some((q) => q.open && !q.reveal && quizSeconds(q) !== null);
  const timed = offset !== null;
  useEffect(() => { if (clocked && !timed) poke(); }, [clocked, timed, poke]);

  // A page that is not open yet opens by the clock: read again at its opening time (within the next twelve hours),
  // a few seconds apart for each visitor - and, while the database still says "not yet" (this phone's clock runs
  // ahead of it), every half minute after, eight times at most.
  const opensAt = view.state === "soon" ? view.head?.opens_at ?? null : null;
  const [tried, setTried] = useState(0);
  useEffect(() => {
    if (!opensAt || tried > 8) return;
    const wait = Date.parse(opensAt) - Date.now();
    if (!(wait > -10 * 60_000 && wait < 12 * 3600_000)) return;
    const id = setTimeout(async () => { await reread(true); setTried((n) => n + 1); }, Math.max(0, wait) + (tried ? 30_000 : 1500 + Math.random() * 5000));
    return () => clearTimeout(id);
  }, [opensAt, reread, tried]);

  const act: QuestionActions = {
    signIn: () => setSignIn(true),
    send: async (question, value): Promise<SendAnswer> => {
      try {
        const a = askSent(await post("/api/ask/send", { question, value, lang: locale }));
        if (a.ok) {
          setThanked(question);
          const mine = a.mine;
          if (mine) setView((v) => (v.full ? { ...v, full: withMine(v.full, question, mine) } : v));
          else reread(true);
          own.current = true;
          poke();
        } else if (a.error === "signin" || a.error === "audience" || a.error === "closed") reread(); // the page is not what it was
        return a;
      } catch { return { ok: false, error: "generic" }; }
    },
    unsend: async (question, answer) => {
      try {
        const b = (await post("/api/ask/unsend", { answer })) as { ok?: boolean } | null;
        // not taken back: it may no longer be waiting (staff reviewed it meanwhile) - the page is read again
        if (b?.ok !== true) { if (b) reread(); return false; }
        setView((v) => (v.full ? { ...v, full: withoutMine(v.full, question, answer) } : v));
        poke();
        return true;
      } catch { return false; }
    },
    vote: async (question, answer, on) => {
      try {
        const b = (await post("/api/ask/vote", { answer, on })) as { ok?: boolean; votes?: unknown } | null;
        if (b?.ok !== true) return false;
        const votes = typeof b.votes === "number" && Number.isFinite(b.votes) ? b.votes : null;
        setView((v) => (v.full ? { ...v, full: withVote(v.full, question, answer, on, votes) } : v));
        return true;
      } catch { return false; }
    },
    // a reaction shows at once and is put back as it was if the database did not take it
    react: (question, kind, on) => {
      const set = (to: boolean) => setView((v) => (v.full ? { ...v, full: withReaction(v.full, question, kind, to) } : v));
      set(on);
      post("/api/ask/react", { question, kind, on })
        .then((b) => { if ((b as { ok?: boolean } | null)?.ok === true) { own.current = true; poke(); } else set(!on); })
        .catch(() => set(!on));
    },
  };

  // A page drawn in steps: the question the reader is on - held by its id, so a page read again stays on it - and
  // kept for this tab, so signing in (which loads the page again) comes back to the same question.
  const [step, setStep] = useState<{ id: number | null; index: number }>({ id: null, index: 0 });
  const stepKey = `mm_ask_step:${slug}`;
  useEffect(() => {
    let frame = 0;
    try {
      const v = JSON.parse(sessionStorage.getItem(stepKey) || "null") as { id?: unknown; index?: unknown } | null;
      if (v && typeof v.index === "number" && Number.isFinite(v.index)) {
        const held = { id: typeof v.id === "number" ? v.id : null, index: v.index };
        frame = requestAnimationFrame(() => setStep(held));
      }
    } catch { /* no storage here: the page starts at its first question */ }
    return () => cancelAnimationFrame(frame);
  }, [stepKey]);
  // After Back or Next the keyboard and the screen reader are where the step says which question this is, and the
  // page is scrolled to it when it is out of view.
  const stepHead = useRef<HTMLParagraphElement>(null);
  const moved = useRef(false);
  const goTo = (q: AskQuestion | undefined, index: number) => {
    if (!q) return;
    const held = { id: q.id, index };
    moved.current = true;
    setStep(held);
    try { sessionStorage.setItem(stepKey, JSON.stringify(held)); } catch { /* kept for this visit only */ }
  };
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    const el = stepHead.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const top = el.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.6) {
      const calm = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "start", behavior: calm ? "auto" : "smooth" });
    }
  }, [step]);

  const back = `/ask/${slug}`;
  if (!full) {
    const title = view.head ? askText(locale, view.head.title_en, view.head.title_ar) : "";
    return (
      <div className="ask ask-page ask-state" data-ask-theme="light">
        {view.state === "signin" ? (
          <section className="ask-box">
            <h1 className="ask-state-title">{t.signinTitle}</h1>
            <AskSignIn locale={locale} create={create} back={back} />
          </section>
        ) : title ? (
          // not open yet, or closed with its results put away: the page's title, and one line
          <section className="ask-box">
            <h1 dir="auto">{title}</h1>
            {view.state === "soon"
              ? opensAt && <p className="ask-state-line"><time dateTime={opensAt} suppressHydrationWarning>{t.opens(askWhen(opensAt, locale))}</time></p>
              : <p className="ask-state-line">{t.closedPage}</p>}
            <Link className="ask-back" href="/ask">{t.listTitle}</Link>
          </section>
        ) : (
          // no such page, or not one for this account: the one line is the page's heading
          <section className="ask-box">
            <h1 className="ask-state-title">{view.state === "audience" ? t.notYours : t.none}</h1>
            <Link className="ask-back" href="/ask">{t.listTitle}</Link>
          </section>
        )}
      </div>
    );
  }

  const { page } = full;
  const look = pageLook(page.look);
  const title = askText(locale, page.title_en, page.title_ar), intro = askText(locale, page.intro_en, page.intro_ar);
  const open = pageOpen(full);
  // a kind these pages do not know is left out whole
  const drawn = full.questions.filter((q) => isDrawn(q.kind));
  // staff show one question at a time: the page's own layout is not read (a page that has closed shows all it holds)
  const current = paced ? liveQuestion(full) : null;
  const steps = !paced && look.layout === "steps" && drawn.length > 1;
  const at = steps ? stepAt(drawn.map((q) => q.id), step) : -1;
  const thanks = askText(locale, look.thanks_en, look.thanks_ar);
  const me = meLine(full);
  const card = (q: AskQuestion) => (
    <AskQuestionCard key={q.id} q={q} full={full} locale={locale} t={t} act={act} thanks={thanked === q.id ? thanks : ""} offsetMs={offset ? offset.ms : null} reactions={look.reactions} />
  );
  return (
    <div className="ask ask-page" data-ask-theme={look.theme}>
      {look.cover && <img className="ask-cover" src={look.cover} alt="" decoding="async" fetchPriority="high" />}
      <header className="ask-head">
        {full.preview ? <p className="ask-flags"><span className="ask-chip ask-chip-preview">{t.preview}</span></p> : !open && <p className="ask-flags"><span className="ask-chip">{t.closed}</span></p>}
        <h1 dir="auto">{title}</h1>
        {intro && <p className="ask-intro" dir="auto">{intro}</p>}
        {/* the one line the page says about itself, once, while it takes answers: whose name goes with an answer */}
        {open && drawn.some((q) => q.kind !== "info") && <p className="ask-private">{t.privacy}</p>}
        {open && page.closes_at && <p className="ask-until"><time dateTime={page.closes_at} suppressHydrationWarning>{t.until(askWhen(page.closes_at, locale))}</time></p>}
      </header>
      {/* the viewer's own quiz line - their points and their place - once, above the questions */}
      {me && <p className="ask-me" role="status">{me.rank !== null && me.players !== null ? t.mePlace(askNum(me.score, locale, 0), me.rank, me.players) : t.me(askNum(me.score, locale, 0))}</p>}
      {paced ? (
        <div className="ask-questions">
          {/* said to a screen reader when staff show another question: the card itself is drawn anew */}
          <p className="mm-sr" role="status">{current ? askText(locale, current.title_en, current.title_ar) : ""}</p>
          {current ? card(current) : <section className="ask-q ask-wait"><p>{t.waitNext}</p></section>}
        </div>
      ) : steps ? (
        <div className="ask-steps">
          <p ref={stepHead} className="ask-progress" tabIndex={-1}>
            <span>{t.step(at + 1, drawn.length)}</span>
            <span className="ask-progress-bar" aria-hidden="true"><span style={{ inlineSize: `${((at + 1) / drawn.length) * 100}%` }} /></span>
          </p>
          {card(drawn[at])}
          <div className="ask-steps-nav">
            <button type="button" className="ask-btn ask-btn-line ask-on-page" disabled={at <= 0} onClick={() => goTo(drawn[at - 1], at - 1)}>{t.back}</button>
            <button type="button" className="ask-btn ask-on-page" disabled={at >= drawn.length - 1} onClick={() => goTo(drawn[at + 1], at + 1)}>{t.forward}</button>
          </div>
        </div>
      ) : <div className="ask-questions">{drawn.map(card)}</div>}
      <SignInDialog open={signIn && !full.signed} onClose={() => setSignIn(false)} title={t.signinToAnswer} close={t.close}>
        <AskSignIn locale={locale} create={create} back={back} />
      </SignInDialog>
    </div>
  );
}

/** The sign-in, in a pop-up in the middle of the screen (never a sheet from the bottom): opened by any "Sign in to
 *  answer" button, one for the whole page. Escape, the cross or a tap outside closes it, and the keyboard goes back to
 *  the button that opened it. The form is drawn only while it is open. */
function SignInDialog({ open, onClose, title, close, children }: { open: boolean; onClose: () => void; title: string; close: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", ""); }
    else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="ask-dialog" aria-labelledby="ask-signin-h" onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      {open && (
        <div className="ask-dialog-box ask-light">
          <button type="button" className="ask-x ask-dialog-x" aria-label={close} onClick={onClose}><IconClose /></button>
          <h2 id="ask-signin-h">{title}</h2>
          {children}
        </div>
      )}
    </dialog>
  );
}
