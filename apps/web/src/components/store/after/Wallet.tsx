"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { WALLET_ART } from "@/lib/sx-B4";
import { isApple } from "@/components/account/WalletButton";
import { T } from "../sx-B4.text";
import { AfterIcon } from "./icons";

// The Wallet pickup pass (N02), on a pickup order's page: "Add to Apple Wallet" on Apple's devices, "Add to Google
// Wallet" on the others, as the booking app's ticket offers them. The booking app makes both passes (its /api/wallet-pass
// and /api/google-wallet, reading the order through store_order_pass with the order's number and key) and this site's
// routes hand them on (/api/store/wallet-pass, /api/store/google-pass). A booking app not set up for one answers 501 and
// that button goes away; Google's is drawn only once the booking app says it can make a pass at all (GET
// /api/google-wallet?ready, as the booking ticket's button asks). The official badge is drawn once its file is in
// public/site/wallet (WALLET_ART), never redrawn; until then the button is the words beside a drawn wallet.
const never = () => () => {};
const useDevice = () => useSyncExternalStore(never, () => (isApple(navigator.userAgent || "") ? "apple" : "other"), () => null);
let gReady: Promise<boolean> | null = null;
const askGoogle = () => (gReady ??= fetch("/api/google-wallet?ready", { cache: "no-store" }).then((r) => r.ok, () => { gReady = null; return false; }));

export default function WalletPass({ no, k, lang }: { no: number; k: string; lang: string }) {
  const t = useLocalize(T);
  const device = useDevice();
  const [gOk, setGOk] = useState(false);
  const [gone, setGone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (device !== "other") return;
    let live = true;
    askGoogle().then((y) => { if (live) setGOk(y); });
    return () => { live = false; };
  }, [device]);
  if (!device || gone || (device === "other" && !gOk)) return null;
  const apple = device === "apple";
  const art = WALLET_ART[apple ? "apple" : "google"][lang === "ar" ? "ar" : "en"];
  const label = apple ? t.addApple : t.addGoogle;

  async function add() {
    if (busy) return;
    setBusy(true); setMsg("");
    try {
      const r = await fetch(apple ? "/api/store/wallet-pass" : "/api/store/google-pass", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ no, key: k, lang }),
      });
      if (r.status === 501) { setGone(true); return; }
      if (apple) {
        if (r.ok && /pkpass/.test(r.headers.get("content-type") ?? "")) {
          // a .pkpass opened from a blob brings up Safari's "Add to Apple Wallet" sheet, as the booking app does it
          const url = URL.createObjectURL(await r.blob());
          window.location.assign(url);
          setTimeout(() => URL.revokeObjectURL(url), 60000);
          return;
        }
      } else {
        const b = (await r.json().catch(() => null)) as { ok?: boolean; url?: string } | null;
        if (r.ok && b?.ok && b.url) { window.location.assign(b.url); return; }
      }
      setMsg(t.walletErr);
    } catch {
      setMsg(t.walletErr);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="sxb-wallet">
      <button type="button" className={art ? "sxb-wallet-art" : "sxb-wallet-btn"} onClick={add} disabled={busy} aria-label={label}>
        {art ? <img src={art} alt="" height={44} /> : <><AfterIcon name="wallet" size={18} />{busy ? t.walletBusy : label}</>}
      </button>
      {msg && <span className="sxb-msg" role="status">{msg}</span>}
    </span>
  );
}
