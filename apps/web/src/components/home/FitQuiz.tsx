"use client";

import { useState } from "react";
import { fmtSar } from "@/lib/fill";
import { bg } from "@/lib/img";

// "Which bike fits your lifestyle?" - where you ride, then what matters most; the answer is one
// of three bikes with the reason that fits your priority. Every word and bike is staff-edited.
type Rec = { name: string; image: string; price: number; why: Record<"speed" | "comfort" | "value", string> };
export type QuizText = { title: string; text: string; q1: string; q2: string; match: string; cta: string; ctaHref: string; retake: string;
  rides: { id: "road" | "city" | "trail"; label: string }[]; prios: { id: "speed" | "comfort" | "value"; label: string }[]; recs: Record<"road" | "city" | "trail", Rec> };

export default function FitQuiz({ q, locale, arrow }: { q: QuizText; locale: string; arrow: string }) {
  const [ride, setRide] = useState<"" | "road" | "city" | "trail">("");
  const [prio, setPrio] = useState<"" | "speed" | "comfort" | "value">("");
  const rec = ride && prio ? q.recs[ride] : null;
  const money = (n: number) => fmtSar(n, locale);
  return (
    <section className="hm-quiz" id="fit-quiz" aria-label={q.title}>
      <div className="hm-quiz-card">
        <h2>{q.title}</h2>
        <p>{q.text}</p>
        <div className="hm-quiz-steps">
          <div>
            <p className="hm-quiz-q">{q.q1}</p>
            <div className="hm-quiz-opts">
              {q.rides.map((o) => <button key={o.id} type="button" aria-pressed={ride === o.id} onClick={() => setRide(o.id)}>{o.label}</button>)}
            </div>
          </div>
          {ride && (
            <div>
              <p className="hm-quiz-q">{q.q2}</p>
              <div className="hm-quiz-opts">
                {q.prios.map((o) => <button key={o.id} type="button" aria-pressed={prio === o.id} onClick={() => setPrio(o.id)}>{o.label}</button>)}
              </div>
            </div>
          )}
          {rec && prio && (
            <div className="hm-quiz-result" aria-live="polite">
              <div className="pic" style={{ backgroundImage: `url('${bg(rec.image, 640)}')` }} />
              <div className="body">
                <span className="lbl">{q.match}</span>
                <strong>{rec.name}</strong>
                <span className="why">{rec.why[prio]}</span>
                <div className="row">
                  <a href={q.ctaHref} className="hm-btn hm-green">{q.cta} <span className="hm-arw">{arrow}</span></a>
                  {rec.price > 0 && <span className="price">{money(rec.price)}</span>}
                  <button type="button" className="retake" onClick={() => { setRide(""); setPrio(""); }}>{q.retake}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
