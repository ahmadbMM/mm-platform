"use client";

import { useState } from "react";
import { useL } from "@/i18n/TxProvider";

// What riders say, on Home: one row that moves on its own (mmMarquee). The mouse pauses it on hover; a phone or a
// keyboard has this button (WCAG 2.2.2, as the announcements' pause), and focus inside it pauses it too. A reader who
// asks for less motion gets the cards still and wrapped onto rows (home.css), so none of them is out of reach.
export type Review = { name: string; role: string; quote: string };

export default function ReviewsStrip({ reviews, dir }: { reviews: Review[]; dir: string }) {
  const tx = useL();
  const [paused, setPaused] = useState(false);
  return (
    <>
      <div className={`hm-reviews-track${paused ? " is-paused" : ""}`} dir="ltr">
        <div className="hm-reviews-row">
          {[...reviews, ...reviews].map((x, i) => (
            <figure className="hm-review" key={i} dir={dir} aria-hidden={i >= reviews.length ? true : undefined}>
              <blockquote>“{x.quote}”</blockquote>
              <figcaption><span className="init">{x.name.trim().charAt(0)}</span><span><strong>{x.name}</strong><small>{x.role}</small></span></figcaption>
            </figure>
          ))}
        </div>
      </div>
      <button type="button" className="hm-reviews-pause" aria-pressed={paused} onClick={() => setPaused((p) => !p)}
        aria-label={tx("Pause reviews", "إيقاف التقييمات مؤقتاً")}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
          {paused ? <path d="M8 5.5v13l10.5-6.5z" /> : <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />}
        </svg>
      </button>
    </>
  );
}
