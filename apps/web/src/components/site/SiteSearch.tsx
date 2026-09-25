"use client";

import { useEffect, useRef, useState } from "react";
import { NAV_LINKS } from "@/lib/links";
import { useL } from "@/i18n/TxProvider";
import { localeInfo } from "@/i18n/locales";
import { phrase } from "@/i18n/tx";

// The header's search (SiteNav.dc.html): finds this site's pages by their names - in English,
// Arabic and the page's language - and by what they are about. Pages staff have switched off are
// not offered.
const EXTRA = [
  { key: "privacy", href: "/privacy", ...phrase("Privacy Notice", "إشعار الخصوصية") },
  { key: "account", href: "/account", ...phrase("My Account", "حسابي") },
];
const WORDS: Record<string, string> = {
  store: "shop buy bikes accessories helmet gear متجر شراء دراجات إكسسوارات",
  experiences: "rides rental rent book bike session circuit jcc sports day تأجير حجز جولة حلبة دراجة يوم الرياضة",
  workshop: "service repair maintenance fix tune صيانة إصلاح ورشة",
  club: "membership members community credits عضوية أعضاء مجتمع رصيد",
  ambassadors: "code referral points rewards رمز نقاط سفير مكافآت",
  business: "corporate company companies fleet events b2b شركات أسطول فعاليات",
  about: "contact address hours location map jobs careers team تواصل عنوان ساعات موقع وظائف فريق",
  help: "faq warranty support question returns الضمان أسئلة دعم مساعدة",
  events: "calendar dates schedule مواعيد فعاليات",
  gallery: "photos pictures صور",
  routes: "maps where to ride paths مسارات خرائط",
  journal: "blog articles news tips guides مقالات مدونة نصائح أدلة",
  privacy: "data policy personal بيانات خصوصية",
  account: "sign in login bookings profile تسجيل الدخول حجوزاتي حساب",
};

export default function SiteSearch({ locale, hidden, onClose }: { locale: string; hidden: string[]; onClose: () => void }) {
  const tx = useL();
  const info = localeInfo(locale);
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  const pages = [...NAV_LINKS, ...EXTRA].filter((p) => !hidden.includes(p.key));
  const needle = q.trim().toLowerCase();
  const found = needle ? pages.filter((p) => `${p.en} ${p.ar} ${tx(p.en, p.ar)} ${WORDS[p.key] ?? ""}`.toLowerCase().includes(needle)) : pages;
  return (
    <div className="mm-search" role="dialog" aria-modal="true" aria-label={tx("Search", "بحث")} dir={info.dir}>
      <div className="mm-search-box">
        <div className="mm-search-row">
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.8-3.8" /></svg>
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Search the site", "ابحث في الموقع")} aria-label={tx("Search the site", "ابحث في الموقع")} />
          <button type="button" onClick={onClose} aria-label={tx("Close", "إغلاق")}>×</button>
        </div>
        <div className="mm-search-list">
          {found.length === 0 ? <p>{tx("Nothing found.", "لا نتائج.")}</p> : found.map((p) => (
            <a key={p.key} href={p.href} onClick={onClose}>{tx(p.en, p.ar)}<span aria-hidden="true">{info.dir === "rtl" ? "←" : "→"}</span></a>
          ))}
        </div>
      </div>
      <button type="button" className="mm-search-scrim" aria-label={tx("Close", "إغلاق")} onClick={onClose} />
    </div>
  );
}
