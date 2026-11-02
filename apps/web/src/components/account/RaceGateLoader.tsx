"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import RatingGateLoader from "./RatingGateLoader";
import RaceGate, { type PendingRaceReg, type RaceRegDone } from "./RaceGate";
import { RACE_QUIET } from "./quiet";

// A DEFE 5KM Run runner's "Have you registered for the race?" on every page (the owner, 2026-10-18; the
// booking app's _forceRaceRegPrompt), between the run agreement and the post-ride rating: ShareGateLoader
// mounts this once no run waits for agreement, and this holds the rating's (RatingGateLoader) until it
// has asked and no place waits. It asks /api/account/pending-race-reg, which answers a signed-out visitor
// from the cookie alone; a signed-in "nothing to answer" is kept two minutes in this tab (./quiet.ts), and
// a place waiting puts up the pop-up the runner cannot skip. Yes, or Done after No, asks for the next
// place (or nothing) at once; a place passed with Done is not asked again until the page is loaded again.
const KEY = RACE_QUIET;
const QUIET_MS = 2 * 60_000;
const passed = new Set<string>();

async function check(locale: string): Promise<PendingRaceReg | null> {
  try { if (Number(sessionStorage.getItem(KEY) || 0) > Date.now()) return null; } catch { /* storage off: just ask */ }
  try {
    const skip = passed.size ? `&skip=${encodeURIComponent([...passed].join(","))}` : "";
    const r = await fetch(`/api/account/pending-race-reg?locale=${encodeURIComponent(locale)}${skip}`, { cache: "no-store", credentials: "same-origin" });
    if (!r.ok) return null;
    const b = (await r.json()) as { signedIn?: boolean; pending?: PendingRaceReg | null };
    try {
      if (b.signedIn && !b.pending) sessionStorage.setItem(KEY, String(Date.now() + QUIET_MS));
      else sessionStorage.removeItem(KEY);
    } catch { /* */ }
    return b.pending ?? null;
  } catch { return null; } // offline: the next page asks again
}

export default function RaceGateLoader({ locale }: { locale: string }) {
  const path = usePathname();
  const [pending, setPending] = useState<PendingRaceReg | null>(null);
  const [clear, setClear] = useState(false); // asked, and no place waits: the rating may ask now
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (pending) return;
    let live = true;
    check(locale).then((p) => {
      if (!live) return;
      if (p) setPending(p);
      setClear(!p);
    });
    return () => { live = false; };
  }, [path, locale, pending, round]);

  const done = (entryId: string, r: RaceRegDone) => {
    if (r !== "stale") passed.add(entryId);
    try { sessionStorage.removeItem(KEY); } catch { /* */ }
    setPending(null);
    setClear(false);
    setRound((n) => n + 1);
  };

  if (pending) return <RaceGate key={`${pending.entryId}-${round}`} {...pending} onDone={(r) => done(pending.entryId, r)} />;
  return clear ? <RatingGateLoader locale={locale} /> : null;
}
