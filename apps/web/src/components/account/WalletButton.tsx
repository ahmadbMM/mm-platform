"use client";

import { useState, useSyncExternalStore } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { T } from "./WalletButton.text";

// Add to Google Wallet, on a live booking's ticket, as the booking app offers it: on a device
// that is not Apple's (those get the Apple pass in the booking app), the pass is made by the
// booking app through /api/google-wallet - this site adds the account's id and token from its
// cookie - and the save link opens. A booking app not set up for Google Wallet answers 501, and
// the button goes away.
const Wallet = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M16 15h2" />
  </svg>
);

export const isApple = (ua: string) => /iPhone|iPad|iPod/.test(ua) || (/(Macintosh|Mac OS X)/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua));

// Decided in the browser: the server does not know the device, so it renders nothing and the
// browser fills the button in (an external-store read keeps the two renders consistent).
const never = () => () => {};
const useNotApple = () => useSyncExternalStore(never, () => !isApple(navigator.userAgent || ""), () => false);

export default function WalletButton({ bookingId, groupIds }: { bookingId: string; groupIds: string[] }) {
  const t = useLocalize(T);
  const device = useNotApple();
  const [hidden, setHidden] = useState(false); // the booking app is not set up for Google Wallet (501)
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  if (!device || hidden) return null;

  async function add() {
    setMsg(""); setBusy(true);
    try {
      const r = await fetch("/api/google-wallet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bookingId, groupIds }) });
      if (r.status === 501) { setHidden(true); return; }
      const b = (await r.json().catch(() => null)) as { ok?: boolean; url?: string } | null;
      if (r.ok && b?.ok && b.url) { window.location.assign(b.url); return; }
      setMsg(r.status === 409 ? t.notYet : t.err);
    } catch {
      setMsg(t.err);
    }
    setBusy(false);
  }

  return (
    <div className="tk-wallet">
      <button type="button" className="tk-btn" onClick={add} disabled={busy}><Wallet />{busy ? t.adding : t.add}</button>
      {msg && <p className="tk-wallet-msg" role="status">{msg}</p>}
    </div>
  );
}
