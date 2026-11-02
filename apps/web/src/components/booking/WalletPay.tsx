"use client";

import { useState } from "react";

// The Wallet switch on a ticket (the booking app's _cwSwitchHtml, the owner 2026-11-03): off until the rider turns it on.
// On pays what the balance can, the rest stays to pay at the booth; off gives it back. The answer draws the page again,
// so the ticket and the balance read what the server now holds. Words and amounts come ready from TicketCard.
export default function WalletPay({ ids, on, title, sub, failed }: { ids: string[]; on: boolean; title: string; sub: string; failed: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function flip(next: boolean) {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/account/wallet-pay", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids, on: next }),
      });
      const b = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (b?.ok || b?.error === "signin" || b?.error === "short" || b?.error === "refused") { window.location.reload(); return; }
      setErr(failed);
    } catch { setErr(failed); }
    setBusy(false);
  }

  return (
    <div className="tk-wallet">
      <label className="tk-wallet-sw">
        <input type="checkbox" role="switch" checked={on} disabled={busy} onChange={(e) => flip(e.target.checked)} />
        <span className="tk-wallet-box" aria-hidden="true" />
        <span className="tk-wallet-txt"><b>{title}</b><small>{sub}</small></span>
      </label>
      {err && <p className="tk-line" role="alert">{err}</p>}
    </div>
  );
}
