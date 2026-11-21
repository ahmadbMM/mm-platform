"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import RatingGate from "./RatingGate";
import FixGateLoader from "./FixGateLoader";
import { RATE_QUIET, BUSY, BUSY_RETRY_MS, isQuiet } from "./quiet";
import type { RatingForm as Form } from "@/lib/rating";

// The post-ride rating on every page (the owner, 2026-10-03: "open whenever a customer opens the
// website or signs in immediately"). The account cookie is HttpOnly, so the page cannot tell who is
// signed in; it asks /api/account/pending-rating, which answers a signed-out visitor from the cookie
// alone. A signed-out answer is asked again on the next page (signing in lands on one), a signed-in
// "nothing to rate" is kept for ten minutes in this tab, and a ride to rate puts up the pop-up the
// rider cannot skip. Once it is rated, the next waiting ride (or nothing) is asked for at once.
// It waits for any waiver a desk-added booking still needs, and for a Run for Her runner's agreement
// to share their details: WaiverGateLoader mounts ShareGateLoader once no waiver waits, and that
// mounts this once no run waits either.
// The ten quiet minutes are the signed-in account's: every sign-in and sign-out forgets them (./quiet.ts).
// With no ride to rate (or none known: signed out, a quiet window), the details the account owes come next (FixGateLoader,
// the booking app's 3ebaf706), and then the one-time ask about an old comment (TestimonialAskLoader, testimonials
// 2026-11-18); both ask only a signed-in rider.
// `restaurant` (2026-10-05): where a Saturday ride's breakfast was, by name in the page's language; an
// answer from before it reads as none. `rgLow` (2026-10-09): the booking app's rg_low, the score at or
// under which the form asks why; an answer without it reads as the default.
// `about` (2026-11-18): what the booking was, for the ask to share a 9 or 10 as a testimonial (lib/testimonials.ts).
type Pending = { entryId: string; name: string; when: string; form: Form; noBike: boolean; restaurant?: string | null; rgLow?: number; run?: boolean; session?: boolean; about?: string };
const KEY = RATE_QUIET;
const QUIET_MS = 10 * 60_000;

async function check(locale: string): Promise<Pending | typeof BUSY | null> {
  if (isQuiet(KEY)) return null;
  try {
    const r = await fetch(`/api/account/pending-rating?locale=${encodeURIComponent(locale)}`, { cache: "no-store", credentials: "same-origin" });
    if (r.status === 429) return BUSY; // the meter is full: not an answer, asked again shortly
    if (!r.ok) return null;
    const b = (await r.json()) as { signedIn?: boolean; pending?: Pending | null };
    try {
      if (b.signedIn && !b.pending) sessionStorage.setItem(KEY, String(Date.now() + QUIET_MS));
      else sessionStorage.removeItem(KEY);
    } catch { /* */ }
    return b.pending ?? null;
  } catch { return null; } // offline: the next page asks again
}

export default function RatingGateLoader({ locale }: { locale: string }) {
  const path = usePathname();
  const [pending, setPending] = useState<Pending | null>(null);
  const [round, setRound] = useState(0); // bumped once a rating lands, to ask for the next ride
  const [retry, setRetry] = useState(0); // bumped to ask again after the meter turned a check away
  const [clear, setClear] = useState(false); // asked, and no ride waits to be rated

  useEffect(() => {
    if (pending) return;
    let live = true;
    let wait: ReturnType<typeof setTimeout> | undefined;
    check(locale).then((p) => {
      if (!live) return;
      if (p === BUSY) { setClear(false); wait = setTimeout(() => setRetry((k) => k + 1), BUSY_RETRY_MS); }
      else if (p) { setClear(false); setPending(p); }
      else setClear(true);
    });
    return () => { live = false; clearTimeout(wait); };
  }, [path, locale, pending, round, retry]);

  if (!pending) return clear ? <FixGateLoader locale={locale} /> : null;
  return <RatingGate key={pending.entryId} {...pending} onDone={() => { try { sessionStorage.removeItem(KEY); } catch { /* */ } setPending(null); setRound((n) => n + 1); }} />;
}
