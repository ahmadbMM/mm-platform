"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTxLocale } from "@/i18n/TxProvider";
import RatingForm from "./RatingForm";
import { ratingWords } from "./RatingForm.words";
import type { RatingForm as Form } from "@/lib/rating";

// The post-ride rating as a page the rider cannot skip, as the booking app shows it (2026-10-03):
// once a ride is checked out or its bike returned, the next time the rider opens My Account this
// asks them to rate it and stays up until they do - no close, no backdrop, no Escape; signing out
// is the only other way off. The rest of the page is made inert while it is up. Once the rating
// lands it thanks the rider and the page is drawn again, which brings the next unrated ride (the
// page keys this by its entry, so the next one starts empty), or nothing.
type Props = { entryId: string; name: string; when: string; form: Form; noBike: boolean };

export default function RatingGate({ entryId, name, when, form, noBike }: Props) {
  const t = ratingWords(useTxLocale());
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const [thanks, setThanks] = useState("");
  const [out, setOut] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    // Everything but this pop-up, at every level up to <body>, is made inert: no focus, no clicks.
    const made: Element[] = [];
    for (let n: Element | null = el.closest(".rg-gate"); n && n !== document.body; n = n.parentElement) {
      for (const sib of Array.from(n.parentElement?.children ?? [])) {
        if (sib !== n && !sib.hasAttribute("inert") && sib.tagName !== "SCRIPT") { sib.setAttribute("inert", ""); made.push(sib); }
      }
    }
    document.documentElement.classList.add("rg-lock");
    el.focus({ preventScroll: true });
    return () => {
      for (const sib of made) sib.removeAttribute("inert");
      document.documentElement.classList.remove("rg-lock");
    };
  }, []);

  const signOut = () => {
    setOut(true);
    fetch("/api/account", { method: "DELETE" }).finally(() => window.location.reload());
  };

  return (
    <div className="rg-gate">
      <div ref={box} className="rg-box" role="dialog" aria-modal="true" aria-labelledby={`rg-title-${entryId}`} tabIndex={-1}>
        <p className="rg-kicker">
          <span className="rg-flag" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="12" height="12"><path d="M12 2.8l2.75 5.6 6.15.9-4.45 4.33 1.05 6.12L12 16.86l-5.5 2.9 1.05-6.13L3.1 9.3l6.15-.9z" fill="currentColor" /></svg>
          </span>
          {t.kicker}
        </p>
        <h2 id={`rg-title-${entryId}`} className="rg-title">{t.title}</h2>
        <p className="rg-meta"><bdi>{name}</bdi> · <bdi>{when}</bdi></p>
        {thanks ? (
          <p className="rr-thanks" role="status">{thanks}</p>
        ) : (
          <RatingForm entryId={entryId} form={form} noBike={noBike}
            onRated={(w) => { setThanks(w.thanks); window.setTimeout(() => router.refresh(), 1200); }}
            footer={<button type="button" className="rg-out" onClick={signOut} disabled={out}>{t.signOut}</button>} />
        )}
      </div>
    </div>
  );
}
