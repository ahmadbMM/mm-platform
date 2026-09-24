"use client";

import { useEffect, useState } from "react";

// The dark bar under the header: one message at a time, turning every six seconds.
export type Announcement = { text: string; cta: string; href: string };

export default function AnnouncementBar({ items, arrow }: { items: Announcement[]; arrow: string }) {
  const list = items.filter((i) => i.text.trim());
  const [i, setI] = useState(0);
  useEffect(() => {
    if (list.length < 2) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = setInterval(() => setI((n) => (n + 1) % list.length), 6000);
    return () => clearInterval(id);
  }, [list.length]);
  if (!list.length) return null;
  const m = list[i % list.length];
  return (
    <div className="mm-ann" id="start" role="region" aria-label="Announcements" aria-live="polite">
      <span>{m.text}</span>
      {m.cta && m.href ? <a href={m.href}>{m.cta} {arrow}</a> : null}
    </div>
  );
}
