// The volunteer portal's service worker (the volunteer rework, 2026-11-09; the owner's decision 11, 2026-11-11): phone
// notifications, and the app's shell kept for a clear offline screen. scripts/build.mjs writes CACHE (named by the
// content of what it keeps, so every release starts a cache of its own) and SHELL (the page, its hashed script and
// styles, the mark, the manifest and the icon) into the copy in dist/.
//
// - A page load goes to the network first. Without one, the shell answers for "/" and the app says it is offline
//   (src/client/main.ts); anything else gets a short offline page.
// - The shell is kept under "/" ONLY. Cloudflare answers /index.html with a redirect to "/", and a response with
//   redirect history cannot answer a page load (Safari refuses it by name, Chrome fails the load): the booking app lost
//   every page load to that on 2026-09-10. A redirected answer is never stored, and "/" is stored as a fresh response.
// - Files named by their content (app-<hash>, chunks/) come from the cache first; the words, fonts and pictures from
//   the network first and the cache without one. The API and the calendar file are never touched.
const CACHE = "mmv-dev";
const SHELL = ["/"];

const sameSite = (u) => u.origin === self.location.origin;
const hashed = (p) => /^\/(app-[A-Za-z0-9]+\.(js|css)|chunks\/[A-Za-z0-9_-]+\.js)$/.test(p);
const keepable = (p) => hashed(p) || /^\/(lang|fonts|site|vendor)\//.test(p) || /^\/(icon-192\.png|icon-512\.png|favicon\.png|manifest\.webmanifest)$/.test(p);

/** A response that may answer a page load: never one with redirect history. */
async function clean(res) {
  if (!res.redirected) return res;
  const body = await res.blob();
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
}

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(async (c) => {
    await Promise.all(SHELL.map(async (p) => {
      try {
        const res = await fetch(new Request(p, { cache: "reload" }));
        if (res.ok && !res.redirected) await c.put(p, res);
        else if (res.ok) await c.put(p, await clean(res));
      } catch { /* the next visit fills it */ }
    }));
  }).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith("mmv-") && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const OFFLINE = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
  + '<title>MicroMobility Volunteers</title></head><body><main><h1>You are offline</h1><p>Connect to the internet, then open the portal again.</p>'
  + '<h1 lang="ar" dir="rtl">أنت غير متصل بالإنترنت</h1><p lang="ar" dir="rtl">اتصل بالإنترنت، ثم افتح البوابة من جديد.</p></main></body></html>';

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (!sameSite(url) || url.pathname.startsWith("/api/") || url.pathname.startsWith("/cal/")) return;
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        // the shell, kept fresh from the root only (never /index.html, never a redirect)
        if (url.pathname === "/" && res.ok && !res.redirected) {
          const copy = res.clone();
          e.waitUntil(caches.open(CACHE).then((c) => c.put("/", copy)).catch(() => undefined));
        }
        return await clean(res);
      } catch {
        const shell = url.pathname === "/" ? await caches.match("/", { cacheName: CACHE }) : null;
        return shell ? clean(shell) : new Response(OFFLINE, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
      }
    })());
    return;
  }
  if (!keepable(url.pathname)) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (hashed(url.pathname)) {
      const hit = await cache.match(req);
      if (hit) return hit;
    }
    try {
      const res = await fetch(req);
      if (res.ok && !res.redirected) e.waitUntil(cache.put(req, res.clone()).catch(() => undefined));
      return res;
    } catch (err) {
      const hit = await cache.match(req);
      if (hit) return hit;
      throw err;
    }
  })());
});

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
