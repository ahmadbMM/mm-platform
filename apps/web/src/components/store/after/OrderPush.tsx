"use client";

import { useState, useSyncExternalStore } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { T } from "../sx-B4.text";
import { AfterIcon } from "./icons";
import { postJson } from "./net";

// Notifications for this order (N04; off until staff turn store.push.on on): "Ready for pickup", "Out for delivery",
// "Refund sent", on this phone. Drawn only for the signed-in account that placed the order, on a browser with Web Push
// (an iPhone has it only in a site added to the Home Screen: N05 comes first there). Turning it on asks the browser's
// permission, subscribes this browser with the site's VAPID key and registers it for the account exactly as the Account
// page's Notifications switch does (/api/account/push, the booking app's push_subscriptions), then marks this order
// (/api/store/order-push, store_after_push). The booking app's /api/push-send sends when staff move the order; the
// service worker is public/sw.js, which opens the order's page from the notification.
const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const never = () => () => {};
const useSupported = () => useSyncExternalStore(never, () => !!KEY && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window, () => false);

function bytes(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
const sameKey = (buf: ArrayBuffer | null | undefined) => {
  if (!buf) return false;
  const a = new Uint8Array(buf), b = bytes(KEY);
  return a.length === b.length && a.every((v, i) => v === b[i]);
};

export default function OrderPush({ no, k, on: was }: { no: number; k: string; on: boolean }) {
  const t = useLocalize(T);
  const supported = useSupported();
  const [on, setOn] = useState(was);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!supported) return null;

  async function turnOn() {
    setBusy(true); setErr("");
    try {
      const perm = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
      if (perm !== "granted") { setErr(perm === "denied" ? t.errs.blocked : t.errs.generic); return; }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (sub && !sameKey(sub.options.applicationServerKey)) { await sub.unsubscribe(); sub = null; }
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(KEY) });
      const j = sub.toJSON();
      const a = await postJson("/api/account/push", { action: "subscribe", endpoint: j.endpoint, keys: j.keys });
      if (!a.ok) { setErr(t.errs[a.error ?? ""] ?? t.errs.generic); return; }
      const r = await postJson("/api/store/order-push", { no, key: k, on: true });
      if (r.ok) setOn(true); else setErr(t.errs[r.error ?? ""] ?? t.errs.generic);
    } catch {
      setErr(t.errs.generic);
    } finally {
      setBusy(false);
    }
  }
  async function turnOff() {
    setBusy(true); setErr("");
    // only this order stops: the browser stays subscribed for the account's other notifications (the Account page's switch)
    const r = await postJson("/api/store/order-push", { no, key: k, on: false });
    setBusy(false);
    if (r.ok) setOn(false); else setErr(t.errs[r.error ?? ""] ?? t.errs.generic);
  }
  return (
    <span className="sxb-push">
      <button type="button" className="bk-btn2 sxb-act" onClick={on ? turnOff : turnOn} disabled={busy} aria-pressed={on}>
        <AfterIcon name="bell" size={18} />{busy ? t.working : on ? t.pushOff : t.pushOn}
      </button>
      {on && !err && <span className="sxb-msg" role="status">{t.pushIsOn}</span>}
      {err && <span className="sxb-msg bk-err" role="alert">{err}</span>}
    </span>
  );
}
