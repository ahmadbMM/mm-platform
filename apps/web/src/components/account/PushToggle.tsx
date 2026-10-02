"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { T } from "./PushToggle.text";
import "./PushToggle.css";

// The Account page's Notifications switch, as the booking app's My Account has it: turning it on
// asks the browser's permission, subscribes this browser with the site's VAPID public key and
// registers it for the signed-in rider (/api/account/push). Staff sends from the booking app
// (/api/push-send, e.g. "A spot opened up" on a waitlist promotion) then reach this device too.
// Hidden while NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set at build time, and on browsers without
// Web Push (an iPhone only has it in a site added to the Home Screen) - an inert switch is
// worse than none. The service worker is public/sw.js.
const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

const Bell = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
function sameKey(buf: ArrayBuffer | null | undefined): boolean {
  if (!buf) return false;
  const a = new Uint8Array(buf), b = b64urlToBytes(KEY);
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

const never = () => () => {};
const useSupported = () => useSyncExternalStore(
  never,
  () => !!KEY && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window,
  () => false,
);

type Err = "" | "blocked" | "failed" | "signin";

async function tellSite(body: unknown): Promise<{ ok: boolean; status: number }> {
  try {
    const r = await fetch("/api/account/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { ok: r.ok, status: r.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

const LINKED = "mm_push_linked";

export default function PushToggle() {
  const t = useLocalize(T);
  const supported = useSupported();
  const [on, setOn] = useState<boolean | null>(null); // null until the browser has been asked
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<"" | "isOn" | "isOff">("");
  const [err, setErr] = useState<Err>("");

  useEffect(() => {
    if (!supported) return;
    let gone = false;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        const sub = await reg.pushManager.getSubscription();
        const live = !!sub && Notification.permission === "granted" && sameKey(sub.options.applicationServerKey);
        if (!gone) setOn(live);
        // Once per tab: tie this browser to the account now signed in (another account may have
        // turned it on), as the booking app re-registers on each visit.
        if (live && sub) {
          let done = "";
          try { done = sessionStorage.getItem(LINKED) || ""; } catch { /* storage blocked */ }
          if (done !== sub.endpoint) {
            const j = sub.toJSON();
            const r = await tellSite({ action: "subscribe", endpoint: j.endpoint, keys: j.keys });
            if (r.ok) { try { sessionStorage.setItem(LINKED, sub.endpoint); } catch { /* storage blocked */ } }
          }
        }
      } catch {
        if (!gone) setOn(false);
      }
    })();
    return () => { gone = true; };
  }, [supported]);

  if (!supported || on === null) return null;
  const blocked = typeof Notification !== "undefined" && Notification.permission === "denied";

  async function turnOn() {
    setErr(""); setMsg(""); setBusy(true);
    try {
      // Asked first, straight from the tap: Safari only shows the prompt inside the gesture.
      const perm = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
      if (perm !== "granted") { setErr(perm === "denied" ? "blocked" : "failed"); return; }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      // A subscription made with another key cannot be sent to with ours.
      if (sub && !sameKey(sub.options.applicationServerKey)) { await sub.unsubscribe(); sub = null; }
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlToBytes(KEY) });
      const j = sub.toJSON();
      const r = await tellSite({ action: "subscribe", endpoint: j.endpoint, keys: j.keys });
      if (!r.ok) {
        await sub.unsubscribe().catch(() => false);
        setErr(r.status === 401 ? "signin" : "failed");
        return;
      }
      try { sessionStorage.setItem(LINKED, sub.endpoint); } catch { /* storage blocked */ }
      setOn(true); setMsg("isOn");
    } catch {
      setErr("failed");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setErr(""); setMsg(""); setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        // The server first: a row left behind is pushed to until the push service says it is gone.
        await tellSite({ action: "unsubscribe", endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      try { sessionStorage.removeItem(LINKED); } catch { /* storage blocked */ }
      setOn(false); setMsg("isOff");
    } catch {
      setErr("failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ac-sec" aria-labelledby="ac-push-h">
      <h2 id="ac-push-h">{t.title}</h2>
      <div className="pn-card">
        <span className={on ? "pn-ic pn-on" : "pn-ic"}><Bell /></span>
        <div className="pn-txt"><p>{blocked && !on ? t.blocked : t.sub}</p></div>
        {!(blocked && !on) && (
          <button type="button" className={on ? "pn-btn pn-off" : "pn-btn"} onClick={on ? turnOff : turnOn} disabled={busy} aria-pressed={on}>
            {busy ? t.working : on ? t.off : t.on}
          </button>
        )}
        {(err || msg) && <p className={err ? "pn-msg pn-err" : "pn-msg"} role="status">{err ? t[err] : msg ? t[msg] : ""}</p>}
      </div>
    </section>
  );
}
