"use client";

import "./rating.css";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import TestimonialAskLoader from "./TestimonialAskLoader";
import { fixGateWords } from "./FixGate.words";
import { BUSY, BUSY_RETRY_MS, FIX_QUIET, isQuiet, signOut } from "./quiet";

// Details an account owes always open as a pop-up the rider cannot skip (the booking app's 3ebaf706, the user 2026-11-10:
// "any details or info requested from an account show it as an unskippable pop up, and when showing an error add a button
// that directs to the missing info"): what staff asked the rider to correct, and what the server asks for itself
// (customer_fix_fields through /api/account/pending-fix). The booking app's check-up asks every one of them, so the
// pop-up is the app's own for an ask a page has no box for (its _fixOldHtml): Account check-up, A few details for your
// account, Add details - the booking app signed in (/api/account/app-signin), where the check-up opens at once - and Log
// out, the only other way off. No close, no backdrop, no Escape; the rest of the page is inert while it is up.
// It comes once no other pop-up waits (RatingGateLoader mounts it once no ride waits to be rated); nothing owed is kept
// ten minutes in this tab (quiet.ts), and with nothing owed the one-time ask about an old comment may follow.
const QUIET_MS = 10 * 60_000;

async function check(): Promise<number | typeof BUSY | null> {
  if (isQuiet(FIX_QUIET)) return 0;
  try {
    const r = await fetch("/api/account/pending-fix", { cache: "no-store", credentials: "same-origin" });
    if (r.status === 429) return BUSY;
    if (!r.ok) return null;
    const b = (await r.json()) as { signedIn?: boolean; owed?: number };
    if (!b.signedIn) return 0;
    const n = Number(b.owed) || 0;
    try { if (!n) sessionStorage.setItem(FIX_QUIET, String(Date.now() + QUIET_MS)); else sessionStorage.removeItem(FIX_QUIET); } catch { /* storage off */ }
    return n;
  } catch { return null; } // offline: the next page asks again
}

export default function FixGateLoader({ locale }: { locale: string }) {
  const path = usePathname();
  const [owed, setOwed] = useState<number | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true, wait: ReturnType<typeof setTimeout> | undefined;
    check().then((n) => {
      if (!live) return;
      if (n === BUSY) { setOwed(null); wait = setTimeout(() => setRetry((k) => k + 1), BUSY_RETRY_MS); }
      else setOwed(n);
    });
    return () => { live = false; clearTimeout(wait); };
  }, [path, retry]);
  if (owed === null) return null;
  return owed > 0 ? <FixGate locale={locale} /> : <TestimonialAskLoader locale={locale} />;
}

function FixGate({ locale }: { locale: string }) {
  const w = fixGateWords(locale);
  const box = useRef<HTMLDivElement>(null);
  const [out, setOut] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const made: Element[] = [];
    for (let n: Element | null = el.closest(".rg-gate"); n && n !== document.body; n = n.parentElement) {
      for (const sib of Array.from(n.parentElement?.children ?? [])) {
        if (sib !== n && !sib.hasAttribute("inert") && sib.tagName !== "SCRIPT") { sib.setAttribute("inert", ""); made.push(sib); }
      }
    }
    document.documentElement.classList.add("rg-lock");
    el.focus({ preventScroll: true });
    return () => { for (const sib of made) sib.removeAttribute("inert"); document.documentElement.classList.remove("rg-lock"); };
  }, []);
  return (
    <div className="rg-gate">
      <div ref={box} className="rg-box fx-gate" role="dialog" aria-modal="true" aria-labelledby="fx-gate-h" tabIndex={-1}>
        <p className="rg-kicker">
          <span className="rg-flag" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5.4 21V3.8M5.4 4.4h11.8l-2.4 4 2.4 4H5.4" /></svg>
          </span>
          {w.kicker}
        </p>
        <h2 id="fx-gate-h" className="rg-title">{w.title}</h2>
        <a className="rr-send fx-gate-go" href={`/api/account/app-signin?lang=${encodeURIComponent(locale)}`}>{w.add}</a>
        <button type="button" className="rg-out" onClick={() => { setOut(true); signOut(); }} disabled={out}>{w.logOut}</button>
      </div>
    </div>
  );
}
