"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useLocalize } from "@/i18n/TxProvider";
import { giftCodeOf, giftCodeOk } from "@/lib/store-checkout";
import { sar } from "@/lib/store-core";
import { T as W } from "./w4.text";
import { T as X } from "./sx-B3.text";
import { T } from "./Store.text";
import "./sx-B3.css";

// One gift card for the store and Experiences (N20, 2026-11-18; staff switch store.giftCardWallet.on, OFF until the
// accountant answers on a gift card's VAT): a store gift card's balance moved into the account's wallet, which already
// pays Saturday rides, lessons and lockers on the payment page and gives refunds back to it. On My Account's wallet.
export default function GiftToWallet() {
  const t = useLocalize(T);
  const w = useLocalize(W);
  const x = useLocalize(X);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function go(e: React.FormEvent) {
    e.preventDefault();
    const code = giftCodeOf(raw);
    if (!giftCodeOk(code)) { setMsg({ ok: false, text: w.checks.gift }); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/store/gift-card/wallet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
      const b = (await r.json().catch(() => ({}))) as { ok?: boolean; amount?: number; error?: string };
      if (b.ok && typeof b.amount === "number") { setMsg({ ok: true, text: x.giftWalletDone(sar(b.amount)) }); setRaw(""); router.refresh(); }
      else setMsg({ ok: false, text: x.checks[b.error ?? ""] ?? w.checks[b.error ?? ""] ?? x.checks.gift_wallet });
    } catch {
      setMsg({ ok: false, text: t.errs.network });
    }
    setBusy(false);
  }
  if (!open) return <button type="button" className="bk-btn2 sx3-gw-open" onClick={() => setOpen(true)}>{x.giftWallet}</button>;
  return (
    <form className="sx3-gw" onSubmit={go} noValidate>
      <div className="bk-field">
        <label htmlFor="sx3-gw-code">{w.giftCode}</label>
        <input id="sx3-gw-code" value={raw} onChange={(e) => setRaw(e.target.value)} dir="ltr" autoComplete="off" autoCapitalize="characters" maxLength={20} />
      </div>
      <button type="submit" className="bk-btn" disabled={busy} aria-busy={busy}>{x.giftWalletGo}</button>
      {msg && <p className={msg.ok ? "sx3-gw-ok" : "bk-ferr"} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}
    </form>
  );
}
