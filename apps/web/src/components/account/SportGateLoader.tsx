"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { SportOption } from "@/lib/sport";
import SportGate, { type SportDone } from "./SportGate";
import WaiverGateLoader from "./WaiverGateLoader";
import { SPORT_QUIET } from "./quiet";

// Whether a Community member competes in a sport, on every page (the user, 2026-11-10: "force it on community members
// the next time they open or sign in the website"; the booking app's check-up asks it the same way). It comes after the
// emergency contact (EmergencyGateLoader holds this one until the account has its contact) and before every other
// pop-up: this loader holds the waivers (WaiverGateLoader, which holds the rest in turn) until it has asked and the
// account has answered, and takes them down again while its pop-up is up. It asks /api/account/sport, which answers a
// signed-out visitor from the cookie alone: a signed-out answer is asked again on the next page, a signed-in "nothing
// to answer" is kept for ten minutes in this tab (an answer is not taken off an account on its own), and a member who
// has not answered gets the pop-up they cannot skip. A database that cannot store an answer yet (the function is missing
// until the migration is applied) holds nobody until the page is loaded again. The ten quiet minutes are the signed-in
// account's: every sign-in and sign-out forgets them (./quiet.ts).
const KEY = SPORT_QUIET;
const QUIET_MS = 10 * 60_000;
let off = false;

// What the pop-up needs when it is up: the sports staff added to the list (the user's 74 are the site's own).
type Need = { added: SportOption[] };
async function check(): Promise<Need | null> {
  if (off) return null;
  try { if (Number(sessionStorage.getItem(KEY) || 0) > Date.now()) return null; } catch { /* storage off: just ask */ }
  try {
    const r = await fetch("/api/account/sport", { cache: "no-store", credentials: "same-origin" });
    if (!r.ok) return null;
    const b = (await r.json()) as { signedIn?: boolean; need?: boolean; absent?: boolean; options?: SportOption[] };
    if (b.absent) off = true;
    try {
      if (b.signedIn && !b.need) sessionStorage.setItem(KEY, String(Date.now() + QUIET_MS));
      else sessionStorage.removeItem(KEY);
    } catch { /* */ }
    return b.signedIn && b.need ? { added: Array.isArray(b.options) ? b.options : [] } : null;
  } catch { return null; } // offline: the next page asks again
}

export default function SportGateLoader({ locale }: { locale: string }) {
  const path = usePathname();
  const [need, setNeed] = useState<Need | null>(null);
  const [clear, setClear] = useState(false); // asked, and nothing to answer: the next pop-ups may ask now

  useEffect(() => {
    if (need) return;
    let live = true;
    check().then((n) => {
      if (!live) return;
      if (n) setNeed(n);
      setClear(!n);
    });
    return () => { live = false; };
  }, [path, need]);

  const done = (r: SportDone) => {
    if (r === "absent") off = true;
    try { sessionStorage.setItem(KEY, String(Date.now() + QUIET_MS)); } catch { /* */ }
    setNeed(null);
    setClear(true);
  };

  if (need) return <SportGate added={need.added} onDone={done} />;
  return clear ? <WaiverGateLoader locale={locale} /> : null;
}
