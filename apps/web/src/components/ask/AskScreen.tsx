"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { localeInfo } from "@/i18n/locales";
import { applyLive, applySame, askScreen, askText, isDrawn, isQuiz, rereadDue, resultCount, resultsShown, screenAt, screenStep, writtenConfig, type AskFull, type LiveAnswer } from "@/lib/ask";
import { rightWords } from "@/lib/ask-kinds";
import { askImage, pageLook } from "@/lib/ask-look";
import { betterOffset, isLivePaced, offsetOf, type Offset } from "@/lib/ask-pace";
import { rpcResult } from "@/lib/rpc-client";
import { T, type AskWords } from "./Ask.text";
import { AskClock, useClock } from "./AskClock";
import AskQr from "./AskQr";
import { ScreenReactions } from "./AskReactions";
import { IconCheck, IconFull, IconNext, IconSmall } from "./icons";
import AskResults from "./results";
import { QuizOptions } from "./results/Kinds";
import type { VoteProps } from "./results/types";
import { useAskLive, type LiveMeta } from "./useAskLive";

// The screen shows how many upvoted an answer, and takes no vote itself.
const NOBODY: ReadonlySet<number> = new Set();
const COUNTS: VoteProps = { mine: NOBODY, voted: NOBODY, can: false, busy: null, onVote: () => {} };

// micromobility.sa/ask/<slug>/screen?k=<key>: a page on a TV or a projector - one question at a time, its results
// filling the screen, and along the bottom where to answer: the page's own address and a QR code of it.
// No account and nothing of the site around it. The results are asked for every 4 seconds with the screen's own key
// (useAskLive); the page is read again (ask_screen, straight from the database too) when staff add a question or
// start a new round. The operator moves with the two buttons, the arrow keys or a clicker (Page Up / Page Down); on a
// page staff pace themselves the screen follows the question they put on.
//
// It is drawn for a room (ask.css): type that reads from the back, the chart filling one large panel, in the page's
// own theme. The page's look says what else the strip shows - how many have answered, the QR code - and whether the
// screen moves on by itself (`rotate`: after so many seconds the next question, and after the last the first; never
// on a page staff pace). F, or the button on the strip, fills the screen.
//
// On a page staff pace (contract H5) the screen follows the question they put on: it asks every 2 seconds, the arrows
// and `rotate` do nothing, and before the first question it shows the page's own title. A quiz question shows its
// clock (counted against the database's time) and its options, and its chart only once staff reveal it - with the
// right answer marked and how many got it right. No score and no name is ever shown here: the screen is sent none.
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
  const reread = useCallback(async (must = false) => {
    const now = Date.now();
    // at most every half minute - or, when it cannot wait (staff showed a question the screen does not hold), a second and a half
    if (must ? !!readAt.current && now - readAt.current < 1500 : !rereadDue(readAt.current, now)) return;
    readAt.current = now;
    const r = await rpcResult<unknown>("ask_screen", { p_slug: slug, p_key: screenKey });
    if ("error" in r) return; // out of reach: the screen keeps what it shows
    const next = askScreen(r.data);
    if (next) setFull(next); else setBad(true);
  }, [slug, screenKey]);

  // How far this device's clock stands from the database's, read off the polls (a quiz clock counts against theirs).
  const [offset, setOffset] = useState<Offset | null>(null);
  const onLive = useCallback((a: LiveAnswer, meta: LiveMeta) => {
    const read = offsetOf(meta.sentAt, meta.gotAt, a.kind === "full" ? a.live.now : a.kind === "same" ? a.now : null);
    if (read) setOffset((o) => betterOffset(o, read));
    if (a.kind === "gone") { reread(); return; }
    if (a.kind === "same") { setFull((f) => applySame(f, a)); return; }
    const { reload } = applyLive(held.current, a.live);
    setFull((f) => applyLive(f, a.live).full);
    if (reload) reread(isLivePaced(held.current) || a.live.pace === "live");
  }, [reread]);
  const paced = isLivePaced(full);
  useAskLive(slug, "screen", bad ? null : { key: screenKey, ver: full.live?.ver ?? 0 }, onLive, paced);

  const { page } = full;
  const look = useMemo(() => pageLook(page.look), [page.look]);
  // a kind these pages do not draw yet is not one of the screen's questions
  const questions = full.questions.filter((x) => isDrawn(x.kind));
  // staff pace the page: the screen is on the question they put on, and on nothing of its own
  const at = paced
    ? screenAt(questions, { picked: null, pace: "live", current: page.current_q, asked: null })
    : screenAt(questions, { picked: picked && picked.under === page.current_q ? picked.id : null, pace: page.pace, current: page.current_q, asked });
  const count = questions.length;
  const rtl = localeInfo(locale).dir === "rtl";
  /** One question on or back. `round`: past the last comes the first (the screen moving on by itself). */
  const move = useCallback((by: 1 | -1, round = false) => {
    const now = held.current;
    if (isLivePaced(now)) return;
    const list = now.questions.filter((x) => isDrawn(x.kind));
    const from = screenAt(list, { picked: picked && picked.under === now.page.current_q ? picked.id : null, pace: now.page.pace, current: now.page.current_q, asked });
    const to = round && list.length ? (from + by + list.length) % list.length : screenStep(list.length, from, by);
    const q = list[to];
    if (!q || to === from) return;
    setPicked({ id: q.id, under: now.page.current_q });
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("q", String(q.id));
      window.history.replaceState(window.history.state, "", url);
    } catch { /* the address stays as it was */ }
  }, [picked, asked]);

  // The whole screen: F, or the button on the strip, where the browser can do it.
  const [canFill, setCanFill] = useState(false);
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const read = () => { setCanFill(document.fullscreenEnabled === true); setFilled(!!document.fullscreenElement); };
    const first = requestAnimationFrame(read);
    document.addEventListener("fullscreenchange", read);
    return () => { cancelAnimationFrame(first); document.removeEventListener("fullscreenchange", read); };
  }, []);
  const fill = useCallback(() => {
    try {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      else document.documentElement.requestFullscreen?.().catch(() => {});
    } catch { /* a browser that cannot: the screen stays as it is */ }
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "f" || e.key === "F") { e.preventDefault(); fill(); return; }
      const by = e.key === "PageDown" ? 1 : e.key === "PageUp" ? -1 : e.key === "ArrowRight" ? (rtl ? -1 : 1) : e.key === "ArrowLeft" ? (rtl ? 1 : -1) : 0;
      if (!by) return;
      e.preventDefault();
      move(by);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [move, rtl, fill]);

  // The screen moving on by itself: after the look's `rotate` seconds on a question, the next, and after the last the
  // first. Every move - the operator's too - starts the wait again. Not on a page staff pace: there the screen is theirs.
  const rotate = page.pace === "live" || count < 2 ? 0 : look.screen.rotate;
  useEffect(() => {
    if (!rotate) return;
    const id = setTimeout(() => move(1, true), rotate * 1000);
    return () => clearTimeout(id);
  }, [rotate, at, move]);

  if (bad) return <main id="mm-main" className="mm-site ask ask-screen ask-screen-bad" dir={rtl ? "rtl" : "ltr"}><h1>{t.screenBad}</h1></main>;

  const q = at >= 0 ? questions[at] : null;
  const pageTitle = askText(locale, page.title_en, page.title_ar);
  const title = q ? askText(locale, q.title_en, q.title_ar) : pageTitle;
  const help = q ? askText(locale, q.help_en, q.help_ar) : askText(locale, page.intro_en, page.intro_ar);
  const result = q ? full.live?.results[String(q.id)] : undefined;
  // a form has nothing public but its count, which the strip says: no chart
  const charted = !!q && q.kind !== "form" && resultsShown(q, full, true) && result !== undefined && result !== null;
  // a quiz question before its reveal: the options alone, for the room to read
  const options = !!q && q.kind === "quiz" && !q.reveal;
  // a revealed question with no chart on screen (its results kept for staff): its right answer, for the room
  const right = q && !charted && !options ? rightWords(q, locale, result) : "";
  // a pin question's picture is its chart's own ground
  const image = q && !(q.kind === "pin" && charted) ? askImage(q.image, 1280) : null;
  const answers = result !== undefined && result !== null ? resultCount(result) : 0;
  return (
    <div className="mm-site ask ask-screen" dir={rtl ? "rtl" : "ltr"} data-ask-theme={look.theme} data-long={page.slug.length > 30 ? "2" : page.slug.length > 18 ? "1" : undefined}>
      <main id="mm-main" className={`ask-scr-main${charted || options || image || right ? "" : " solo"}`}>
        <header className="ask-scr-head">
          <div className="ask-scr-titles">
            {q && pageTitle && pageTitle !== title && <p className="ask-scr-page" dir="auto">{pageTitle}</p>}
            <h1 dir="auto">{title}</h1>
            {help && <p className="ask-scr-help" dir="auto">{help}</p>}
          </div>
          {q && <ScreenSide q={q} full={full} offsetMs={offset ? offset.ms : null} reactions={look.reactions} t={t} />}
        </header>
        {(charted || options || image || right) && (
          <div className="ask-scr-body" key={q?.id ?? "none"}>
            {image && <img className="ask-scr-img" src={image} alt="" />}
            {q && charted && (
              <div className="ask-stage">
                <AskResults q={q} pageLook={page.look} result={result} locale={locale} t={t} screen
                  votes={(q.kind === "open" || q.kind === "qa") && writtenConfig(q.kind, q.config).votes ? COUNTS : null} />
              </div>
            )}
            {q && options && !charted && <div className="ask-stage"><QuizOptions q={q} locale={locale} /></div>}
            {right && (
              <div className="ask-stage">
                <p className="ask-scr-right"><span><span className="ask-right" aria-hidden="true"><IconCheck /></span>{t.correct}</span><b dir="auto">{right}</b></p>
              </div>
            )}
          </div>
        )}
      </main>
      <footer className="ask-scr-strip">
        <span className="ask-scr-mark" role="img" aria-label="Micromobility" />
        <p className="ask-scr-join">
          <span className="ask-scr-url mm-lat" dir="ltr">{link.replace(/^https?:\/\//, "")}</span>
        </p>
        {/* how many have answered the question on screen; a new answer makes the number beat once */}
        {look.screen.count && answers > 0 && <p className="ask-scr-count"><span key={answers}>{answers === 1 ? t.oneAnswer : t.answers(answers)}</span></p>}
        {count > 1 && !paced && (
          <nav className="ask-scr-nav" aria-label={`${at + 1} / ${count}`}>
            <button type="button" className="ask-scr-btn ask-scr-prev" aria-label={t.prev} aria-disabled={at <= 0} onClick={() => move(-1)}><IconNext /></button>
            <span className="ask-scr-at mm-lat" aria-hidden="true">{at + 1} / {count}</span>
            <button type="button" className="ask-scr-btn" aria-label={t.next} aria-disabled={at >= count - 1} onClick={() => move(1)}><IconNext /></button>
          </nav>
        )}
        {canFill && <button type="button" className="ask-scr-btn ask-scr-fill" aria-label={t.fullScreen} aria-pressed={filled} onClick={fill}>{filled ? <IconSmall /> : <IconFull />}</button>}
        {look.screen.qr && <AskQr n={qr.n} bits={qr.bits} label={link} />}
      </footer>
    </div>
  );
}

/** Beside the question on the big screen: a quiz question's clock while it runs, and the reactions people gave. */
function ScreenSide({ q, full, offsetMs, reactions, t }: { q: AskFull["questions"][number]; full: AskFull; offsetMs: number | null; reactions: boolean; t: AskWords }) {
  const clock = useClock(q, offsetMs);
  const ticking = clock !== null && isQuiz(q.kind) && q.open && !q.reveal;
  if (!ticking && !reactions) return null;
  return (
    <div className="ask-scr-side">
      {ticking && <AskClock clock={clock} t={t} big />}
      {reactions && <ScreenReactions full={full} question={q.id} t={t} />}
    </div>
  );
}
