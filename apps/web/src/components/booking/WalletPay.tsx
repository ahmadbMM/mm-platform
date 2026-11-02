"use client";

import { useState } from "react";
import type { WalletWords } from "@/components/account/Wallet.words";

// Pay a ticket from the wallet (the booking app's _cwPay): the button asks once, in place, what will be left; the
// answer draws the page again, so the ticket and the balance read what the server now holds. Words and amounts come
// ready from the ticket (TicketCard).
export default function WalletPay({ ids, label, ask, t }: { ids: string[]; label: string; ask: string; t: Pick<WalletWords, "go" | "cancel" | "failed"> }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function pay() {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/account/wallet-pay", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids }),
      });
      const b = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (b?.ok || b?.error === "signin" || b?.error === "short" || b?.error === "refused") { window.location.reload(); return; }
      setErr(t.failed);
    } catch { setErr(t.failed); }
    setBusy(false);
  }

  if (!asking) return <button type="button" className="tk-btn tk-wallet-pay" onClick={() => setAsking(true)}>{label}</button>;
  return (
    <div className="tk-wallet-ask" role="group" aria-label={ask}>
      <p className="tk-line">{ask}</p>
      <div className="tk-wallet-acts">
        <button type="button" className="tk-btn" disabled={busy} onClick={() => setAsking(false)}>{t.cancel}</button>
        <button type="button" className="tk-btn tk-wallet-pay" disabled={busy} onClick={pay}>{t.go}</button>
      </div>
      {err && <p className="tk-line" role="alert">{err}</p>}
    </div>
  );
}
