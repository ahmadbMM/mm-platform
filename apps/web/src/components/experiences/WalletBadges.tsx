"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { isApple } from "@/components/account/WalletButton";
import { T } from "./sx-B6.text";
import "./sx-B6.css";

// The official Wallet buttons on a ticket (EF19, EM09-B; the user, 2026-11-18: "do all"): "Add to Apple Wallet" on an
// Apple device, "Save to Google Wallet" on any other, one per device, never both. The badges are the official artwork as
// files (R1: never redrawn), in English or Arabic, under public/site/wallet/; until those files are in place a plain
// button with the same words stands in (an image that fails to load hands over to it). The passes are the booking
// app's: Apple's through /api/apple-wallet (this site adds the account's id and token from its cookie), Google's through
// /api/google-wallet, which is asked once per page whether it can make one at all (501 hides the button).
const never = () => () => {};
const useDevice = () => useSyncExternalStore(never, () => (isApple(navigator.userAgent || "") ? "apple" : "google"), () => null);
let ready: Promise<boolean> | null = null;
const googleReady = () => (ready ??= fetch("/api/google-wallet?ready", { cache: "no-store" }).then((r) => r.ok, () => { ready = null; return false; }));
/** Whether the official artwork files are in place (public/site/wallet/add-to-apple-wallet-{en,ar}.svg and
 *  save-to-google-wallet-{en,ar}.svg, downloaded from Apple's and Google's brand pages, never redrawn): true once they
 *  are, so no ticket asks for a file that is not there; until then the plain buttons stand in. */
export const WALLET_ART: Record<"apple" | "google", boolean> = { apple: false, google: false };
/** The official artwork's file for a language (Arabic where it exists, else English). */
export const badgeSrc = (which: "apple" | "google", locale: string) => `/site/wallet/${which === "apple" ? "add-to-apple-wallet" : "save-to-google-wallet"}-${locale === "ar" ? "ar" : "en"}.svg`;

export default function WalletBadges({ bookingId, groupIds, locale }: { bookingId: string; groupIds: string[]; locale: string }) {
  const t = useLocalize(T);
  const device = useDevice();
  const [gOk, setGOk] = useState(false);
  const [gone, setGone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [broken, setBroken] = useState(false); // the artwork failed to load: the plain button
  useEffect(() => {
    if (device !== "google") return;
    let live = true;
    googleReady().then((y) => { if (live) setGOk(y); });
    return () => { live = false; };
  }, [device]);
  if (!device || gone || (device === "google" && !gOk)) return null;

  async function add() {
    if (busy) return;
    setMsg(""); setBusy(true);
    try {
      if (device === "apple") {
        const r = await fetch("/api/apple-wallet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bookingId, lang: locale }) });
        if (r.status === 501) { setGone(true); return; }
        if (!r.ok || !/pkpass/.test(r.headers.get("content-type") ?? "")) { setMsg(t.passErr); return; }
        // opening the .pkpass shows iOS's own "Add to Apple Wallet" sheet (as forms/petromin does)
        const url = URL.createObjectURL(await r.blob());
        const a = document.createElement("a"); a.href = url; a.download = `booking-${bookingId.slice(0, 6)}.pkpass`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      } else {
        const r = await fetch("/api/google-wallet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bookingId, groupIds }) });
        if (r.status === 501) { setGone(true); return; }
        const b = (await r.json().catch(() => null)) as { ok?: boolean; url?: string } | null;
        if (r.ok && b?.ok && b.url) { window.location.assign(b.url); return; }
        setMsg(t.passErr);
      }
    } catch { setMsg(t.passErr); }
    finally { setBusy(false); }
  }

  const label = device === "apple" ? t.appleAdd : t.googleAdd;
  const art = WALLET_ART[device] && !broken;
  return (
    <div className="tk-wallet sx6-wallet">
      <button type="button" className={art ? "sx6-badge" : "tk-btn"} onClick={() => void add()} disabled={busy} aria-busy={busy} aria-label={label}>
        {art
          ? <img src={badgeSrc(device, locale)} alt="" height={44} onError={() => setBroken(true)} />
          : busy ? t.passBusy : label}
      </button>
      {msg && <p className="tk-wallet-msg" role="status">{msg}</p>}
    </div>
  );
}
