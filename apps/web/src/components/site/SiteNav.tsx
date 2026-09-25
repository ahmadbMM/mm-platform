"use client";

import { useEffect, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import SiteSearch from "@/components/site/SiteSearch";
import { BOOKING_URL, NAV_LINKS, STORE_CART_URL, bookingLink, pick } from "@/lib/links";

// The header from SiteNav.dc.html: logo, the site's sections in the middle, and the design's
// round icons on the end - search, language, account and the cart (the Salla store's cart);
// below 1000px the sections open as a full-height dark sheet.
export default function SiteNav({ locale, hidden = [] }: { locale: string; hidden?: string[] }) {
  const ar = locale === "ar";
  const links = NAV_LINKS.filter((l) => !l.footer && !hidden.includes(l.key));
  // The account page, once staff switch it on; until then the booking app's own account.
  const accountHref = hidden.includes("account") ? bookingLink(BOOKING_URL, locale) : null;
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(false);
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
          {links.map((l) => l.external
            ? <a key={l.key} href={l.href}>{pick(l, locale)}</a>
            : <Link key={l.key} href={l.href} aria-current={path === l.href ? "page" : undefined}>{pick(l, locale)}</Link>)}
        </nav>
        <div className="mm-nav-end">
          <button type="button" className="mm-nav-icon" title={ar ? "بحث" : "Search"} aria-label={ar ? "بحث" : "Search"} onClick={() => setSearch(true)}>
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.8-3.8" /></svg>
          </button>
          <Link href={path} locale={other} className="mm-nav-icon mm-nav-globe" hrefLang={other} title={ar ? "English" : "العربية"} aria-label={ar ? "English" : "العربية"}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" /><path d="M3 12h18" />
              <g className="mm-globe-spin"><path d="M12 3a14.5 14.5 0 0 1 0 18a14.5 14.5 0 0 1 0-18" /><path d="M12 3a14.5 14.5 0 0 0 0 18" /><ellipse cx="12" cy="12" rx="4.2" ry="9" /></g>
            </svg>
          </Link>
          {(() => {
            const icon = <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="8" r="3.6" /><path d="M5 20c1.4-3.6 4.4-5.4 7-5.4s5.6 1.8 7 5.4" /></svg>;
            const label = ar ? "حسابي" : "My Account";
            return accountHref
              ? <a href={accountHref} className="mm-nav-icon" title={label} aria-label={label}>{icon}</a>
              : <Link href="/account" className="mm-nav-icon" title={label} aria-label={label}>{icon}</Link>;
          })()}
          <a href={STORE_CART_URL} className="mm-nav-icon" title={ar ? "السلة" : "Cart"} aria-label={ar ? "السلة" : "Cart"}>
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M5.5 8.5h13L17.4 20a1.5 1.5 0 0 1-1.5 1.3H8.1A1.5 1.5 0 0 1 6.6 20L5.5 8.5z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></svg>
          </a>
          <button type="button" className="mm-nav-burger" aria-expanded={open} aria-controls="mm-nav-sheet" aria-label={ar ? "القائمة" : "Menu"} onClick={() => setOpen((o) => !o)}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </header>
      {search && <SiteSearch locale={locale} hidden={hidden} onClose={() => setSearch(false)} />}
      {open && (
        <nav id="mm-nav-sheet" className="mm-nav-sheet" dir={ar ? "rtl" : "ltr"} aria-label={ar ? "الأقسام" : "Sections"}>
          {links.map((l) => l.external
            ? <a key={l.key} href={l.href} onClick={() => setOpen(false)}>{pick(l, locale)}<span aria-hidden="true">{ar ? "←" : "→"}</span></a>
            : <Link key={l.key} href={l.href} onClick={() => setOpen(false)}>{pick(l, locale)}<span aria-hidden="true">{ar ? "←" : "→"}</span></Link>)}
          {accountHref ? <a href={accountHref}>{ar ? "حسابي" : "Account"}<span aria-hidden="true">{ar ? "←" : "→"}</span></a> : <Link href="/account" onClick={() => setOpen(false)}>{ar ? "حسابي" : "Account"}<span aria-hidden="true">{ar ? "←" : "→"}</span></Link>}
        </nav>
      )}
    </>
  );
}
