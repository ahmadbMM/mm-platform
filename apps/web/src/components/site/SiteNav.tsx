"use client";

import { useEffect, useRef, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import SiteSearch from "@/components/site/SiteSearch";
import { useL } from "@/i18n/TxProvider";
import { LOCALES, isRtl, localeInfo } from "@/i18n/locales";
import { BOOKING_URL, COMMUNITY, HEADER, NAV_LINKS, STORE_CART_URL, bookingLink, type NavLink } from "@/lib/links";

// The header from SiteNav.dc.html: logo, the site's sections in the middle, and the design's
// round icons on the end - search, language, account and the cart (the Salla store's cart);
// below 1080px the sections open as a full-height dark sheet. Community opens the pages its
// riders use (links.ts, COMMUNITY); the globe opens every language the site speaks.
export default function SiteNav({ locale, hidden = [] }: { locale: string; hidden?: string[] }) {
  const tx = useL();
  const rtl = isRtl(locale);
  const arrow = rtl ? "←" : "→";
  const byKey = (k: string) => NAV_LINKS.find((l) => l.key === k && !hidden.includes(l.key));
  const community = COMMUNITY.pages.map(byKey).filter((l): l is NavLink => !!l);
  // The account page, once staff switch it on; until then the booking app's own account.
  const accountHref = hidden.includes("account") ? bookingLink(BOOKING_URL, locale) : null;
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(false);
  // Which menu is open, and on which page: a menu opened on one page is shut on the next.
  type Menu = "" | "community" | "lang";
  const [opened, setOpened] = useState<{ menu: Menu; at: string }>({ menu: "", at: "" });
  const menu: Menu = opened.at === path ? opened.menu : "";
  const setMenu = (next: Menu | ((m: Menu) => Menu)) =>
    setOpened((o) => ({ menu: typeof next === "function" ? next(o.at === path ? o.menu : "") : next, at: path }));
  const bar = useRef<HTMLElement>(null);
  // A mouse opens Community by hovering, and the click that naturally follows must not shut it
  // again; a tap or the keyboard (no hover) toggles it.
  const hovering = useRef(false);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [open]);
  // A menu closes on Escape, on a click anywhere else, and when the page changes.
  useEffect(() => {
    if (!menu) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu("");
    const away = (e: MouseEvent) => { if (bar.current && !bar.current.contains(e.target as Node)) setMenu(""); };
    document.addEventListener("keydown", esc);
    document.addEventListener("mousedown", away);
    return () => { document.removeEventListener("keydown", esc); document.removeEventListener("mousedown", away); };
  }, [menu]);

  const item = (l: NavLink, onClick?: () => void, tail?: React.ReactNode) => l.external
    ? <a key={l.key} href={l.href} onClick={onClick}>{tx(l.en, l.ar)}{tail}</a>
    : <Link key={l.key} href={l.href} onClick={onClick} aria-current={path === l.href ? "page" : undefined}>{tx(l.en, l.ar)}{tail}</Link>;
  const inCommunity = community.some((l) => l.href === path);
  const here = localeInfo(locale);

  return (
    <>
      <a href="#mm-main" className="mm-skip">{tx("Skip to content", "انتقل إلى المحتوى")}</a>
      <header className="mm-nav" dir={here.dir} ref={bar}>
        <Link href="/" className="mm-nav-logo" aria-label="Micromobility">
          <img src="/site/logo-mark-dark.png" alt="Micromobility" width={40} height={26} />
        </Link>
        <nav className="mm-nav-links" aria-label={tx("Sections", "الأقسام")}>
          {HEADER.map((k) => {
            if (k !== COMMUNITY.key) { const l = byKey(k); return l ? item(l) : null; }
            if (!community.length) return null;
            return (
              <div key={k} className={`mm-nav-drop${menu === "community" ? " open" : ""}`}
                onMouseEnter={() => { hovering.current = true; setMenu("community"); }}
                onMouseLeave={() => { hovering.current = false; setMenu((m) => (m === "community" ? "" : m)); }}>
                <button type="button" aria-expanded={menu === "community"} aria-controls="mm-nav-community" aria-current={inCommunity ? "page" : undefined}
                  onClick={() => setMenu((m) => (m === "community" && !hovering.current ? "" : "community"))}>
                  {tx(COMMUNITY.en, COMMUNITY.ar)}
                  <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <div id="mm-nav-community" className="mm-nav-panel">
                  {community.map((l) => item(l, () => setMenu("")))}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="mm-nav-end">
          <button type="button" className="mm-nav-icon" title={tx("Search", "بحث")} aria-label={tx("Search", "بحث")} onClick={() => setSearch(true)}>
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.8-3.8" /></svg>
          </button>
          <div className={`mm-lang${menu === "lang" ? " open" : ""}`}>
            <button type="button" className="mm-nav-icon mm-nav-globe" aria-expanded={menu === "lang"} aria-controls="mm-lang-menu"
              title={tx("Language", "اللغة")} aria-label={`${tx("Language", "اللغة")}: ${here.name}`} onClick={() => setMenu((m) => (m === "lang" ? "" : "lang"))}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" /><path d="M3 12h18" />
                <g className="mm-globe-spin"><path d="M12 3a14.5 14.5 0 0 1 0 18a14.5 14.5 0 0 1 0-18" /><path d="M12 3a14.5 14.5 0 0 0 0 18" /><ellipse cx="12" cy="12" rx="4.2" ry="9" /></g>
              </svg>
            </button>
            {menu === "lang" && (
              <div id="mm-lang-menu" className="mm-lang-menu" role="menu" aria-label={tx("Language", "اللغة")}>
                {LOCALES.map((l) => (
                  <Link key={l.code} href={path} locale={l.code} hrefLang={l.html} role="menuitemradio"
                    aria-checked={l.code === locale} className={l.code === locale ? "on" : undefined} onClick={() => setMenu("")}>
                    <bdi lang={l.html}>{l.name}</bdi>
                  </Link>
                ))}
              </div>
            )}
          </div>
          {(() => {
            const icon = <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="8" r="3.6" /><path d="M5 20c1.4-3.6 4.4-5.4 7-5.4s5.6 1.8 7 5.4" /></svg>;
            const label = tx("My Account", "حسابي");
            return accountHref
              ? <a href={accountHref} className="mm-nav-icon" title={label} aria-label={label}>{icon}</a>
              : <Link href="/account" className="mm-nav-icon" title={label} aria-label={label}>{icon}</Link>;
          })()}
          <a href={STORE_CART_URL} className="mm-nav-icon" title={tx("Cart", "السلة")} aria-label={tx("Cart", "السلة")}>
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M5.5 8.5h13L17.4 20a1.5 1.5 0 0 1-1.5 1.3H8.1A1.5 1.5 0 0 1 6.6 20L5.5 8.5z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></svg>
          </a>
          <button type="button" className="mm-nav-burger" aria-expanded={open} aria-controls="mm-nav-sheet" aria-label={tx("Menu", "القائمة")} onClick={() => setOpen((o) => !o)}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </header>
      {search && <SiteSearch locale={locale} hidden={hidden} onClose={() => setSearch(false)} />}
      {open && (
        <nav id="mm-nav-sheet" className="mm-nav-sheet" dir={here.dir} aria-label={tx("Sections", "الأقسام")}>
          {HEADER.map((k) => {
            const close = () => setOpen(false);
            const tail = <span aria-hidden="true">{arrow}</span>;
            if (k !== COMMUNITY.key) { const l = byKey(k); return l ? item(l, close, tail) : null; }
            if (!community.length) return null;
            return (
              <div key={k} className="mm-nav-sheet-group">
                <p>{tx(COMMUNITY.en, COMMUNITY.ar)}</p>
                {community.map((l) => item(l, close, tail))}
              </div>
            );
          })}
          {accountHref
            ? <a href={accountHref}>{tx("My Account", "حسابي")}<span aria-hidden="true">{arrow}</span></a>
            : <Link href="/account" onClick={() => setOpen(false)}>{tx("My Account", "حسابي")}<span aria-hidden="true">{arrow}</span></Link>}
        </nav>
      )}
    </>
  );
}
