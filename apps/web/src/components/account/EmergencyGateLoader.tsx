"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import EmergencyGate, { type EmDone } from "./EmergencyGate";
import WaiverGateLoader from "./WaiverGateLoader";
import { EM_QUIET } from "./quiet";

// The account's emergency contact on every page (the owner, 2026-10-07: required and unskippable for
// every customer; the booking app's check-up), before every other pop-up: this loader holds the
// waivers (WaiverGateLoader, which holds Run for Her's agreement and the post-ride rating in turn)
// until it has asked and the account has its contact, and takes them down again while its pop-up is
// up. As the waiver does, it asks /api/account/emergency, which answers a signed-out visitor from the
// cookie alone: a signed-out answer is asked again on the next page, a signed-in "has one" is kept
// for ten minutes in this tab (a contact is not taken off an account on its own), and an account
// without one puts up the pop-up the rider cannot skip. A database that cannot store a contact yet
// (the function is missing until the migration is applied) holds nobody until the page is loaded
// again. The ten quiet minutes are the signed-in account's: every sign-in and sign-out forgets them
// (./quiet.ts).
const KEY = EM_QUIET;
const QUIET_MS = 10 * 60_000;
let off = false;

type Need = { two: boolean };
async function check(): Promise<Need | null> {
  if (off) return null;
  try { if (Number(sessionStorage.getItem(KEY) || 0) > Date.now()) return null; } catch { /* storage off: just ask */ }
  try {
    const r = await fetch("/api/account/emergency", { cache: "no-store", credentials: "same-origin" });
    if (!r.ok) return null;
    const b = (await r.json()) as { signedIn?: boolean; need?: boolean; two?: boolean; absent?: boolean };
    if (b.absent) off = true;
    try {
      if (b.signedIn && !b.need) sessionStorage.setItem(KEY, String(Date.now() + QUIET_MS));
      else sessionStorage.removeItem(KEY);
    } catch { /* */ }
    return b.signedIn && b.need ? { two: b.two !== false } : null;
  } catch { return null; } // offline: the next page asks again
}

export default function EmergencyGateLoader({ locale }: { locale: string }) {
  const path = usePathname();
  const [need, setNeed] = useState<Need | null>(null);
  const [clear, setClear] = useState(false); // asked, and the account has its contact: the next pop-ups may ask now

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

  const done = (r: EmDone) => {
    if (r === "absent") off = true;
    try { sessionStorage.setItem(KEY, String(Date.now() + QUIET_MS)); } catch { /* */ }
    setNeed(null);
    setClear(true);
  };

  if (need) return <EmergencyGate two={need.two} onDone={done} />;
  return clear ? <WaiverGateLoader locale={locale} /> : null;
}
