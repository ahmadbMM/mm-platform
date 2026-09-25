"use client";

import { useEffect, useRef, useState } from "react";
import { normalizePhone, rpc } from "@/lib/rpc-client";
import { fmtNum } from "@/lib/fill";
import { intlOf } from "@/i18n/locales";
import { useLocalize } from "@/i18n/TxProvider";
import { T } from "./ClubCard.text";

// A member's card (club_card): the email and mobile of their Micromobility account open it.
// Credits and the tier come from their real rides. A signed-in rider's email and mobile are
// passed in (/account, /club), and the card opens by itself.
type Card = { ok: boolean; error?: string; member?: boolean; first_name?: string; since?: string | null; credits?: number; tier?: number; next?: number | null; rides?: number };
type Props = { locale: string; title: string; text: string; notMember: string; applyBtn: string; applyHref: string; tierNames: [string, string, string]; email?: string; phone?: string };

export default function ClubCard(p: Props) {
  const t = useLocalize(T);
  const [email, setEmail] = useState(p.email ?? "");
  const [phone, setPhone] = useState(p.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [card, setCard] = useState<Card | null>(null);
  const N = (n: number) => fmtNum(n, p.locale);

  async function open() {
    setErr(""); setBusy(true);
    try {
      const r = await rpc<Card>("club_card", { p_email: email.trim().toLowerCase(), p_phone: normalizePhone(phone) });
      if (r.ok) setCard(r); else setErr(t.errors[r.error || ""] || t.errors.generic);
    } catch { setErr(t.errors.generic); }
    setBusy(false);
  }

  // Opened once for a signed-in rider; a card that is not theirs to open simply shows the form.
  const auto = useRef(!!(p.email && p.phone));
  useEffect(() => {
    if (!auto.current) return;
    auto.current = false;
    const id = setTimeout(open, 0);
    return () => clearTimeout(id);
  });

  if (card && card.member) {
    const tier = card.tier ?? 0, credits = card.credits ?? 0, next = card.next ?? null;
    const pct = tier >= 2 || !next ? 100 : Math.min(100, Math.round((credits / next) * 100));
    const since = card.since ? new Intl.DateTimeFormat(intlOf(p.locale), { month: "long", year: "numeric", timeZone: "Asia/Riyadh" }).format(new Date(card.since)) : "";
    return (
      <div className="club-mine">
        <div className={`club-cardviz tier-${tier}`}>
          <div className="club-cardviz-top">
            <span className="club-cardviz-brand"><img src={tier === 2 ? "/site/logo-mark-dark.png" : "/site/logo-mark.png"} alt="Micromobility" /><span>{t.label}</span></span>
            <span className="club-pill">{p.tierNames[tier]}</span>
          </div>
          <div className="club-cardviz-bottom">
            <span className="club-cardviz-label">{t.credits}</span>
            <strong className="club-cardviz-num">{N(credits)}</strong>
            <div className="club-cardviz-foot"><strong>{card.first_name}</strong>{since && <span>{t.since} {since}</span>}</div>
          </div>
        </div>
        <span className="club-bar"><span style={{ width: `${pct}%` }} /></span>
        <p className="club-mine-next">{tier >= 2 || !next ? t.top : t.toNext(N(Math.max(0, next - credits)), p.tierNames[tier + 1])} · {t.rides(N(card.rides ?? 0))}</p>
        <button type="button" className="club-link" onClick={() => setCard(null)}>{t.close}</button>
      </div>
    );
  }

  return (
    <div className="club-lookup">
      {p.title && <h2>{p.title}</h2>}
      {p.text && <p>{p.text}</p>}
      <div className="club-lookup-row">
        <input className="club-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.email} aria-label={t.email} type="email" autoComplete="email" dir="ltr" maxLength={254} />
        <input className="club-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t.phone} aria-label={t.phone} inputMode="tel" autoComplete="tel" dir="ltr" maxLength={20} />
      </div>
      <button type="button" className="club-btn" onClick={open} disabled={busy || !email.trim() || !phone.trim()}>{busy ? t.opening : t.open}</button>
      {err && <p className="club-err" role="alert">{err}</p>}
      {card && !card.member && (
        <div className="club-notmember" role="status">
          <span>{p.notMember}</span>
          <a href={p.applyHref}>{p.applyBtn}</a>
        </div>
      )}
    </div>
  );
}
