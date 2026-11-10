"use client";

import { useState } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { fill } from "@/i18n/tx";
import { T } from "./Pay.text";

// "Add money" on My Account's wallet (2026-11-10): a card top-up, only while staff have pay.topup on (card-funded
// stored value needs a legal check before live). The amount goes to /api/pay/topup, which answers the payment page.

// The digits the site's keyboards type (Arabic-Indic, Persian/Urdu, Devanagari, Bengali) as 0-9, as every other
// number box on the site reads them (lib/account-shared.ts).
const DIGITS = /[٠-٩۰-۹०-९০-৯]/g;
const ascii = (s: string) => s.replace(DIGITS, (c) => {
  const n = c.charCodeAt(0);
  return String(n - (n >= 0x09e6 ? 0x09e6 : n >= 0x0966 ? 0x0966 : n >= 0x06f0 ? 0x06f0 : 0x0660));
});

export default function WalletTopUp({ min, max, locale }: { min: number; max: number; locale: string }) {
  const t = useLocalize(T).topup;
  const [open, setOpen] = useState(false);
  const [amt, setAmt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const presets = [50, 100, 200].filter((n) => n >= min && n <= max);
  const n = Number(ascii(amt));
  const ok = Number.isInteger(n) && n >= min && n <= max;
  async function go() {
    if (!ok || busy) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/pay/topup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amount: n, lang: locale }) });
      const b = (await r.json().catch(() => null)) as { ok?: boolean; url?: string } | null;
      if (b?.ok && b.url && /^\/pay\/[0-9a-f-]{36}$/.test(b.url)) { window.location.assign(b.url); return; }
      setErr(t.failed);
    } catch { setErr(t.failed); }
    setBusy(false);
  }
  if (!open) return <button type="button" className="ac-btn ac-btn-line" onClick={() => setOpen(true)}>{t.add}</button>;
  return (
    <div className="ac-topup">
      <p className="ac-text"><b>{t.title}</b></p>
      <div className="ac-topup-pre">
        {presets.map((p) => <button key={p} type="button" className={`ac-btn${n === p ? "" : " ac-btn-line"}`} aria-pressed={n === p} onClick={() => setAmt(String(p))}><bdi className="tk-amt">{`⁦⃁ ${p}⁩`}</bdi></button>)}
      </div>
      <label className="ac-topup-in">
        <span>{fill(t.amount, min, max)}</span>
        <input type="text" inputMode="numeric" dir="ltr" maxLength={5} value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9٠-٩۰-۹०-९০-৯]/g, ""))} />
      </label>
      {err && <p className="ac-text" role="alert">{err}</p>}
      <button type="button" className="ac-btn" disabled={!ok || busy} aria-busy={busy} onClick={() => void go()}>{t.go}</button>
    </div>
  );
}
