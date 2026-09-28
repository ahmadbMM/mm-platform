"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { LOCALES } from "@/i18n/locales";
import { LANG_COOKIE } from "@/i18n/routing";

/**
 * A bare globe, as the handoff asks: no pill, no border, no label. It opens every language the
 * site speaks, each in its own name. The choice goes in the site's own language cookie, so the
 * server renders it next time and the rest of the site follows, and the server is asked for a
 * fresh pass: the page changes language without a reload. An address that names its language
 * (?lang=, as a shared link does) is given the new one instead, since the old one would win again.
 * The fleet's tag pages use it, and the Learn to ride sign-up while the site is Coming Soon; it
 * has no look of its own (bike.css, learn.css).
 */
// One year, lax: a display preference, never sent cross-site.
function saveLang(code: string) {
  document.cookie = `${LANG_COOKIE.name}=${code};path=/;max-age=${LANG_COOKIE.maxAge};samesite=lax`;
}

export default function LangToggle({ lang, label }: { lang: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", esc);
    document.addEventListener("mousedown", away);
    return () => { document.removeEventListener("keydown", esc); document.removeEventListener("mousedown", away); };
  }, [open]);

  function pick(code: string) {
    setOpen(false);
    if (code === lang) return;
    saveLang(code);
    const url = new URL(window.location.href);
    if (!url.searchParams.has("lang")) return start(() => router.refresh());
    url.searchParams.set("lang", code);
    start(() => router.replace(url.pathname + url.search + url.hash, { scroll: false }));
  }

  return (
    <div className="bk-lang" ref={box}>
      <button
        type="button"
        className="bk-globe"
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        title={label}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21C9.5 18.4 8.2 15.3 8.2 12S9.5 5.6 12 3Z" />
        </svg>
      </button>
      {open && (
        <div className="bk-lang-menu" role="menu" aria-label={label}>
          {LOCALES.map((l) => (
            <button key={l.code} type="button" role="menuitemradio" aria-checked={l.code === lang} onClick={() => pick(l.code)}>
              <bdi lang={l.html}>{l.name}</bdi>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
