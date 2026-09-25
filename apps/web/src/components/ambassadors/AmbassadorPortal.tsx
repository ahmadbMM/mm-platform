"use client";

import { useState } from "react";
import { normalizePhone, rpc } from "@/lib/rpc-client";
import { fill, fmtNum } from "@/lib/fill";
import { intlOf } from "@/i18n/locales";
import { useLocalize } from "@/i18n/TxProvider";
import { T } from "./AmbassadorPortal.text";

// An ambassador's card (ambassador_portal): their code and the mobile they applied with open it.
// Points, the tier and what earned them come from the database; rewards are asked for here and
// handed over by the staff page (ambassador_redeem).
type Event = { at: string; context: string; points: number; status: string };
type Redemption = { at: string; item: string; points: number; status: string };
type Portal = {
  ok: boolean; error?: string; first_name?: string; code?: string; status?: string;
  earned?: number; pending?: number; uses?: number; balance?: number; tier?: number; next?: number | null;
  events?: Event[]; redemptions?: Redemption[];
};
type Props = {
  locale: string;
  title: string; text: string; share: string;
  discount: number;
  tierNames: [string, string, string];
  labels: { rental: string; workshop: string; event: string };
  rewardsTitle: string;
  // idx: the reward's place in the staff list, which ambassador_redeem counts by (rows without a
  // label in this language are left out here, so the place on screen is not it)
  rewards: { label: string; cost: number; idx: number }[];
};


export default function AmbassadorPortal(p: Props) {
  const t = useLocalize(T);
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState<Portal | null>(null);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState("");
  const N = (n: number) => fmtNum(n, p.locale);

  async function open(c = code, ph = phone) {
    setErr(""); setBusy(true);
    try {
      const r = await rpc<Portal>("ambassador_portal", { p_code: c.trim().toUpperCase(), p_phone: normalizePhone(ph) });
      if (r.ok) setData(r); else setErr(t.errors[r.error || ""] || t.errors.generic);
    } catch { setErr(t.errors.generic); }
    setBusy(false);
  }
  async function redeem(i: number) {
    setNote("");
    try {
      const r = await rpc<{ ok: boolean; error?: string }>("ambassador_redeem", { p_code: code.trim().toUpperCase(), p_phone: normalizePhone(phone), p_item: i });
      if (r.ok) { setNote(t.redeemed); await open(); } else setNote(r.error === "points" ? t.notEnough : t.errors[r.error || ""] || t.errors.generic);
    } catch { setNote(t.errors.generic); }
  }

  if (!data) {
    return (
      <div className="amb-lookup">
        <h2>{p.title}</h2>
        <p>{p.text}</p>
        <div className="amb-lookup-row">
          <input className="amb-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder={t.code} aria-label={t.code} dir="ltr" maxLength={20} autoCapitalize="characters" />
          <input className="amb-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t.phone} aria-label={t.phone} dir="ltr" inputMode="tel" maxLength={20} />
          <button type="button" className="amb-btn amb-btn-green" onClick={() => open()} disabled={busy || !code.trim() || !phone.trim()}>{busy ? t.opening : t.open}</button>
        </div>
        {err && <p className="amb-err" role="alert">{err}</p>}
      </div>
    );
  }

  const tier = data.tier ?? 0, earned = data.earned ?? 0, next = data.next ?? null;
  const pct = tier >= 2 || !next ? 100 : Math.min(100, Math.round((earned / next) * 100));
  const wa = `https://wa.me/?text=${encodeURIComponent(fill(p.share, { code: data.code || "", discount: p.discount }))}`;
  const ctx: Record<string, string> = { rental: p.labels.rental, workshop: p.labels.workshop, event: p.labels.event };
  const st: Record<string, string> = { confirmed: t.confirmed, pending: t.pendingSt, void: t.voided, requested: t.requested, given: t.given };
  const day = (iso: string) => new Intl.DateTimeFormat(intlOf(p.locale), { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Riyadh" }).format(new Date(iso));
  const ledger = [
    ...(data.events || []).map((e) => ({ at: e.at, label: ctx[e.context] || e.context, pts: e.points, status: e.status })),
    ...(data.redemptions || []).map((r) => ({ at: r.at, label: `${t.redemption} · ${r.item}`, pts: -r.points, status: r.status })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 12);
  const balance = data.balance ?? 0;
  const active = data.status === "active";
  return (
    <div className="amb-portal" role="region" aria-label={t.card}>
      <div className="amb-card">
        <div className="amb-card-top">
          <span className="amb-card-brand"><img src="/site/logo-mark.png" alt="Micromobility" /><span>{t.card}</span></span>
          <span className="amb-chip">{p.tierNames[tier]}</span>
        </div>
        <strong className="amb-card-name">{data.first_name}</strong>
        <div className="amb-card-code">
          <strong className="mm-lat">{data.code}</strong>
          <button type="button" onClick={() => { navigator.clipboard?.writeText(data.code || "").catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>{copied ? t.copied : t.copy}</button>
        </div>
        <div className="amb-card-nums">
          <div><span>{t.points}</span><strong>{N(balance)}</strong></div>
          <div><span>{t.pending}</span><strong className="dim">{N(data.pending ?? 0)}</strong></div>
          <div><span>{t.uses}</span><strong>{N(data.uses ?? 0)}</strong></div>
        </div>
        <span className="amb-bar"><span style={{ width: `${pct}%` }} /></span>
        <span className="amb-card-next">{!active ? t.paused : tier >= 2 || !next ? t.top : t.toNext(N(Math.max(0, next - earned)), p.tierNames[tier + 1])}</span>
        {active && <a className="amb-wa" href={wa} target="_blank" rel="noopener noreferrer">{t.share}</a>}
      </div>
      <div className="amb-side">
        <div className="amb-panel">
          <strong className="amb-panel-title">{t.ledger}</strong>
          {ledger.length === 0 ? <p className="amb-muted">{t.ledgerEmpty}</p> : (
            <ul className="amb-ledger">
              {ledger.map((l, i) => (
                <li key={i}>
                  <span className="amb-ledger-label">{l.label}<small>{day(l.at)}</small></span>
                  <strong className={l.pts < 0 ? "neg" : ""}>{l.pts >= 0 ? "+" : "−"}{N(Math.abs(l.pts))}</strong>
                  <span className={`amb-st ${l.status}`}>{st[l.status] || l.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {p.rewards.length > 0 && (
          <div className="amb-panel">
            <strong className="amb-panel-title">{p.rewardsTitle}</strong>
            <ul className="amb-rewards">
              {p.rewards.map((r, i) => (
                <li key={i} className={balance >= r.cost && active ? "" : "off"}>
                  <span>{r.label}</span>
                  <small>{N(r.cost)}</small>
                  <button type="button" onClick={() => redeem(r.idx)} disabled={!active || balance < r.cost}>{t.redeem}</button>
                </li>
              ))}
            </ul>
            {note && <p className="amb-note" role="status">{note}</p>}
          </div>
        )}
        <button type="button" className="amb-link" onClick={() => { setData(null); setNote(""); }}>{t.close}</button>
      </div>
    </div>
  );
}
