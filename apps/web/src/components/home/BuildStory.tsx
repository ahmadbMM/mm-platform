"use client";

import { useEffect, useRef, useState } from "react";

// "How a bike comes to life": the section is tall and its stage sticks while the page scrolls
// through it; each quarter of the scroll is one step. The chapter bar under the text jumps to a
// step. Phones and reduced-motion settings get the design's stated fallback (hidden / static).
export type Step = { title: string; text: string; image: string };

export default function BuildStory({ eyebrow, title, steps }: { eyebrow: string; title: string; steps: Step[]; ar: boolean }) {
  const wrap = useRef<HTMLElement>(null);
  const [idx, setIdx] = useState(0);
  const [frac, setFrac] = useState(0);
  const n = Math.max(steps.length, 1);
  useEffect(() => {
    const onScroll = () => {
      const el = wrap.current;
      if (!el) return;
      const total = el.offsetHeight - window.innerHeight;
      if (total <= 0) return;
      const p = Math.min(1, Math.max(0, -el.getBoundingClientRect().top / total));
      const pos = p * n;
      setIdx(Math.min(n - 1, Math.floor(pos)));
      setFrac(pos - Math.floor(pos));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, [n]);
  const go = (i: number) => {
    const el = wrap.current;
    if (!el) return;
    const total = el.offsetHeight - window.innerHeight;
    // reduced motion lays the story out one screen tall: nothing to scroll, so the step is set here
    if (total <= 0) { setIdx(i); setFrac(1); return; }
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: Math.round(top + total * (i / n) + 2), behavior: "smooth" });
  };
  if (!steps.length) return null;
  const nums = ["01", "02", "03", "04"];
  const cur = steps[idx] || steps[0];
  return (
    <section className="hm-story" ref={wrap} aria-label={title}>
      <div className="hm-story-stage">
        {steps.map((s, i) => (
          <span key={i} aria-hidden="true" className="hm-story-layer" style={{ backgroundImage: `url('${s.image}')`, opacity: i === idx ? 1 : 0 }} />
        ))}
        <span aria-hidden="true" className="hm-story-shade" />
        <div className="hm-story-copy">
          <div>
            <span className="hm-eyebrow">{eyebrow}</span>
            <h2>{cur.title}</h2>
            <p>{cur.text}</p>
            <div className="hm-story-chapters">
              {steps.map((s, i) => (
                <button key={i} type="button" onClick={() => go(i)} aria-current={i === idx ? "step" : undefined}>
                  <span aria-hidden="true" className="track" />
                  <span aria-hidden="true" className="fill" style={{ width: i < idx ? "100%" : i === idx ? `${(frac * 100).toFixed(1)}%` : "0%" }} />
                  {(nums[i] || String(i + 1)) + ". " + s.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
