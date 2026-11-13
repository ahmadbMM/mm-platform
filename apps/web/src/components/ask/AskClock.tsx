"use client";

import { useEffect, useState } from "react";
import type { AskQuestion } from "@/lib/ask";
import { clockOf, quizSeconds, type Clock } from "@/lib/ask-pace";
import type { AskWords } from "./Ask.text";

// A quiz question's clock (contract H5): it counts down to `started_at` + the question's seconds against the
// DATABASE's time - this device's clock corrected by how far it stands from the database's (`offsetMs`, read off the
// polls: lib/ask-pace.ts offsetOf) - never the device's own. Until that is known there is no clock to show. At 0 the
// inputs lock; the database is the judge of an answer on the line ("late").

/** The clock of a question now, ticking five times a second while it runs; null for a question with no clock, and
 *  until the database's time is known. */
export function useClock(q: Pick<AskQuestion, "kind" | "config" | "started_at">, offsetMs: number | null): Clock | null {
  const total = quizSeconds(q);
  const start = q.started_at;
  const [now, setNow] = useState<number | null>(null);
  const on = total !== null && offsetMs !== null && !!start;
  useEffect(() => {
    if (!on) return;
    const end = Date.parse(start as string) + (total as number) * 1000;
    let id: ReturnType<typeof setInterval> | undefined;
    const tick = () => {
      const at = Date.now() + (offsetMs as number);
      setNow(at);
      if (at > end + 600) { clearInterval(id); id = undefined; }
    };
    id = setInterval(tick, 200);
    const first = setTimeout(tick, 0);
    return () => { clearInterval(id); clearTimeout(first); };
  }, [on, start, total, offsetMs]);
  return on && now !== null ? clockOf(q, now) : null;
}

/** The clock as it is drawn: the seconds left as a number, over a bar that empties. A screen reader is told the
 *  seconds in words when it asks (a timer is not read out as it ticks). */
export function AskClock({ clock, t, big = false }: { clock: Clock; t: AskWords; big?: boolean }) {
  return (
    <div className={`ask-clock${clock.over ? " over" : ""}${big ? " big" : ""}`} role="timer" aria-label={clock.over ? t.errors.late : t.secondsLeft(clock.left)}>
      <span className="ask-clock-n mm-lat" aria-hidden="true">{clock.left}</span>
      <span className="ask-clock-bar" aria-hidden="true"><span style={{ inlineSize: `${Math.round(clock.share * 1000) / 10}%` }} /></span>
    </div>
  );
}
