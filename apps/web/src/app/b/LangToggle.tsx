"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { nextLang, tFor, type BikeLang } from "@/lib/bike-i18n";

/**
 * A bare globe, as the handoff asks: no pill, no border, no label. It cycles the three
 * languages, stores the choice in a cookie (so the server renders it next time) and asks
 * the server for a fresh pass — the page is language-switched without a reload.
 */
export default function LangToggle({ lang }: { lang: BikeLang }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const target = nextLang(lang);

  function switchTo() {
    // One year, lax: a display preference, never sent cross-site.
    document.cookie = `mm_lang=${target};path=/;max-age=31536000;samesite=lax`;
    start(() => router.refresh());
  }

  return (
    <button
      type="button"
      className="bk-globe"
      onClick={switchTo}
      disabled={pending}
      aria-label={`${tFor(target)("langName")}`}
      title={tFor(target)("langName")}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21C9.5 18.4 8.2 15.3 8.2 12S9.5 5.6 12 3Z" />
      </svg>
    </button>
  );
}
