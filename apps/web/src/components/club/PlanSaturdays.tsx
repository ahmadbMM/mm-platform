"use client";

import { useRef, useState } from "react";
import { TickIcon } from "@/components/site/Icons";
import { planAfter, type PlanAnswer, type PlanBox } from "@/lib/member-hub";

// Plan my Saturdays in a member's area on /club (the booking app's _planHtml / _planTick, new features F10): this month's
// Saturdays as tick boxes, each its day's number with the whole date for a screen reader. A tick books nothing and holds
// no place. A tap changes the box at once and posts to /api/account/plan (hub_plan_set); the database's answer is what
// stays, and a tap that did not go through turns the box back and says so, in place of the app's toast. A Saturday
// already gone shows, locked; a tap on a day whose last tap is still on its way is ignored. The page reads the ticks
// (hub_plan, lib/member-hub.ts) and hands the boxes and words over ready, so nothing here formats a date.
type Props = {
  boxes: PlanBox[];
  /** "Plan my Saturdays", the month's name ("" when unknown), and the line said when a tap did not go through. */
  title: string; month: string; err: string;
};

export default function PlanSaturdays({ boxes, title, month, err }: Props) {
  const [days, setDays] = useState(boxes);
  const [failed, setFailed] = useState(false);
  const pend = useRef(new Set<string>());

  async function tick(x: PlanBox) {
    if (x.past || pend.current.has(x.date)) return;
    const want = !x.on;
    const set = (f: (y: PlanBox) => PlanBox) => setDays((all) => all.map((y) => (y.date === x.date ? f(y) : y)));
    pend.current.add(x.date);
    setFailed(false);
    set((y) => ({ ...y, on: want }));
    let b: PlanAnswer = null;
    try {
      const r = await fetch("/api/account/plan", {
        method: "POST", cache: "no-store", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ date: x.date, on: want }),
      });
      b = (await r.json().catch(() => null)) as PlanAnswer;
    } catch { b = null; }
    pend.current.delete(x.date);
    const done = b;
    set((y) => planAfter(y, want, done).day);
    setFailed(planAfter(x, want, done).failed);
  }

  return (
    <section className="club-plan" aria-labelledby="club-plan-h">
      <h3 id="club-plan-h">{title}</h3>
      {month && <p className="club-plan-month"><strong><bdi>{month}</bdi></strong></p>}
      <div className="club-sats" role="group" aria-label={month ? `${title} · ${month}` : title}>
        {days.map((x) => (
          <button key={x.date} type="button" role="checkbox" className={`club-sat${x.on ? " on" : ""}`} aria-checked={x.on} aria-label={x.label}
            disabled={x.past} onClick={() => tick(x)}>
            <span className="club-sat-box">{x.on && <TickIcon size={14} />}</span><bdi>{x.n}</bdi>
          </button>
        ))}
      </div>
      {failed && <p className="club-plan-err" role="alert">{err}</p>}
    </section>
  );
}
