"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import ClubGate, { type PendingClub, type ClubDone } from "./ClubGate";
import RaceGateLoader from "./RaceGateLoader";
import { CLUB_QUIET, isQuiet } from "./quiet";

// The Blood Donation event's club or community question on every page, for everyone who registered before it (the owner,
// 2026-11-05: "show a forced pop-up for everyone who already registered"; the booking app's _pendingClub), after the agreement
// to share and before the Defe race question and the rating. It asks as ShareGateLoader does: a signed-in "nothing to answer"
// is kept for two minutes in this tab (./quiet.ts forgets it at every sign-in and sign-out).
const QUIET_MS = 2 * 60_000;
// For this page load: the sessions answered (never asked again, even if the database did not record it), and whether the
// database cannot record an answer yet: then nobody is held until the page is loaded again.
const answered = new Set<string>();
let off = false;

async function check(locale: string): Promise<PendingClub | null> {
  if (off) return null;
  if (isQuiet(CLUB_QUIET)) return null;
  try {
    const skip = answered.size ? `&skip=${encodeURIComponent([...answered].join(","))}` : "";
    const r = await fetch(`/api/account/pending-club?locale=${encodeURIComponent(locale)}${skip}`, { cache: "no-store", credentials: "same-origin" });
    if (!r.ok) return null;
    const b = (await r.json()) as { signedIn?: boolean; pending?: PendingClub | null };
    try {
      if (b.signedIn && !b.pending) sessionStorage.setItem(CLUB_QUIET, String(Date.now() + QUIET_MS));
      else sessionStorage.removeItem(CLUB_QUIET);
    } catch { /* */ }
    return b.pending ?? null;
  } catch { return null; } // offline: the next page asks again
}

export default function ClubGateLoader({ locale }: { locale: string }) {
  const path = usePathname();
  const [pending, setPending] = useState<PendingClub | null>(null);
  const [clear, setClear] = useState(false); // asked, and nothing waits: the next pop-ups may ask now
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

  const done = (sessionId: string, r: ClubDone) => {
    answered.add(sessionId);
    if (r === "absent") off = true;
    try { sessionStorage.removeItem(CLUB_QUIET); } catch { /* */ }
    setPending(null);
    setClear(false);
    setRound((n) => n + 1);
  };

  if (pending) return <ClubGate key={`${pending.sessionId}-${round}`} {...pending} onDone={(r) => done(pending.sessionId, r)} />;
  return clear ? <RaceGateLoader locale={locale} /> : null;
}
