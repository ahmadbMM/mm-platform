"use client";

import { useEffect, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { BOOKING_URL, NAV_LINKS, pick } from "@/lib/links";

// The header from SiteNav.dc.html: logo, the site's sections in the middle, language and
// account on the end; below 900px the sections open as a full-height dark sheet.
export default function SiteNav({ locale }: { locale: string }) {
  const ar = locale === "ar";
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [open]);
  const other = ar ? "en" : "ar";
  return (
    <>
      <a href="#mm-main" className="mm-skip">{ar ? "انتقل إلى المحتوى" : "Skip to content"}</a>
      <header className="mm-nav" dir={ar ? "rtl" : "ltr"}>
        <Link href="/" className="mm-nav-logo" aria-label="Micromobility">
          <img src="/site/logo-mark-dark.png" alt="Micromobility" width={40} height={26} />
        </Link>
        <nav className="mm-nav-links" aria-label={ar ? "الأقسام" : "Sections"}>
          {NAV_LINKS.map((l) => l.external
            ? <a key={l.key} href={l.href}>{pick(l, locale)}</a>
            : <Link key={l.key} href={l.href} aria-current={path === l.href ? "page" : undefined}>{pick(l, locale)}</Link>)}
        </nav>
        <div className="mm-nav-end">
          <Link href={path} locale={other} className="mm-nav-lang" hrefLang={other} lang={other} aria-label={ar ? "English" : "العربية"}>
            {ar ? "EN" : "ع"}
          </Link>
          <a href={BOOKING_URL} className="mm-nav-account">{ar ? "حسابي" : "Account"}</a>
          <button type="button" className="mm-nav-burger" aria-expanded={open} aria-controls="mm-nav-sheet" aria-label={ar ? "القائمة" : "Menu"} onClick={() => setOpen((o) => !o)}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </header>
      {open && (
        <nav id="mm-nav-sheet" className="mm-nav-sheet" dir={ar ? "rtl" : "ltr"} aria-label={ar ? "الأقسام" : "Sections"}>
          {NAV_LINKS.map((l) => l.external
            ? <a key={l.key} href={l.href} onClick={() => setOpen(false)}>{pick(l, locale)}<span aria-hidden="true">{ar ? "←" : "→"}</span></a>
            : <Link key={l.key} href={l.href} onClick={() => setOpen(false)}>{pick(l, locale)}<span aria-hidden="true">{ar ? "←" : "→"}</span></Link>)}
          <a href={BOOKING_URL}>{ar ? "حسابي" : "Account"}<span aria-hidden="true">{ar ? "←" : "→"}</span></a>
        </nav>
      )}
    </>
  );
}
