// The headers every answer carries. The page's script, styles and fonts are the Worker's own files,
// and the database is reached through /api only. The one thing from elsewhere is Cloudflare Web
// Analytics (named in the Privacy Notice): Cloudflare adds its beacon to the page on this zone. No
// inline script or style anywhere, so the policy needs no 'unsafe-inline'. The camera is for
// scanning tickets, and only this page may ask for it. The service worker (/sw.js) and the manifest are the Worker's
// own files too: the worker shows phone notifications and keeps the app's shell for an offline screen (the
// volunteer rework, 2026-11-09; decision 11, 2026-11-11).

export const CSP = [
  "default-src 'self'",
  "script-src 'self' https://static.cloudflareinsights.com",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://cloudflareinsights.com",
  "media-src 'self' blob:",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join("; ");

export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": CSP,
  // No includeSubDomains: one host must not decide for its siblings.
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  // Opportunities are shared by link for now; sessions can be listed here before they open to the public.
  "X-Robots-Tag": "noindex, nofollow",
};

/** How long a file may be kept (fix 15): the page's script, styles and their chunks are named by their content and kept
 *  for a year; the page and the service worker are checked every time, so a new release is seen at once. Anything else
 *  keeps what the asset server says. */
export const IMMUTABLE = "public, max-age=31536000, immutable";
export function cacheFor(path: string, res: Response): Response {
  let cc: string | null = null;
  if (/^\/(app-[A-Za-z0-9]+\.(js|css)|chunks\/[A-Za-z0-9_-]+\.js)$/.test(path)) cc = IMMUTABLE;
  else if (path === "/" || path === "/index.html" || path === "/sw.js") cc = "no-cache";
  if (!cc || !res.ok) return res;
  const out = new Response(res.body, res);
  out.headers.set("Cache-Control", cc);
  return out;
}

/** A copy of the response with the security headers on it. */
export function secure(res: Response): Response {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v);
  return out;
}
