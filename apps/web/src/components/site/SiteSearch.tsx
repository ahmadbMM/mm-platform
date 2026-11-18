"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useDialogFocus } from "@/components/site/use-dialog-focus";
import { NAV_LINKS } from "@/lib/links";
import { useL, useLocalize } from "@/i18n/TxProvider";
import { localeInfo } from "@/i18n/locales";
import { phrase } from "@/i18n/tx";
import { searchIndex, type SearchItem } from "@/app/[locale]/search-index";
import { ArrowIcon, BackIcon, CloseIcon } from "@/components/site/Icons";
import { Amt } from "@/components/store/bits";
import BidiText from "@/components/store/BidiText";
import { T as W1 } from "@/components/store/w1.text";
import { findProducts, holds } from "@/lib/sx-B1-search";

// The header's search (SiteNav.dc.html): finds this site's pages by their names - in English,
// Arabic and the page's language - and by what they are about, and, below them, the answers and
// articles whose words match (app/[locale]/search-index.ts, asked for once when search opens).
// Pages staff have switched off are not offered. The store build (2026-11-15): the Returns and Complaints pages (L12),
// and, while the site's own store is open, its category pages and products in a group of their own, each product with its
// price and stock (O06-B).
// On every screen (the user, 2026-11-18: "do all", SM11-B, P23, N26): on a phone the search is a page of its own over the
// whole screen, with its own Back at the start (a computer keeps the panel under the header with its close button); the
// products are found the way a shopper types (lib/sx-B1-search.ts: Arabic written any of its ways, Arabic and English
// words for one thing, a slip of the finger), the pages and the answers by their letters read the same forgiving way.
const EXTRA = [
  { key: "privacy", href: "/privacy", ...phrase("Privacy Notice", "إشعار الخصوصية") },
  { key: "account", href: "/account", ...phrase("Account", "الحساب") },
  { key: "terms", href: "/terms", ...phrase("Terms & Conditions", "الشروط والأحكام") },
  { key: "returns", href: "/returns", en: W1.en.returnsTitle, ar: W1.ar.returnsTitle },
  { key: "complaints", href: "/complaints", en: W1.en.complaints, ar: W1.ar.complaints },
];
const WORDS: Record<string, string> = {
  store: "shop buy bikes accessories helmet gear متجر شراء دراجات إكسسوارات",
  bikes: "catalogue catalog models specs specifications road mountain hybrid gravel kids carbon موديلات مواصفات طريق جبلية هجينة أطفال",
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
  testimonials: "reviews ratings stars opinions what riders say شهادات آراء تقييمات نجوم",
  privacy: "data policy personal بيانات خصوصية",
  account: "sign in login bookings profile تسجيل الدخول حجوزاتي حساب",
  terms: "conditions rules legal policy returns refund الشروط الأحكام سياسة استرجاع",
  returns: "return returns refund exchange money back policy إرجاع استرجاع استبدال استرداد سياسة",
  complaints: "complaint complain problem issue wrong report شكوى شكاوى مشكلة بلاغ",
};
const MAX_PRODUCTS = 6;
const inStore = (x: SearchItem) => x.href === "/store" || x.href.startsWith("/store/");
const MAX_ITEMS = 8;
const snippet = (text: string, needle: string) => {
  const t = text.replace(/\s+/g, " ").trim();
  const i = needle ? t.toLowerCase().indexOf(needle) : -1;
  const start = i > 40 ? i - 40 : 0;
  const s = t.slice(start, start + 120);
  return (start ? "…" : "") + s + (start + 120 < t.length ? "…" : "");
};

// back: the button that opened the search, which takes the focus again when it closes.
export default function SiteSearch({ locale, hidden, onClose, back }: { locale: string; hidden: string[]; onClose: () => void; back?: RefObject<HTMLElement | null> }) {
  const tx = useL();
  const w = useLocalize(W1);
  const info = localeInfo(locale);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<SearchItem[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  useDialogFocus(box, true, { first: input, back });
  useEffect(() => {
    let gone = false;
    searchIndex(locale).then((x) => { if (!gone) setItems(x); }).catch(() => {});
    return () => { gone = true; };
  }, [locale]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  const pages = [...NAV_LINKS, ...EXTRA].filter((p) => !hidden.includes(p.key));
  const needle = q.trim().toLowerCase();
  const found = needle ? pages.filter((p) => holds(`${p.en} ${p.ar} ${tx(p.en, p.ar)} ${WORDS[p.key] ?? ""}`, needle)) : pages;
  const products = findProducts(items.filter(inStore), q).slice(0, MAX_PRODUCTS);
  const answers = needle.length > 1 ? items.filter((x) => !inStore(x) && holds(`${x.title} ${x.text} ${x.words ?? ""}`, needle)).slice(0, MAX_ITEMS) : [];
  return (
    <div ref={box} className="mm-search" role="dialog" aria-modal="true" aria-label={tx("Search", "بحث")} dir={info.dir}>
      <div className="mm-search-box">
        <div className="mm-search-row">
          <button type="button" className="mm-search-back" onClick={onClose} aria-label={tx("Back", "رجوع")}><BackIcon size={22} /></button>
          <svg className="mm-search-mag" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.8-3.8" /></svg>
          <input ref={input} enterKeyHint="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Search the site", "ابحث في الموقع")} aria-label={tx("Search the site", "ابحث في الموقع")} />
          <button type="button" className="mm-search-x" onClick={onClose} aria-label={tx("Close", "إغلاق")}><CloseIcon size={20} /></button>
        </div>
        <div className="mm-search-list">
          {found.length === 0 && answers.length === 0 && products.length === 0 ? <p>{tx("Nothing found.", "لا نتائج.")}</p> : found.map((p) => (
            <a key={p.key} href={p.href} onClick={onClose}>{tx(p.en, p.ar)}<ArrowIcon size={16} /></a>
          ))}
          {products.length > 0 && (
            <>
              <p className="mm-search-h">{w.products}</p>
              {products.map((x) => (
                <a key={x.href} href={x.href} onClick={onClose} className="mm-search-item">
                  <span>
                    <strong><BidiText text={x.title} locale={locale} /></strong>
                    {x.price ? (
                      <span className="mm-search-facts"><Amt>{x.price}</Amt>{x.stock && <small className={x.out ? "is-out" : undefined}>{x.stock}</small>}</span>
                    ) : x.text && <small>{x.text}</small>}
                  </span>
                  <ArrowIcon size={16} />
                </a>
              ))}
            </>
          )}
          {answers.length > 0 && (
            <>
              <p className="mm-search-h">{tx("Answers and articles", "إجابات ومقالات")}</p>
              {answers.map((x, i) => (
                <a key={x.href + i} href={x.href} onClick={onClose} className="mm-search-item">
                  <span><strong>{x.title}</strong>{x.text && <small>{snippet(x.text, needle)}</small>}</span>
                  <ArrowIcon size={16} />
                </a>
              ))}
            </>
          )}
        </div>
      </div>
      <button type="button" className="mm-search-scrim" aria-label={tx("Close", "إغلاق")} onClick={onClose} />
    </div>
  );
}
