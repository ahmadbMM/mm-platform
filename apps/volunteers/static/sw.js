// The volunteer portal's service worker: phone notifications and nothing else (the volunteer rework, 2026-11-09).
// No fetch handler and no cache: the portal stays online only, and every page load still comes from the network.
// The payload is the push queue's JSON (mm-push-drain): { title, body, url, tag }. A push with nothing readable in it
// still shows something, since a push that shows nothing gets the site's permission taken away by the browser.
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = {}; }
  e.waitUntil(self.registration.showNotification(d.title || "MicroMobility Volunteers", {
    body: d.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: d.tag || "mm-volunteer",
    data: { url: d.url || "/#updates" },
  }));
});

// A tap opens the address it names, on this site only, in the portal's window if one is open.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  let target = new URL("/#updates", self.location.origin).href;
  try {
    const u = new URL((e.notification.data && e.notification.data.url) || "/#updates", self.location.origin);
    if (u.origin === self.location.origin) target = u.href;
  } catch { /* the Updates page */ }
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
    for (const w of wins) {
      if ("focus" in w) {
        let nav = null;
        try { nav = w.navigate ? w.navigate(target) : null; } catch { nav = null; }
        return Promise.resolve(nav).then((r) => (r || w).focus(), () => self.clients.openWindow(target));
      }
    }
    return self.clients.openWindow(target);
  }));
});
