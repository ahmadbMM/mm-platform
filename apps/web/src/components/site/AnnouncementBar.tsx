"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
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

export default function AnnouncementBar({ items, arrow }: { items: Announcement[]; arrow: string }) {
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
  const m = list[i % list.length];
  return (
    <div className="mm-ann" role="region" aria-label={tx("Announcements", "الإعلانات")} aria-live="off">
      <span>{m.text}</span>
      {m.cta && m.href ? <a href={m.href}>{m.cta} {arrow}</a> : null}
      {turns && (
        <button type="button" className="mm-ann-pause" aria-pressed={paused} onClick={() => setPaused((p) => !p)}
          aria-label={tx("Pause announcements", "إيقاف الإعلانات مؤقتاً")}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
            {paused ? <path d="M8 5.5v13l10.5-6.5z" /> : <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />}
          </svg>
        </button>
      )}
    </div>
  );
}
