"use client";

import { useEffect, useState } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { Link } from "@/i18n/navigation";
import { giftLink, shortDay, waLink } from "@/lib/sx-b6";
import { T } from "./sx-B6.text";
import "./sx-B6.css";

// The payment page once a gift or a pack is paid (EF20, EF21; the user, 2026-11-18: "do all"): the gift's link to send on
// WhatsApp or copy (R5: never an email or a text message; the link is the gift), or the pack's sessions and until when,
// with Book. The code is read from the rider's own purchases (/api/xp/mine); the database issues it as the payment
// settles, so a page drawn a moment early asks again a few times.
type Item = { what: string; code: string | null; for_name: string | null; payment_id: string | null; lessons: number; left: number; expires_on: string | null; title_en?: string | null; title_ar?: string | null };

export default function XpPaid({ payId, locale }: { payId: string; locale: string }) {
  const t = useLocalize(T);
  const [it, setIt] = useState<Item | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let live = true, tries = 0;
    const ask = () => fetch("/api/xp/mine", { cache: "no-store" }).then((r) => r.json()).then((b: { items?: Item[] }) => {
      const x = (b.items ?? []).find((y) => y.payment_id === payId && y.code);
      if (!live) return;
      if (x) setIt(x);
      else if (++tries < 4) setTimeout(ask, 1500);
    }, () => { /* the page stays as it is */ });
    ask();
    return () => { live = false; };
  }, [payId]);
  if (!it || !it.code) return null;
  if (it.what === "pack") {
    const title = (locale === "ar" && it.title_ar) || it.title_en || "";
    return (
      <div className="sx6-after">
        <p className="sx6-until">{[title, t.packLessons(it.lessons), it.expires_on ? t.packUntil(shortDay(it.expires_on, locale)) : ""].filter(Boolean).join(" · ")}</p>
        <div className="bk-foot"><Link className="bk-btn wide" href="/experiences#book">{t.book}</Link></div>
      </div>
    );
  }
  const link = giftLink(window.location.origin, locale, it.code);
  if (!link) return null;
  const msg = t.giftMsg(it.for_name || "", link).replace(/^,\s*|^،\s*/, "");
  return (
    <div className="sx6-after">
      <p className="sx6-until">{t.giftReady}</p>
      <p className="sx6-link"><bdi dir="ltr">{link}</bdi></p>
      <div className="sx6-manage">
        <a className="bk-btn" href={waLink(msg)} target="_blank" rel="noopener">{t.giftSend}</a>
        <button type="button" className="bk-btn2" onClick={() => { void navigator.clipboard?.writeText(link).then(() => setCopied(true), () => {}); }}>{copied ? t.giftCopied : t.giftCopy}</button>
      </div>
    </div>
  );
}
