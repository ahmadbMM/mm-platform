// The website's service worker: Web Push and nothing else. It has no fetch handler and keeps no
// cache, so it can never serve a stale page (the booking app learned that the hard way); pages
// load exactly as they would without it.
//
// Notifications are sent by the booking app's /api/push-send (Cloudflare Pages Function), to
// every browser in push_subscriptions for the rider - this site's subscriptions sit in the same
// table, signed with the same VAPID pair, so one send reaches the booking app and the website
// alike. Its payload is JSON: { title, body, url, tag }. The Account page's Notifications switch
// (components/account/PushToggle.tsx) registers this file and subscribes.

const ICON = "/push-icon.png";

// The booking app sends "/" or "./" (its own front page, where a rider sees their bookings).
// Here that is the Account page. A link to another site is never opened from a notification.
function target(url) {
  const raw = typeof url === "string" ? url.trim() : "";
  if (!raw || raw === "/" || raw === "./") return new URL("/account", self.location.origin).href;
  try {
    const u = new URL(raw, self.location.origin);
    return u.origin === self.location.origin ? u.href : new URL("/account", self.location.origin).href;
  } catch {
    return new URL("/account", self.location.origin).href;
  }
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// A push must always show something: a push that shows no notification gets the site's
// permission taken away by the browser. A payload that cannot be read still shows the name.
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { /* keep the fallback */ }
  const title = String(d.title || "MicroMobility").slice(0, 120);
  e.waitUntil(self.registration.showNotification(title, {
    body: String(d.body || "").slice(0, 300),
    icon: ICON,
    badge: ICON,
    // The same tag replaces an earlier notification about the same booking instead of stacking.
    tag: d.tag || "mm-general",
    renotify: true,
    data: { url: target(d.url) },
    dir: d.dir || "auto",
    lang: d.lang || "",
  }));
});

// Tapping it brings an open tab of this site forward, on the notification's page, or opens one.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || target("");
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (wins) => {
    for (const w of wins) {
      if (new URL(w.url).origin !== self.location.origin || !("focus" in w)) continue;
      try { if (w.url !== url && "navigate" in w) await w.navigate(url); } catch { /* an uncontrolled tab cannot be steered */ }
      return w.focus();
    }
    return self.clients.openWindow(url);
  }));
});

// The push service can replace a subscription. Subscribe again with the same key and tell the
// site, which links it to the signed-in account (the account cookie goes with this request).
// Signed out, the site refuses it, and the next time the switch is seen it offers to turn on.
self.addEventListener("pushsubscriptionchange", (e) => {
  const key = e.oldSubscription && e.oldSubscription.options && e.oldSubscription.options.applicationServerKey;
  if (!key) return;
  e.waitUntil(self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }).then((sub) => {
    const j = sub.toJSON();
    return fetch("/api/account/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ action: "subscribe", endpoint: j.endpoint, keys: j.keys, old: e.oldSubscription.endpoint }),
    });
  }).catch(() => { /* the next visit to the Account page puts it right */ }));
});
