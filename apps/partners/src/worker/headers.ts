// The headers every answer carries. The page loads nothing from anywhere else: its script,
// styles and fonts are the Worker's own files, and the database is reached through /api only.
// No inline script or style anywhere, so the policy needs no 'unsafe-inline'.

export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join("; ");

export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": CSP,
  // No includeSubDomains: this host's name is not decided, and it must not decide for others.
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  // A private portal: never in a search engine.
  "X-Robots-Tag": "noindex, nofollow",
};

/** A copy of the response with the security headers on it. */
export function secure(res: Response): Response {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v);
  return out;
}
