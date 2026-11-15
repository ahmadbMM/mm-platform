"use client";

import "./birthday.css";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useL } from "@/i18n/TxProvider";
import { isAskScreen } from "@/lib/ask";
import { riyadhDay } from "@/lib/birthday";
import { BDAY_SEEN, isQuiet } from "./quiet";

// The birthday week on every page (the user, 2026-11-15: "in birthday week of the customer make the screen throw
// confetti from the top to the bottom of the page everytime he opens the website"; the booking app's _bdfx does the
// same). Confetti falls from the top of the screen out past the bottom, with a "Happy birthday, {name}!" line in the
// middle, for a signed-in account in the three days either side of its birthday (lib/birthday.ts). It plays once each
// time the site is opened - a page loaded, a sign-in (the page reloads), and the site brought back after half an hour
// away - not on every page of a visit, and never on the Ask big screen (a projector). It asks /api/account/birthday,
// which reads the account on the server: the answer is kept for the day in this tab (BDAY_SEEN, which every sign-in
// and sign-out forgets, ./quiet.ts), so the database is read once a day. Taps go through it and it is gone in a few
// seconds; with reduced motion on, the line comes alone.
const AWAY_MS = 30 * 60_000;
const COLS = ["#077A4B", "#03FF89", "#F2B43F", "#FF6B8B", "#4AA8FF", "#1A1919"];
type Seen = { day: string; on: boolean; first: string };

function kept(): Seen | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(BDAY_SEEN) || "null") as Seen | null;
    return v && typeof v.day === "string" ? v : null;
  } catch { return null; }
}

/** The first name to wish, or "" for nothing to play. */
async function look(): Promise<string> {
  isQuiet(BDAY_SEEN); // a booking-app hand-over (?handoff=done) forgets every kept answer first, as a sign-in does
  const day = riyadhDay(), k = kept();
  if (k && k.day === day) return k.on ? k.first : "";
  try {
    const r = await fetch("/api/account/birthday", { cache: "no-store", credentials: "same-origin" });
    if (!r.ok) return "";
    const b = (await r.json()) as { signedIn?: boolean; on?: boolean; day?: string; first?: string; error?: string };
    try {
      if (b.signedIn && !b.error) sessionStorage.setItem(BDAY_SEEN, JSON.stringify({ day: b.day || day, on: !!b.on, first: b.first || "" }));
      else sessionStorage.removeItem(BDAY_SEEN);
    } catch { /* storage off: asked again next time */ }
    return b.signedIn && b.on && b.first ? b.first : "";
  } catch { return ""; } // offline: the next open asks again
}

/** The confetti: a canvas over the whole screen. Every piece starts above the top edge and falls out past the bottom,
 *  swaying and turning over as paper does; the canvas goes with the last one (or after nine seconds). */
export function rain(): void {
  const cv = document.createElement("canvas"), ctx = cv.getContext?.("2d");
  if (!ctx) return;
  cv.className = "bdfx-cv";
  cv.setAttribute("aria-hidden", "true");
  document.body.appendChild(cv);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let W = 0, H = 0;
  const size = () => { W = window.innerWidth; H = window.innerHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  size();
  window.addEventListener("resize", size);
  const R = Math.random, n = Math.round(Math.min(220, Math.max(100, (W * H) / 4200)));
  const P = Array.from({ length: n }, (_, i) => {
    const k = R() < 0.22 ? 1 : R() < 0.3 ? 2 : 0, w = k === 1 ? 5 + R() * 4 : k === 2 ? 3 + R() * 1.5 : 6 + R() * 5;
    return { k, w, h: k === 2 ? 14 + R() * 10 : w * (1.3 + R() * 0.6), c: COLS[i % COLS.length], x: R() * W, y: -24 - R() * H * 0.5,
      vy: (H + 48) / (2.2 + R() * 1.6), vx: (R() - 0.5) * 40, sa: 18 + R() * 36, sw: 1.5 + R() * 2.5, rot: R() * 6.283, vr: (R() - 0.5) * 7, fl: 4 + R() * 6, ph: R() * 6.283 };
  });
  const t0 = performance.now();
  let last = t0;
  const step = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000), s = (now - t0) / 1000;
    last = now;
    ctx.clearRect(0, 0, W, H);
    let left = 0;
    for (const p of P) {
      p.y += p.vy * dt; p.x += (p.vx + Math.sin(s * p.sw + p.ph) * p.sa) * dt; p.rot += p.vr * dt;
      if (p.y > H + 30) continue;
      left++;
      if (p.y < -30) continue;
      const f = Math.cos(s * p.fl + p.ph);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, Math.abs(f) < 0.08 ? 0.08 : f); ctx.fillStyle = p.c;
      if (p.k === 1) { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, 6.283); ctx.fill(); } else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (left && s < 9) requestAnimationFrame(step);
    else { window.removeEventListener("resize", size); cv.remove(); }
  };
  requestAnimationFrame(step);
}

export default function BirthdayConfetti() {
  const tx = useL();
  const bare = isAskScreen(usePathname());
  const [play, setPlay] = useState<{ first: string; at: number } | null>(null);

  useEffect(() => {
    if (bare) return;
    let live = true, away = 0;
    const go = () => look().then((first) => { if (live && first) setPlay({ first, at: Date.now() }); });
    go();
    const vis = () => {
      if (document.visibilityState === "hidden") { away = Date.now(); return; }
      if (away && Date.now() - away >= AWAY_MS) go();
      away = 0;
    };
    document.addEventListener("visibilitychange", vis);
    return () => { live = false; document.removeEventListener("visibilitychange", vis); };
  }, [bare]);

  useEffect(() => {
    if (!play) return;
    let still = false;
    try { still = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { /* */ }
    if (!still) rain();
    const t = window.setTimeout(() => setPlay(null), 4800); // the line's 4.6s, or the timer alone with reduced motion
    return () => window.clearTimeout(t);
  }, [play]);

  if (!play || bare) return null;
  const [before, ...after] = tx("Happy birthday, {0}!", "كل عام وأنت بخير يا {0}!").split("{0}");
  return (
    <div key={play.at} className="bdfx-hi" role="status" onAnimationEnd={() => setPlay(null)}>
      <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 6.2v3.3M12 2.6c.9.9 1.2 1.7.6 2.3a.85.85 0 0 1-1.2 0c-.6-.6-.3-1.4.6-2.3ZM4.5 20.6v-8.4a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8.4M4.5 14.4c1.25.9 2.5.9 3.75 0s2.5-.9 3.75 0 2.5.9 3.75 0 2.5-.9 3.75 0M2.8 20.6h18.4" />
      </svg>
      <span>{before}<bdi>{play.first}</bdi>{after.join("")}</span>
    </div>
  );
}
