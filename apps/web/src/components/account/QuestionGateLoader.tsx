"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import RatingGateLoader from "./RatingGateLoader";
import QuestionGate, { type QuestionDone } from "./QuestionGate";
import { QUESTION_QUIET } from "./quiet";
import type { RiderQuestion } from "@/lib/rider-question";

// A question staff put on one rider's account, on every page (2026-11-01; the booking app's
// _forceRiderQ), between the Defe race question and the post-ride rating: RaceGateLoader mounts this once
// no race place waits, and this holds the rating's (RatingGateLoader) until it has asked and no question
// waits. It asks /api/account/question, which answers a signed-out visitor from the cookie alone; a
// signed-in "nothing to ask" is kept two minutes in this tab (./quiet.ts). Send, or Later, asks for the
// next question (or nothing) at once; a question passed with Later is not asked again until the page is
// loaded again.
const KEY = QUESTION_QUIET;
const QUIET_MS = 2 * 60_000;
const passed = new Set<number>();

async function check(): Promise<RiderQuestion | null> {
  try { if (Number(sessionStorage.getItem(KEY) || 0) > Date.now()) return null; } catch { /* storage off: just ask */ }
  try {
    const skip = passed.size ? `?skip=${[...passed].join(",")}` : "";
    const r = await fetch(`/api/account/question${skip}`, { cache: "no-store", credentials: "same-origin" });
    if (!r.ok) return null;
    const b = (await r.json()) as { signedIn?: boolean; question?: RiderQuestion | null };
    try {
      if (b.signedIn && !b.question) sessionStorage.setItem(KEY, String(Date.now() + QUIET_MS));
      else sessionStorage.removeItem(KEY);
    } catch { /* */ }
    return b.question ?? null;
  } catch { return null; } // offline: the next page asks again
}

export default function QuestionGateLoader({ locale }: { locale: string }) {
  const path = usePathname();
  const [pending, setPending] = useState<RiderQuestion | null>(null);
  const [clear, setClear] = useState(false); // asked, and no question waits: the rating may ask now
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (pending) return;
    let live = true;
    check().then((q) => {
      if (!live) return;
      if (q) setPending(q);
      setClear(!q);
    });
    return () => { live = false; };
  }, [path, pending, round]);

  const done = (id: number, r: QuestionDone) => {
    if (r === "later") passed.add(id);
    try { sessionStorage.removeItem(KEY); } catch { /* */ }
    setPending(null);
    setClear(false);
    setRound((n) => n + 1);
  };

  if (pending) return <QuestionGate key={`${pending.id}-${round}`} {...pending} onDone={(r) => done(pending.id, r)} />;
  return clear ? <RatingGateLoader locale={locale} /> : null;
}
