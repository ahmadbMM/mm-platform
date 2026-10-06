"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import RatingGateLoader from "./RatingGateLoader";
import ShareGate, { type PendingShare, type ShareDone } from "./ShareGate";
import { SHARE_QUIET } from "./quiet";

// A Run for Her runner's agreement to share their details with Sela and JYC on every page (the owner,
// 2026-10-06; the booking app's _pendingShare), between the waivers and the post-ride rating:
// WaiverGateLoader mounts this once no waiver waits, and this holds the rating's (RatingGateLoader)
// until it has asked and no run waits, and takes it down again while the pop-up is up. As the waiver
// does, it asks /api/account/pending-share, which answers a signed-out visitor from the cookie alone:
// a signed-out answer is asked again on the next page, a signed-in "nothing to agree" is kept for two
// minutes in this tab (as the waiver's: staff add a runner at the desk while they stand there), and a
// run waiting puts up the pop-up the runner cannot skip. Once it is agreed, the next run (or nothing)
// is asked for at once. The two quiet minutes are the signed-in account's: every sign-in and sign-out
// forgets them (./quiet.ts).
const KEY = SHARE_QUIET;
const QUIET_MS = 2 * 60_000;
// For this page load: the runs agreed to (never asked again, even if the database did not stamp
// them), and whether the database cannot record an answer yet (the function is missing until the
// migration is applied): then nobody is held, and the gate stays down until the page is loaded again.
const agreed = new Set<string>();
let off = false;

async function check(locale: string): Promise<PendingShare | null> {
  if (off) return null;
  try { if (Number(sessionStorage.getItem(KEY) || 0) > Date.now()) return null; } catch { /* storage off: just ask */ }
  try {
    const skip = agreed.size ? `&skip=${encodeURIComponent([...agreed].join(","))}` : "";
    const r = await fetch(`/api/account/pending-share?locale=${encodeURIComponent(locale)}${skip}`, { cache: "no-store", credentials: "same-origin" });
    if (!r.ok) return null;
    const b = (await r.json()) as { signedIn?: boolean; pending?: PendingShare | null };
    try {
      if (b.signedIn && !b.pending) sessionStorage.setItem(KEY, String(Date.now() + QUIET_MS));
      else sessionStorage.removeItem(KEY);
    } catch { /* */ }
    return b.pending ?? null;
  } catch { return null; } // offline: the next page asks again
}

export default function ShareGateLoader({ locale }: { locale: string }) {
  const path = usePathname();
  const [pending, setPending] = useState<PendingShare | null>(null);
  const [clear, setClear] = useState(false); // asked, and no run waits: the rating may ask now
  const [round, setRound] = useState(0); // bumped once an agreement lands, to ask for the next run

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

  const done = (sessionId: string, r: ShareDone) => {
    if (r !== "stale") agreed.add(sessionId);
    if (r === "absent") off = true;
    try { sessionStorage.removeItem(KEY); } catch { /* */ }
    setPending(null);
    setClear(false); // the rating waits until the next run has been asked for
    setRound((n) => n + 1);
  };

  if (pending) return <ShareGate key={`${pending.sessionId}-${round}`} {...pending} onDone={(r) => done(pending.sessionId, r)} />;
  return clear ? <RatingGateLoader locale={locale} /> : null;
}
