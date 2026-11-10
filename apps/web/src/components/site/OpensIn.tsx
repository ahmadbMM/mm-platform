"use client";

import { useEffect, useState, type ReactNode } from "react";
import { opensLine, type OpensWords } from "@/lib/opens-in";
import { ClockIcon } from "./Icons";

// A date not open to book yet, on the Events and Club lists, said as Experiences says it (2026-11-10): a clock beside
// when it opens (never the grey alone, WCAG 1.4.1), and within a day of it a countdown to the real booking window
// ("Booking opens in 2 h 10 min", lib/opens-in.ts), read again at each minute and never a timer of its own. When the
// window opens the date opens itself: its Book (children) takes the words' place. Before the browser's clock is read
// it says what the server said, so the first drawing matches the server's.
type Props = {
  /** The server's words for when it opens (lib/booking-window.ts opensText). */
  text: string;
  /** When it opens, epoch ms (lib/booking-window.ts opensAt); null: no countdown, the words stay. */
  at: number | null;
  words: OpensWords;
  className?: string;
  /** The element the words sit in, as the list had it. */
  as?: "span" | "small";
  /** What shows once the window has opened: the date's Book. */
  children: ReactNode;
};

export default function OpensIn({ text, at, words, className, as: Tag = "span", children }: Props) {
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    if (at == null) return;
    let h = 0;
    const tick = () => {
      const now = Date.now();
      setNowMs(now);
      if (now < at) h = window.setTimeout(tick, 60000 - (now % 60000) + 50);
    };
    h = window.setTimeout(tick, 0);
    const back = () => { if (document.visibilityState === "visible") { window.clearTimeout(h); tick(); } };
    document.addEventListener("visibilitychange", back);
    return () => { window.clearTimeout(h); document.removeEventListener("visibilitychange", back); };
  }, [at]);
  const line = opensLine(text, at, nowMs, words);
  if (line === null) return <>{children}</>;
  return <Tag className={className}><ClockIcon size={13} /><span>{line}</span></Tag>;
}
