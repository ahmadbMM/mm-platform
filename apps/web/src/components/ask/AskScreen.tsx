"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { localeInfo } from "@/i18n/locales";
import { applyLive, applySame, askScreen, askText, askTheme, isDrawn, rereadDue, resultsShown, screenAt, screenStep, writtenConfig, type AskFull, type LiveAnswer } from "@/lib/ask";
import { rpcResult } from "@/lib/rpc-client";
import { T } from "./Ask.text";
import AskQr from "./AskQr";
import { IconNext } from "./icons";
import AskResults from "./results";
import type { VoteProps } from "./results/types";
import { useAskLive } from "./useAskLive";

// The screen shows how many upvoted an answer, and takes no vote itself.
const NOBODY: ReadonlySet<number> = new Set();
const COUNTS: VoteProps = { mine: NOBODY, voted: NOBODY, can: false, busy: null, onVote: () => {} };

// micromobility.sa/ask/<slug>/screen?k=<key>: a page on a TV or a projector - one question at a time, its results
// filling the screen, and along the bottom where to answer: the address, the page's code and a QR code of its link.
// No account and nothing of the site around it. The results are asked for every 4 seconds with the screen's own key
// (useAskLive); the page is read again (ask_screen, straight from the database too) when staff add a question or
// start a new round. The operator moves with the two buttons, the arrow keys or a clicker (Page Up / Page Down); on a
// page staff pace themselves the screen follows the question they put on.
type Props = { locale: string; slug: string; screenKey: string; initial: AskFull; asked: string | null; qr: { n: number; bits: string }; link: string };

export default function AskScreen({ locale, slug, screenKey, initial, asked, qr, link }: Props) {
  const t = useLocalize(T);
  const [full, setFull] = useState(initial);
  const [bad, setBad] = useState(false);
  // the question the operator moved to, and the question staff had on screen then: once staff put another on, theirs shows
  const [picked, setPicked] = useState<{ id: number; under: number | null } | null>(null);
  const held = useRef(full);
  useEffect(() => { held.current = full; });

  const readAt = useRef(0);
  const reread = useCallback(async () => {
    const now = Date.now();
    if (!rereadDue(readAt.current, now)) return;
    readAt.current = now;
    const r = await rpcResult<unknown>("ask_screen", { p_slug: slug, p_key: screenKey });
    if ("error" in r) return; // out of reach: the screen keeps what it shows
    const next = askScreen(r.data);
    if (next) setFull(next); else setBad(true);
  }, [slug, screenKey]);

  const onLive = useCallback((a: LiveAnswer) => {
    if (a.kind === "gone") { reread(); return; }
    if (a.kind === "same") { setFull((f) => applySame(f, a)); return; }
    const { reload } = applyLive(held.current, a.live);
    setFull((f) => applyLive(f, a.live).full);
    if (reload) reread();
  }, [reread]);
  useAskLive(slug, "screen", bad ? null : { key: screenKey, ver: full.live?.ver ?? 0 }, onLive);

  const { page } = full;
  // a kind these pages do not draw yet is not one of the screen's questions
  const questions = full.questions.filter((x) => isDrawn(x.kind));
  const at = screenAt(questions, { picked: picked && picked.under === page.current_q ? picked.id : null, pace: page.pace, current: page.current_q, asked });
  const count = questions.length;
  const rtl = localeInfo(locale).dir === "rtl";
  const move = useCallback((by: 1 | -1) => {
    const now = held.current;
    const list = now.questions.filter((x) => isDrawn(x.kind));
    const from = screenAt(list, { picked: picked && picked.under === now.page.current_q ? picked.id : null, pace: now.page.pace, current: now.page.current_q, asked });
    const to = screenStep(list.length, from, by);
    const q = list[to];
    if (!q || to === from) return;
    setPicked({ id: q.id, under: now.page.current_q });
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("q", String(q.id));
      window.history.replaceState(window.history.state, "", url);
    } catch { /* the address stays as it was */ }
  }, [picked, asked]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const by = e.key === "PageDown" ? 1 : e.key === "PageUp" ? -1 : e.key === "ArrowRight" ? (rtl ? -1 : 1) : e.key === "ArrowLeft" ? (rtl ? 1 : -1) : 0;
      if (!by) return;
      e.preventDefault();
      move(by);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [move, rtl]);

  if (bad) return <main id="mm-main" className="mm-site ask ask-screen ask-screen-bad" dir={rtl ? "rtl" : "ltr"}><h1>{t.screenBad}</h1></main>;

  const q = at >= 0 ? questions[at] : null;
  const pageTitle = askText(locale, page.title_en, page.title_ar);
  const title = q ? askText(locale, q.title_en, q.title_ar) : pageTitle;
  const help = q ? askText(locale, q.help_en, q.help_ar) : askText(locale, page.intro_en, page.intro_ar);
  return (
    <div className="mm-site ask ask-screen" dir={rtl ? "rtl" : "ltr"} data-ask-theme={askTheme(page.look)}>
      <main id="mm-main" className="ask-scr-main">
        <header className="ask-scr-head">
          {q && pageTitle && pageTitle !== title && <p className="ask-scr-page" dir="auto">{pageTitle}</p>}
          <h1 dir="auto">{title}</h1>
          {help && <p className="ask-scr-help" dir="auto">{help}</p>}
        </header>
        <div className="ask-scr-body" key={q?.id ?? "none"}>
          {q?.image && <img className="ask-scr-img" src={q.image} alt="" />}
          {q && resultsShown(q, full, true) && (
            <AskResults q={q} pageLook={page.look} result={full.live?.results[String(q.id)]} locale={locale} t={t} screen
              votes={(q.kind === "open" || q.kind === "qa") && writtenConfig(q.kind, q.config).votes ? COUNTS : null} />
          )}
        </div>
      </main>
      <footer className="ask-scr-strip">
        <span className="ask-scr-mark" role="img" aria-label="Micromobility" />
        <p className="ask-scr-join">
          <span className="ask-scr-url mm-lat">micromobility.sa/ask</span>
          {page.code && <span className="ask-scr-code"><span>{t.code}</span> <b className="mm-lat">{page.code.slice(0, 3)}<span className="ask-scr-gap" />{page.code.slice(3)}</b></span>}
        </p>
        {count > 1 && (
          <nav className="ask-scr-nav" aria-label={`${at + 1} / ${count}`}>
            <button type="button" className="ask-scr-btn ask-scr-prev" aria-label={t.prev} aria-disabled={at <= 0} onClick={() => move(-1)}><IconNext /></button>
            <span className="ask-scr-at mm-lat" aria-hidden="true">{at + 1} / {count}</span>
            <button type="button" className="ask-scr-btn" aria-label={t.next} aria-disabled={at >= count - 1} onClick={() => move(1)}><IconNext /></button>
          </nav>
        )}
        <AskQr n={qr.n} bits={qr.bits} label={link} />
      </footer>
    </div>
  );
}
