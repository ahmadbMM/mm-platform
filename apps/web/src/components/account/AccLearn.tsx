"use client";

import { useEffect, useRef, useState } from "react";
import { intlOf } from "@/i18n/locales";
import { LL_LEVELS, certFile, learnerName, levelsOf, skillName, type LlLadder, type LlLevel } from "@/lib/learn-ladder";
import type { LearnWords } from "./LearnLadder.words";
import AccIcon from "./AccIcon";

// My Account > Learn to ride (the booking app's learn-ladder.js, 80431674; lib/learn-ladder.ts): the learner's own
// ladder - with more than one learner on the account's sign-ups, a choice of whom - the instructor's line, the four
// levels with their skills (ticked, or "Practising"; nothing is marked failed), a Certificate on each complete level,
// and once all four are complete the way to a Saturday ride (`saturday`: the booking app's community ride, where a member
// books and anyone else is shown how to apply). A certificate is drawn here in the browser, 1080 x 1350, with the
// learner's name, the level and the day its last skill was ticked, Arabic and Urdu right to left: Save image, Share
// where the browser shares files, and Back to the ladder.
type Cert = { n: number; url: string; file: File | null; err: boolean };

export default function AccLearn({ ladder, own, w, locale, saturday }: { ladder: LlLadder; own: string; w: LearnWords; locale: string; saturday: string }) {
  const [at, setAt] = useState(0);
  const [cert, setCert] = useState<Cert | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const i = Math.max(0, Math.min(ladder.learners.length - 1, at));
  const L = ladder.learners[i];
  const lv = L ? levelsOf(ladder, L) : [];
  const name = (k: number) => learnerName(ladder.learners[k], k, own, w.learner);
  useEffect(() => () => { if (cert?.url) URL.revokeObjectURL(cert.url); }, [cert]);
  if (!L) return null;

  const openCert = (x: LlLevel) => {
    const c: Cert = { n: x.n, url: "", file: null, err: false };
    setCert(c);
    top.current?.scrollIntoView({ block: "nearest" });
    void drawCert(name(i), x, w, locale).then((r) => setCert((cur) => (cur && cur.n === x.n && !cur.url ? { ...cur, ...r } : cur)));
  };
  const back = () => { setCert(null); top.current?.scrollIntoView({ block: "nearest" }); };

  if (cert) {
    const nm = w[`lv${cert.n}` as "lv1"];
    const canShare = (() => { try { return !!(cert.file && typeof navigator.share === "function" && navigator.canShare?.({ files: [cert.file] })); } catch { return false; } })();
    return (
      <div className="acm-card acm-ll-cert" ref={top} data-ll-cert={cert.n}>
        {cert.url ? <img className="acm-ll-img" src={cert.url} width={1080} height={1350} alt={w.certAlt.replace("{0}", nm)} />
          : cert.err ? <p className="acm-err" role="alert">{w.err}</p>
          : <div className="acm-ll-ph" role="status" aria-label={w.wait} />}
        {cert.url && (
          <div className="acm-btns">
            <a className="acm-btn" href={cert.url} download={certFile(cert.n)}>{w.save}</a>
            {canShare && <button type="button" className="acm-btn acm-btn-line" onClick={() => { try { void navigator.share({ files: [cert.file as File] }).catch(() => null); } catch { /* not shared */ } }}>{w.share}</button>}
          </div>
        )}
        <button type="button" className="acm-btn acm-btn-line acm-ll-back" onClick={back}>{w.back}</button>
      </div>
    );
  }

  const all = lv.length > 0 && lv.every((x) => x.done);
  return (
    <div className="acm-ll" ref={top}>
      {ladder.learners.length > 1 && (
        <div className="acm-card acm-ll-who" role="group" aria-label={w.who}>
          {ladder.learners.map((_, k) => (
            <button key={k} type="button" className={`acm-ll-who-b${k === i ? " on" : ""}`} aria-pressed={k === i} onClick={() => setAt(k)}><bdi>{name(k)}</bdi></button>
          ))}
        </div>
      )}
      {L.feedback && (
        <div className="acm-card acm-ll-fb">
          <span className="acm-k">{w.fb}</span>
          <p className="acm-ll-fb-t"><bdi>{L.feedback}</bdi></p>
        </div>
      )}
      <ol className="acm-ll-lvs">
        {lv.map((x) => (
          <li key={x.n} className={`acm-card acm-ll-lv${x.done ? " done" : ""}`} data-ll-level={x.n}>
            <div className="acm-ll-lv-h">
              <span className="acm-ll-lv-n" aria-hidden="true">{x.done ? <AccIcon name="tick" size={16} /> : x.n}</span>
              <h3 className="acm-ll-lv-t">{w[`lv${x.n}` as "lv1"]}<span className="acm-sr"> · {w.lvOf.replace("{0}", String(x.n)).replace("{1}", String(LL_LEVELS))}</span></h3>
              <span className="acm-ll-lv-c"><bdi dir="ltr">{x.on}/{x.skills.length}</bdi></span>
            </div>
            <ul className="acm-ll-sks">
              {x.skills.map((sk) => {
                const on = !!L.ticked[sk.key];
                return (
                  <li key={sk.key} className={`acm-ll-sk${on ? " on" : ""}`} data-ll-skill={sk.key}>
                    <span className="acm-ll-sk-i" aria-hidden="true">{on && <AccIcon name="tick" size={14} />}</span>
                    <span className="acm-ll-sk-n"><bdi>{skillName(sk, locale)}</bdi></span>
                    {on ? <span className="acm-sr">{w.got}</span> : <span className="acm-ll-prac">{w.prac}</span>}
                  </li>
                );
              })}
            </ul>
            {x.done && <button type="button" className="acm-btn acm-btn-line acm-btn-sm acm-ll-cert-b" onClick={() => openCert(x)}><AccIcon name="doc" size={18} />{w.cert}</button>}
          </li>
        ))}
      </ol>
      {all && (
        <div className="acm-card acm-ll-inv">
          <p className="acm-ll-inv-t">{w.inv}</p>
          <a className="acm-btn" href={saturday}>{w.invGo}</a>
        </div>
      )}
    </div>
  );
}

/** One line, made smaller until it fits the width (the app's _llFit). */
function fit(x: CanvasRenderingContext2D, text: string, y: number, weight: number, size: number, fam: string, max: number) {
  let px = size;
  do { x.font = `${weight} ${px}px ${fam}`; px -= 4; } while (px > 24 && x.measureText(text).width > max);
  x.fillText(text, 540, y);
}

/** The level's certificate as a PNG (the app's _llCertDraw, its colours and places). */
async function drawCert(name: string, lv: LlLevel, w: LearnWords, locale: string): Promise<{ url: string; file: File | null; err: boolean }> {
  try {
    const cv = document.createElement("canvas"); cv.width = 1080; cv.height = 1350;
    const x = cv.getContext("2d"); if (!x) throw new Error("2d");
    const fam = getComputedStyle(document.body).fontFamily || "sans-serif", rtl = locale === "ar" || locale === "ur";
    const lri = String.fromCharCode(0x2066), pdi = String.fromCharCode(0x2069); // a number keeps its own direction
    try { await Promise.all(["700 96px", "600 48px", "400 40px"].map((f) => document.fonts.load(`${f} ${fam}`))); } catch { /* the fallback font */ }
    x.direction = rtl ? "rtl" : "ltr"; x.textAlign = "center"; x.textBaseline = "alphabetic";
    x.fillStyle = "#0b0e0a"; x.fillRect(0, 0, 1080, 1350);
    x.strokeStyle = "#03ff89"; x.lineWidth = 4; x.strokeRect(48, 48, 984, 1254);
    x.fillStyle = "#03ff89"; x.font = `600 48px ${fam}`; x.fillText("MicroMobility", 540, 200);
    x.fillStyle = "#b8c2bb"; fit(x, w.title, 270, 400, 40, fam, 880);
    x.fillStyle = "#ffffff"; fit(x, w.cert, 480, 700, 96, fam, 880);
    x.fillStyle = "#b8c2bb"; fit(x, w.lvOf.replace("{0}", lri + lv.n + pdi).replace("{1}", lri + LL_LEVELS + pdi), 600, 600, 44, fam, 880);
    x.fillStyle = "#03ff89"; fit(x, w[`lv${lv.n}` as "lv1"], 730, 700, 88, fam, 880);
    x.fillStyle = "#ffffff"; fit(x, name, 940, 700, 72, fam, 880);
    const t = Date.parse(lv.at);
    if (Number.isFinite(t)) {
      let day = "";
      try { day = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : intlOf(locale), { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Riyadh", numberingSystem: "latn" }).format(new Date(t)); } catch { /* no day */ }
      if (day) { x.fillStyle = "#d7ded9"; fit(x, day, 1030, 400, 40, fam, 880); }
    }
    x.fillStyle = "#7f8a83"; x.font = `400 34px ${fam}`; x.fillText("experiences.micromobility.sa", 540, 1230);
    const blob = await new Promise<Blob | null>((res) => cv.toBlob(res, "image/png"));
    if (!blob) throw new Error("toBlob");
    let file: File | null = null;
    try { file = new File([blob], certFile(lv.n), { type: "image/png" }); } catch { file = null; }
    return { url: URL.createObjectURL(blob), file, err: false };
  } catch {
    return { url: "", file: null, err: true };
  }
}
