"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import RatingGateLoader from "./RatingGateLoader";
import WaiverGate, { type PendingWaiver, type WaiverDone } from "./WaiverGate";

// A desk-added booking's waiver on every page (the owner, 2026-10-04), before the post-ride rating:
// the booking app asks for every waiver first and the rating after (_forceRatingPrompt), so this
// loader holds the rating's (RatingGateLoader) until it has asked and nothing waits, and takes it
// down again while a waiver is up. As the rating does, it asks /api/account/pending-waiver, which
// answers a signed-out visitor from the cookie alone: a signed-out answer is asked again on the next
// page, a signed-in "nothing to agree" is kept for two minutes in this tab (shorter than the
// rating's ten: staff add a rider at the desk while they stand there), and a ride waiting puts up
// the pop-up the rider cannot skip. Once it is agreed, the next ride (or nothing) is asked for at once.
const KEY = "mm_waiver_none";
const QUIET_MS = 2 * 60_000;
// For this page load: the rides agreed to (never asked again, even if the database did not stamp
// them), and whether the database cannot record an answer yet (the function is missing until the
// migration is applied): then nobody is held, and the gate stays down until the page is loaded again.
const agreed = new Set<string>();
let off = false;

async function check(locale: string): Promise<PendingWaiver | null> {
  if (off) return null;
  try { if (Number(sessionStorage.getItem(KEY) || 0) > Date.now()) return null; } catch { /* storage off: just ask */ }
  try {
    const skip = agreed.size ? `&skip=${encodeURIComponent([...agreed].join(","))}` : "";
    const r = await fetch(`/api/account/pending-waiver?locale=${encodeURIComponent(locale)}${skip}`, { cache: "no-store", credentials: "same-origin" });
    if (!r.ok) return null;
    const b = (await r.json()) as { signedIn?: boolean; pending?: PendingWaiver | null };
    try {
      if (b.signedIn && !b.pending) sessionStorage.setItem(KEY, String(Date.now() + QUIET_MS));
      else sessionStorage.removeItem(KEY);
    } catch { /* */ }
    return b.pending ?? null;
  } catch { return null; } // offline: the next page asks again
}

export default function WaiverGateLoader({ locale }: { locale: string }) {
  const path = usePathname();
  const [pending, setPending] = useState<PendingWaiver | null>(null);
  const [clear, setClear] = useState(false); // asked, and no waiver waits: the rating may ask now
  const [round, setRound] = useState(0); // bumped once a waiver lands, to ask for the next ride

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

  const done = (sessionId: string, r: WaiverDone) => {
    if (r !== "stale") agreed.add(sessionId);
    if (r === "absent") off = true;
    try { sessionStorage.removeItem(KEY); } catch { /* */ }
    setPending(null);
    setClear(false); // the rating waits until the next ride's waiver has been asked for
    setRound((n) => n + 1);
  };

  if (pending) return <WaiverGate key={`${pending.sessionId}-${round}`} {...pending} onDone={(r) => done(pending.sessionId, r)} />;
  return clear ? <RatingGateLoader locale={locale} /> : null;
}
