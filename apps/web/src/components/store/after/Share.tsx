"use client";

import { useState, useSyncExternalStore } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { T } from "../sx-B4.text";
import { AfterIcon } from "./icons";

// Share the order (N01): one drawn Share mark that opens the phone's own share sheet (navigator.share, WhatsApp among
// its choices) with the order's link; where there is no share sheet (a computer) it copies the link and says so. The
// link is the order's own (its number and key), the one Track order gives anyone with the number and the phone: it
// shows the order with the phone masked and gift card codes hidden, so it can go to whoever collects it.
const never = () => () => {};
const useCanShare = () => useSyncExternalStore(never, () => typeof navigator.share === "function", () => false);

export default function OrderShare({ path, no }: { path: string; no: string }) {
  const t = useLocalize(T);
  const can = useCanShare();
  const [msg, setMsg] = useState("");
  async function go() {
    const url = new URL(path, window.location.origin).href;
    setMsg("");
    if (can) {
      try { await navigator.share({ title: t.shareTitle(no), url }); return; } catch (e) {
        if ((e as Error)?.name === "AbortError") return; // the customer closed the sheet
      }
    }
    try { await navigator.clipboard.writeText(url); setMsg(t.linkCopied); } catch { setMsg(t.errs.generic); }
  }
  return (
    <span className="sxb-share">
      <button type="button" className="bk-btn2 sxb-act" onClick={go}><AfterIcon name="share" size={18} />{can ? t.share : t.copyLink}</button>
      {msg && <span className="sxb-msg" role="status">{msg}</span>}
    </span>
  );
}
