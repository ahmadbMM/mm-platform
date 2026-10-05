// Sends a page failure to the site's own log (app/api/log-error). Once per error per page, and
// never throws: a report that cannot be sent is dropped. The page's path only, never its query
// (a one-time code, an email address typed into a link).
const sent = new Set<string>();

export function reportError(error: Error & { digest?: string }): void {
  try {
    const key = error.digest || error.message || "error";
    if (sent.has(key)) return;
    sent.add(key);
    const body = JSON.stringify({ digest: error.digest ?? "", message: String(error.message ?? "").slice(0, 300), path: location.pathname });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/log-error", new Blob([body], { type: "text/plain;charset=UTF-8" }));
    else void fetch("/api/log-error", { method: "POST", headers: { "content-type": "text/plain;charset=UTF-8" }, body, keepalive: true }).catch(() => {});
  } catch { /* nothing to do */ }
}
