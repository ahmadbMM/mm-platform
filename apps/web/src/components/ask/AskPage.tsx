"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useLocalize } from "@/i18n/TxProvider";
import {
  REREAD_MS, applyLive, applySame, askSent, askText, askTheme, askView, askWhen, hasPending, isDrawn, pageOpen, rereadDue, withMine, withVote, withoutMine,
  type AskView, type LiveAnswer, type SendAnswer,
} from "@/lib/ask";
import { T } from "./Ask.text";
import AskQuestionCard, { type QuestionActions } from "./AskQuestion";
import AskSignIn from "./AskSignIn";
import { IconClose } from "./icons";
import { useAskLive } from "./useAskLive";

// micromobility.sa/ask/<slug>: one page of questions, drawn from what ask_page answered on the server and kept up to
// date in the browser. The results come straight from the database (useAskLive); the page itself is read again
// through the site (GET /api/ask/<slug>, which reads the account cookie) only when it must be: the live key ran out,
// staff put a new question on or started a new round, a waiting answer may have been reviewed (the version moved; at
// most once every 30 seconds), or an answer came back without the viewer's list. Answers, taking one back and upvotes
// go through the site's own routes too (/api/ask/send, /unsend, /vote): the session's token never reaches this script.
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
  const held = useRef(view);
  useEffect(() => { held.current = view; });

  // The page read again through the site: at most once every 30 seconds unless it must be now.
  const readAt = useRef(0);
  const reading = useRef(false);
  const later = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reread = useCallback(async function again(must = false): Promise<void> {
    const now = Date.now();
    if (reading.current) return;
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
  const onLive = useCallback((a: LiveAnswer) => {
    const now = held.current.full;
    const mine = own.current;
    own.current = false;
    if (!now) return;
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
    if (reload || reviewed) reread();
  }, [reread]);
  const full = view.full;
  const poke = useAskLive(slug, "page", full && full.rk && !quiet ? { key: full.rk, ver: full.live?.ver ?? 0 } : null, onLive);

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
  };

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
  const title = askText(locale, page.title_en, page.title_ar), intro = askText(locale, page.intro_en, page.intro_ar);
  const open = pageOpen(full);
  return (
    <div className="ask ask-page" data-ask-theme={askTheme(page.look)}>
      <header className="ask-head">
        {full.preview ? <p className="ask-flags"><span className="ask-chip ask-chip-preview">{t.preview}</span></p> : !open && <p className="ask-flags"><span className="ask-chip">{t.closed}</span></p>}
        <h1 dir="auto">{title}</h1>
        {intro && <p className="ask-intro" dir="auto">{intro}</p>}
        {open && page.closes_at && <p className="ask-until"><time dateTime={page.closes_at} suppressHydrationWarning>{t.until(askWhen(page.closes_at, locale))}</time></p>}
      </header>
      <div className="ask-questions">
        {/* a kind these pages do not draw yet (grid, pin, form, the quizzes) is left out whole */}
        {full.questions.filter((q) => isDrawn(q.kind)).map((q) => <AskQuestionCard key={q.id} q={q} full={full} locale={locale} t={t} act={act} />)}
      </div>
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
        <div className="ask-dialog-box">
          <button type="button" className="ask-x ask-dialog-x" aria-label={close} onClick={onClose}><IconClose /></button>
          <h2 id="ask-signin-h">{title}</h2>
          {children}
        </div>
      )}
    </dialog>
  );
}
