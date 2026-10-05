"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import RatingGate from "./RatingGate";
import { RATE_QUIET } from "./quiet";
import type { RatingForm as Form } from "@/lib/rating";

// The post-ride rating on every page (the owner, 2026-10-03: "open whenever a customer opens the
// website or signs in immediately"). The account cookie is HttpOnly, so the page cannot tell who is
// signed in; it asks /api/account/pending-rating, which answers a signed-out visitor from the cookie
// alone. A signed-out answer is asked again on the next page (signing in lands on one), a signed-in
// "nothing to rate" is kept for ten minutes in this tab, and a ride to rate puts up the pop-up the
// rider cannot skip. Once it is rated, the next waiting ride (or nothing) is asked for at once.
// It waits for any waiver a desk-added booking still needs: WaiverGateLoader mounts it once none does.
// The ten quiet minutes are the signed-in account's: every sign-in and sign-out forgets them (./quiet.ts).
// `restaurant` (2026-10-05): where a Saturday ride's breakfast was, by name in the page's language; an
// answer from before it reads as none.
type Pending = { entryId: string; name: string; when: string; form: Form; noBike: boolean; restaurant?: string | null };
const KEY = RATE_QUIET;
const QUIET_MS = 10 * 60_000;

async function check(locale: string): Promise<Pending | null> {
  try { if (Number(sessionStorage.getItem(KEY) || 0) > Date.now()) return null; } catch { /* storage off: just ask */ }
  try {
    const r = await fetch(`/api/account/pending-rating?locale=${encodeURIComponent(locale)}`, { cache: "no-store", credentials: "same-origin" });
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

  useEffect(() => {
    if (pending) return;
    let live = true;
    check(locale).then((p) => { if (live && p) setPending(p); });
    return () => { live = false; };
  }, [path, locale, pending, round]);

  if (!pending) return null;
  return <RatingGate key={pending.entryId} {...pending} onDone={() => { try { sessionStorage.removeItem(KEY); } catch { /* */ } setPending(null); setRound((n) => n + 1); }} />;
}
