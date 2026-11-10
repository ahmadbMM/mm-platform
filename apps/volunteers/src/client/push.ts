// Phone notifications (web push). The service worker (/sw.js) only shows a push and opens the portal when one is
// tapped: it has no fetch handler and keeps nothing, so the portal stays online only. The database queues a
// notification with every update (_vol_note, rentals 20261109120000) and mm-push-drain sends them once the push
// keys are set in Cloudflare; until then turning this on registers the phone and nothing arrives.
// Whether it is on is read from the browser itself (its subscription and permission), never from storage.

import { rpc } from "./api";

// The Notifications switch on Profile. Off (the user, 2026-11-09: "no notifications for now"): nothing is sent until the
// push keys are set, so a switch would promise what never comes. The worker and the subscribing stay, ready to turn on.
export const PUSH_SWITCH = false;

// The public half of the VAPID pair: the browser is meant to see it.
export const VAPID_PUBLIC_KEY ="BJSyC1Qe8jYlIWBzYCbDminoCcbRJG0XYbKlz_yhuqyyKuEx-yYjFLsfJDu5K2O27fu1N9SOi2x3KVfzS0SpA2g";

export const ios = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const standalone = () => {
  try { return matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true; } catch { return false; }
};

/** "ok" where the browser can take a push; "home" on an iPhone that has not added the portal to its Home Screen
 *  (Safari takes pushes only from a Home Screen web app); "no" elsewhere, where the switch is not shown. */
export function pushSupport(): "ok" | "home" | "no" {
  const can = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && window.isSecureContext;
  if (can) return "ok";
  if (ios() && !standalone()) return "home";
  return "no";
}

const b64ToBytes = (s: string): Uint8Array<ArrayBuffer> => {
  const raw = atob((s + "=".repeat((4 - (s.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};
const keyB64 = (sub: PushSubscription, name: PushEncryptionKeyName): string => {
  const k = sub.getKey(name);
  if (!k) return "";
  let s = "";
  new Uint8Array(k).forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

async function subscription(): Promise<PushSubscription | null> {
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    return reg ? await reg.pushManager.getSubscription() : null;
  } catch {
    return null;
  }
}

/** On when this browser holds a subscription and the permission still stands. */
export async function pushIsOn(): Promise<boolean> {
  if (pushSupport() !== "ok") return false;
  try { if (Notification.permission !== "granted") return false; } catch { return false; }
  return !!(await subscription());
}

/** Asks for the permission (once), subscribes this browser and tells the database. */
export async function pushOn(): Promise<"on" | "denied" | "failed"> {
  if (pushSupport() !== "ok") return "failed";
  try {
    const asked = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (asked !== "granted") return asked === "denied" ? "denied" : "failed";
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription())
      ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC_KEY) }));
    const r = await rpc<boolean>("customer_push_subscribe", {
      p_endpoint: sub.endpoint, p_p256dh: keyB64(sub, "p256dh"), p_auth: keyB64(sub, "auth"), p_ua: (navigator.userAgent || "").slice(0, 200),
    });
    return r.ok && r.data !== false ? "on" : "failed";
  } catch {
    return "failed";
  }
}

/** Tells the database first (a row left behind keeps being pushed to until it fails), then drops the subscription. */
export async function pushOff(): Promise<void> {
  const sub = await subscription();
  if (!sub) return;
  await rpc("customer_push_unsubscribe", { p_endpoint: sub.endpoint });
  try { await sub.unsubscribe(); } catch { /* the browser forgets it by itself */ }
}
