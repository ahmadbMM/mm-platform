"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useL } from "@/i18n/TxProvider";

// The dark bar under the header: one message at a time, turning every six seconds. Moving text
// can be paused (a button, once there are two messages), and it never moves for a reader who asks
// for less motion. It is not a live region: a screen reader is not interrupted every six seconds.
export type Announcement = { text: string; cta: string; href: string };

const REDUCE = "(prefers-reduced-motion: reduce)";
const onMotion = (fn: () => void) => {
  const q = window.matchMedia(REDUCE);
  q.addEventListener("change", fn);
  return () => q.removeEventListener("change", fn);
};

export default function AnnouncementBar({ items, arrow }: { items: Announcement[]; arrow: ReactNode }) {
  const tx = useL();
  const list = items.filter((i) => i.text.trim());
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const still = useSyncExternalStore(onMotion, () => window.matchMedia(REDUCE).matches, () => true);
  const turns = list.length > 1 && !still;
  useEffect(() => {
    if (!turns || paused) return;
    const id = setInterval(() => setI((n) => (n + 1) % list.length), 6000);
    return () => clearInterval(id);
  }, [turns, paused, list.length]);
  if (!list.length) return null;
  const cur = i % list.length;
  const m = list[cur];
  return (
    <div className="mm-ann" role="region" aria-label={tx("Announcements", "الإعلانات")} aria-live="off">
      {/* Every message in one cell, the others hidden: on a phone a message wraps whole (it was cut to one line with an
          ellipsis), and the bar is as tall as the longest one, so the page under it does not jump as they turn. */}
      <span className="mm-ann-msg">
        {list.map((x, k) => <span key={k} className={k === cur ? undefined : "mm-ann-off"}>{x.text}</span>)}
      </span>
      {m.cta && m.href ? <a href={m.href}>{m.cta} {arrow}</a> : null}
      {turns && (
        <button type="button" className="mm-ann-pause" aria-pressed={paused} onClick={() => setPaused((p) => !p)}
          aria-label={tx("Pause announcements", "إيقاف الإعلانات مؤقتاً")}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
            {paused ? <path d="M8 5.5v13l10.5-6.5z" /> : <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />}
          </svg>
        </button>
      )}
      {/* For a reader who asked for less motion nothing turns: the next message is a press away, not out of reach. */}
      {still && list.length > 1 && (
        <button type="button" className="mm-ann-pause" onClick={() => setI((n) => (n + 1) % list.length)}
          aria-label={tx("Next announcement", "الإعلان التالي")}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mm-ann-next">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      )}
    </div>
  );
}
